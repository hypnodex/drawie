-- TESTING: allow a user to claim MULTIPLE tiles on the same canvas.
-- Previously claim_tile was idempotent-per-canvas: if you already held ANY tile here it returned
-- that one (ignoring the tile you tapped) — i.e. one tile per person per canvas. That clashes with
-- the frontend's ENFORCE_ONE_TILE_PER_USER=false. This relaxes it: re-opening YOUR OWN specific tile
-- still returns it (so you can keep editing), but tapping a fresh empty tile claims it even if you
-- already have others. (Revert by restoring the original unconditional idempotent block.)
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

  -- Re-opening a tile you ALREADY own → return it (so editing your in-progress tile keeps working).
  -- (Was: return ANY tile you hold here = one-per-canvas. Now scoped to the specific tapped tile.)
  if p_tile_id is not null then
    select * into claimed from tiles
     where id = p_tile_id and canvas_id = p_canvas_id and assigned_user_id = uid
     limit 1;
    if found then return claimed; end if;
  end if;

  -- Otherwise claim a fresh EMPTY tile — multiple-per-user allowed.
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
