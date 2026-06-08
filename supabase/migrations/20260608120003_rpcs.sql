-- RPCs: anything RLS can't express (atomic claims, token resolution,
-- cross-user host ops, entitlement-gated creation).

-- ── Atomic tile claim ──────────────────────────────────────────────────────
-- Idempotent: re-claiming returns your existing tile in this canvas.
-- Specific tile only honored for free-pick canvases; random uses
-- FOR UPDATE SKIP LOCKED so two callers never grab the same row.
create or replace function claim_tile(
  p_canvas_id text,
  p_tile_id   text default null,
  p_prefer_center boolean default false
) returns tiles as $$
declare
  uid     uuid := auth.uid();
  uname   text;
  mode    participation_mode;
  claimed tiles;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select name into uname from profiles where id = uid;
  select participation_mode into mode from canvases where id = p_canvas_id;
  if mode is null then raise exception 'CANVAS_NOT_FOUND'; end if;

  -- already holding a tile here → return it (idempotent)
  select * into claimed from tiles
   where canvas_id = p_canvas_id and assigned_user_id = uid
   limit 1;
  if found then return claimed; end if;

  if p_tile_id is not null and mode = 'free-pick' then
    update tiles set status='in-progress', assigned_user_id=uid,
                     contributor_name=uname, started_at=now()
     where id = p_tile_id and canvas_id = p_canvas_id and status='empty'
     returning * into claimed;
  else
    update tiles set status='in-progress', assigned_user_id=uid,
                     contributor_name=uname, started_at=now()
     where id = (
       select id from tiles
        where canvas_id = p_canvas_id and status='empty'
        order by (p_prefer_center and is_center) desc, random()
        for update skip locked
        limit 1)
     returning * into claimed;
  end if;

  if claimed.id is null then raise exception 'TILE_UNAVAILABLE'; end if;
  return claimed;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Complete a tile (assignee only) ────────────────────────────────────────
create or replace function complete_tile(
  p_tile_id text,
  p_artwork_path text default null
) returns tiles as $$
declare uid uuid := auth.uid(); claimed tiles;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update tiles set status='completed', completed_at=now(),
                   artwork_path = coalesce(p_artwork_path, artwork_path)
   where id = p_tile_id and assigned_user_id = uid
   returning * into claimed;
  if claimed.id is null then raise exception 'NOT_YOUR_TILE'; end if;
  return claimed;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Join a private canvas by guest token ───────────────────────────────────
-- Returns { canvas, tile }. Caller must be signed in first (anonymously is
-- fine). First joiner gets the centre artboard; everyone else a random one.
create or replace function join_private_canvas(p_token text)
returns jsonb as $$
declare cv canvases; first_join boolean; tile tiles;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into cv from canvases where guest_token = p_token;
  if cv.id is null then raise exception 'INVALID_TOKEN'; end if;

  insert into private_sessions (canvas_id, host_id)
  values (cv.id, cv.founder_id) on conflict (canvas_id) do nothing;

  select count(*) = 0 into first_join from tiles
   where canvas_id = cv.id and assigned_user_id is not null;

  tile := claim_tile(cv.id, null, first_join);
  return jsonb_build_object('canvas', to_jsonb(cv), 'tile', to_jsonb(tile));
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Resolve a host token → canvas (bearer becomes the host) ────────────────
create or replace function resolve_host_token(p_token text)
returns canvases as $$
declare cv canvases;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into cv from canvases where host_token = p_token;
  if cv.id is null then raise exception 'INVALID_TOKEN'; end if;

  insert into private_sessions (canvas_id, host_id)
  values (cv.id, auth.uid())
  on conflict (canvas_id) do update set host_id = excluded.host_id;
  return cv;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Host: move a participant to a different (free) artboard ─────────────────
