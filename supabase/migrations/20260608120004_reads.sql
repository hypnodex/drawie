-- Derived reads. Anything that aggregates across users (vote counts) or
-- composes a user's full profile/notifications is a SECURITY DEFINER function
-- so it can read past per-row RLS while still scoping output to the caller.

-- ── Current user's full domain profile (one round-trip to hydrate `User`) ──
create or replace function get_my_profile()
returns jsonb as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'avatar', p.avatar,
    'photoUrl', p.photo_url,
    'isPremium', p.is_premium,
    'isAnonymous', p.is_anonymous,
    'completedTilesCount', (select count(*) from tiles where assigned_user_id = p.id and status='completed'),
    'savedCanvasIds', coalesce((select array_agg(canvas_id) from saved_canvases where user_id = p.id), '{}'),
    'draftTileIds', coalesce((select array_agg(id) from tiles where assigned_user_id = p.id and status='in-progress'), '{}'),
    'contributedCanvasIds', coalesce((select array_agg(distinct canvas_id) from tiles where assigned_user_id = p.id), '{}')
  )
  from profiles p where p.id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ── Public profile for /profile/:userId (no saved list for others) ─────────
create or replace function get_profile(p_uid uuid)
returns jsonb as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'avatar', p.avatar,
    'photoUrl', p.photo_url,
    'isPremium', p.is_premium,
    'completedTilesCount', (select count(*) from tiles where assigned_user_id = p.id and status='completed'),
    'savedCanvasIds', case when p.id = auth.uid()
        then coalesce((select array_agg(canvas_id) from saved_canvases where user_id = p.id), '{}') else '{}'::text[] end,
    'draftTileIds', '{}'::text[],
    'contributedCanvasIds', coalesce((select array_agg(distinct canvas_id) from tiles where assigned_user_id = p.id), '{}')
  )
  from profiles p where p.id = p_uid;
$$ language sql stable security definer set search_path = public;

-- ── Current user's notifications (derived: canvas-completed per contribution) ──
create or replace function get_my_notifications()
returns table (
  id text, type text, canvas_id text, canvas_title text,
  created_at timestamptz, read boolean
) as $$
  select distinct
    'canvas-completed:' || c.id,
    'canvas-completed',
    c.id, c.title,
    coalesce(c.completed_at, c.created_at),
    exists (select 1 from notification_reads nr
             where nr.user_id = auth.uid()
               and nr.notification_id = 'canvas-completed:' || c.id)
  from canvases c
  where c.status = 'completed'
    and exists (select 1 from tiles t
                 where t.canvas_id = c.id and t.assigned_user_id = auth.uid())
  order by 5 desc;
$$ language sql stable security definer set search_path = public;

-- ── Vote tallies (seed + real, across all users) ───────────────────────────
create or replace function vote_count(p_canvas text, p_month text)
returns int as $$
  select coalesce((select count(*)::int from votes where canvas_id = p_canvas and month_key = p_month), 0)
       + coalesce((select count from vote_seeds where canvas_id = p_canvas and month_key = p_month), 0);
$$ language sql stable security definer set search_path = public;

create or replace function total_voters(p_month text)
returns int as $$
  select coalesce((select count(*)::int from votes where month_key = p_month), 0)
       + coalesce((select sum(count)::int from vote_seeds where month_key = p_month), 0);
$$ language sql stable security definer set search_path = public;

-- All completed public canvases with their tally for a month (one round-trip
-- for the voting page; drawing-of-the-month = the max row client-side).
create or replace function vote_board(p_month text)
returns table (canvas_id text, votes int) as $$
  select c.id, vote_count(c.id, p_month)
  from canvases c
  where c.visibility = 'public' and c.status = 'completed';
$$ language sql stable security definer set search_path = public;
