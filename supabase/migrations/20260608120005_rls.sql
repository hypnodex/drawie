-- Row-Level Security. Public canvases are world-readable; private ones open up
-- only after an RPC (join/resolve) records the caller as a member. Writes that
-- cross users (claim, host ops, create) go through SECURITY DEFINER RPCs.

alter table profiles            enable row level security;
alter table canvases            enable row level security;
alter table tiles               enable row level security;
alter table private_sessions    enable row level security;
alter table votes               enable row level security;
alter table vote_seeds          enable row level security;
alter table comments            enable row level security;
alter table saved_canvases      enable row level security;
alter table notification_reads  enable row level security;

-- profiles: world-read, owner-update. Inserts only via handle_new_user trigger.
create policy profiles_read   on profiles for select using (true);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- canvases: public OR founder OR member can read; founder can insert/update.
create policy canvas_read   on canvases for select
  using (visibility = 'public' or founder_id = auth.uid() or is_member_of(id));
create policy canvas_insert on canvases for insert with check (founder_id = auth.uid());
create policy canvas_update on canvases for update using (founder_id = auth.uid());

-- tiles: members read; you may only update your own assigned tile (artwork/save).
-- Empty→in-progress claiming and host ops happen via definer RPCs.
create policy tile_read       on tiles for select using (is_member_of(canvas_id));
create policy tile_update_own on tiles for update
  using (assigned_user_id = auth.uid()) with check (assigned_user_id = auth.uid());

-- private_sessions: visible to host + members; writes via RPC only.
create policy psession_read on private_sessions for select
  using (host_id = auth.uid() or is_member_of(canvas_id));

-- votes: owner-scoped. (vote counts are read via SECURITY DEFINER functions.)
create policy votes_rw on votes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vote_seeds: counts are public.
create policy seeds_read on vote_seeds for select using (true);

-- comments: readable on canvases you can see; you write as yourself.
create policy comments_read   on comments for select
  using (exists (select 1 from canvases c where c.id = canvas_id
                  and (c.visibility = 'public' or is_member_of(c.id))));
create policy comments_insert on comments for insert with check (user_id = auth.uid());
create policy comments_delete on comments for delete using (user_id = auth.uid());

-- saved_canvases + notification_reads: owner-scoped.
create policy saved_rw on saved_canvases for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_rw on notification_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ensure the API roles can execute the RPC/read functions (RLS still applies
-- inside them where they query as invoker; definer ones scope by auth.uid()).
grant execute on all functions in schema public to anon, authenticated;
