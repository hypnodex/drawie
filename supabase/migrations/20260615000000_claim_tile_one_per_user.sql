-- Re-assert the PRODUCTION rule: one tile (drawing) per user per canvas.
--
-- Background: 20260611000000_claim_tile_allow_multiple relaxed claim_tile so a user could hold
-- MANY tiles per canvas, for fast single-account testing. That relaxation LEAKED to the hosted
-- prod DB (it shows in the Remote migration list). This migration restores claim_tile to the
-- original one-tile-per-canvas logic (idempotent: re-claiming returns your existing tile here).
-- It is forward-only, so `supabase db push` cleanly restores one-tile on any environment that
-- ran the relaxation — no destructive rollback needed.
--
-- The multi-tile relaxation now lives OUTSIDE the prod migration chain, as a test-only script:
--   supabase/dev/claim_tile_allow_multiple.dev.sql   (apply locally AFTER `db reset`)
-- See supabase/dev/README.md (includes the one-time `migration repair` for the hosted leak).
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

  -- already holding a tile here → return it (idempotent: ONE tile per user per canvas)
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