create or replace function host_reassign(
  p_canvas_id text, p_tile_id text, p_target_user uuid
) returns void as $$
declare uname text;
begin
  if not exists (select 1 from private_sessions
                  where canvas_id = p_canvas_id and host_id = auth.uid())
  then raise exception 'NOT_HOST'; end if;

  if exists (select 1 from tiles where id = p_tile_id
              and canvas_id = p_canvas_id and assigned_user_id is not null)
  then raise exception 'TILE_TAKEN'; end if;

  select name into uname from profiles where id = p_target_user;
  -- free the target's current tile, then assign the new one
  update tiles set status='empty', assigned_user_id=null, contributor_name=null,
                   started_at=null, completed_at=null, artwork_path=null
   where canvas_id = p_canvas_id and assigned_user_id = p_target_user;
  update tiles set status='in-progress', assigned_user_id=p_target_user,
                   contributor_name=uname, started_at=now()
   where id = p_tile_id and canvas_id = p_canvas_id;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Host: kick a participant (frees their tile) ────────────────────────────
create or replace function host_kick(p_canvas_id text, p_target_user uuid)
returns void as $$
begin
  if not exists (select 1 from private_sessions
                  where canvas_id = p_canvas_id and host_id = auth.uid())
  then raise exception 'NOT_HOST'; end if;
  update tiles set status='empty', assigned_user_id=null, contributor_name=null,
                   started_at=null, completed_at=null, artwork_path=null
   where canvas_id = p_canvas_id and assigned_user_id = p_target_user;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Create a canvas (entitlement-gated) ────────────────────────────────────
-- Premium OR ≥5 completed tiles may found a canvas. Private canvases get
-- guest/host tokens + a private_sessions row (founder as initial host).
create or replace function create_canvas(payload jsonb)
returns canvases as $$
declare
  uid uuid := auth.uid();
  is_prem boolean; done int; is_private boolean;
  cv canvases;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select is_premium into is_prem from profiles where id = uid;
  select count(*) into done from tiles where assigned_user_id = uid and status='completed';
  if not coalesce(is_prem,false) and done < 5 then raise exception 'NOT_ENTITLED'; end if;

  is_private := coalesce(payload->>'visibility','public') = 'private-link';

  insert into canvases (
    title, description, founder_id, category, topic, style,
    grid_rows, grid_cols, allowed_tools, disallowed_tools, color_palette,
    background, style_guidance, participation_mode, visibility, neighbor_preview_size,
    preview_gradient, final_gradient, participant_count, guest_token, host_token
  ) values (
    payload->>'title',
    coalesce(payload->>'description',''),
    uid,
    payload->>'category',
    coalesce(payload->>'topic',''),
    coalesce(payload->>'style',''),
    (payload->>'gridRows')::int,
    (payload->>'gridCols')::int,
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'allowedTools')), '{}'),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(payload->'disallowedTools')), '{}'),
    case when payload->'colorPalette' is null or payload->'colorPalette' = 'null'::jsonb
         then null
         else (select array_agg(value::text) from jsonb_array_elements_text(payload->'colorPalette')) end,
    coalesce(payload->>'background','#ffffff'),
    coalesce(payload->>'styleGuidance',''),
    coalesce((payload->>'participationMode')::participation_mode,'free-pick'),
    coalesce((payload->>'visibility')::canvas_visibility,'public'),
    coalesce((payload->>'neighborPreviewSize')::neighbor_size,'small'),
    coalesce(payload->>'previewGradient','linear-gradient(135deg,#2f5742,#d6ee5a)'),
    payload->>'finalGradient',
    case when is_private then (payload->>'participantCount')::int else null end,
    case when is_private then gen_token() else null end,
    case when is_private then gen_token() else null end
  ) returning * into cv;

  if is_private then
    insert into private_sessions (canvas_id, host_id) values (cv.id, uid);
  end if;
  return cv;
end $$ language plpgsql volatile security definer set search_path = public;

-- ── Voting ──────────────────────────────────────────────────────────────────
create or replace function cast_vote(p_canvas_id text, p_month_key text)
returns void as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into votes (user_id, canvas_id, month_key)
  values (auth.uid(), p_canvas_id, p_month_key)
  on conflict (user_id, month_key) do update set canvas_id = excluded.canvas_id, created_at = now();
end $$ language plpgsql volatile security definer set search_path = public;

create or replace function retract_vote(p_month_key text)
returns void as $$
begin
  delete from votes where user_id = auth.uid() and month_key = p_month_key;
end $$ language plpgsql volatile security definer set search_path = public;
