-- Functions, triggers, and helpers.

-- ── Random guest name (SQL port of src/lib/guest.ts) ───────────────────────
create or replace function random_guest_name() returns text as $$
  select (array['Swift','Calm','Bright','Bold','Quiet','Lucky','Brave','Keen'])[floor(random()*8)+1]
       || ' ' ||
         (array['Fox','Heron','Otter','Lynx','Wren','Moth','Pike','Hare'])[floor(random()*8)+1]
       || ' ' || (floor(random()*90)+10)::int::text;
$$ language sql volatile;

-- ── Short opaque token for private share links ─────────────────────────────
create or replace function gen_token() returns text as $$
  select substring(replace(gen_random_uuid()::text,'-','') from 1 for 12);
$$ language sql volatile;

-- ── auth.users → profiles (every signer, incl. anonymous guests) ───────────
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, name, avatar, photo_url, is_anonymous)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name',''),
      nullif(new.raw_user_meta_data->>'full_name',''),
      case when coalesce(new.is_anonymous,false) then random_guest_name()
           else split_part(coalesce(new.email,'user'),'@',1) end
    ),
    '#' || lpad(to_hex(abs(hashtext(new.id::text)) % 16777216), 6, '0'),
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- When an anonymous user upgrades (email/OAuth linked), flip is_anonymous.
create or replace function handle_user_updated() returns trigger as $$
begin
  if coalesce(old.is_anonymous,false) and not coalesce(new.is_anonymous,false) then
    update profiles set is_anonymous = false,
           name = coalesce(nullif(new.raw_user_meta_data->>'name',''),
                           nullif(new.raw_user_meta_data->>'full_name',''),
                           split_part(coalesce(new.email,''),'@',1), name)
     where id = new.id;
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated
  after update on auth.users for each row execute function handle_user_updated();

-- ── Materialize the tile grid when a canvas is created ─────────────────────
create or replace function seed_tiles_for_canvas() returns trigger as $$
begin
  insert into tiles (id, canvas_id, row, col, is_center)
  select new.id || ':t-' || r || '-' || c,
         new.id, r, c,
         (r = new.grid_rows/2 and c = new.grid_cols/2)
  from generate_series(0, new.grid_rows-1) as r,
       generate_series(0, new.grid_cols-1) as c;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_seed_tiles on canvases;
create trigger trg_seed_tiles
  after insert on canvases for each row execute function seed_tiles_for_canvas();

-- ── Recompute canvas counters when tiles change ────────────────────────────
create or replace function refresh_canvas_counters() returns trigger as $$
declare
  cid   text := coalesce(new.canvas_id, old.canvas_id);
  done  int;
  active int;
  total int;
begin
  select count(*) filter (where status='completed'),
         count(*) filter (where status='in-progress')
    into done, active
    from tiles where canvas_id = cid;
  select total_tiles into total from canvases where id = cid;

  update canvases set
    completed_tiles = done,
    active_contributors = active,
    status = case
      when done >= total then 'completed'
      when total > 0 and done::numeric/total > 0.85 then 'almost-complete'
      when status in ('completed','almost-complete') then 'open'  -- recede if tiles freed
      else status end,
    completed_at = case
      when done >= total and completed_at is null then now()
      when done < total then null
      else completed_at end
  where id = cid;
  return null;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_tile_counters on tiles;
create trigger trg_tile_counters
  after insert or delete or update of status on tiles
  for each row execute function refresh_canvas_counters();

-- ── Maintain canvases.discussion_count from comments ───────────────────────
create or replace function refresh_discussion_count() returns trigger as $$
declare cid text := coalesce(new.canvas_id, old.canvas_id);
begin
  update canvases set discussion_count = (select count(*) from comments where canvas_id = cid)
   where id = cid;
  return null;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_comment_count on comments;
create trigger trg_comment_count
  after insert or delete on comments
  for each row execute function refresh_discussion_count();

-- ── Membership helper (token-gated access becomes data: holding a tile,
--    being the host, the founder, or a public canvas = member) ──────────────
create or replace function is_member_of(p_canvas text) returns boolean as $$
  select exists (select 1 from canvases c
                  where c.id = p_canvas
                    and (c.visibility = 'public' or c.founder_id = auth.uid()))
      or exists (select 1 from tiles t
                  where t.canvas_id = p_canvas and t.assigned_user_id = auth.uid())
      or exists (select 1 from private_sessions s
                  where s.canvas_id = p_canvas and s.host_id = auth.uid());
$$ language sql stable security definer set search_path = public;
