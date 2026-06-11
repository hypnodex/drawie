-- Release a claimed-but-unsubmitted tile back to EMPTY (discard). Lets a user abandon a tile they
-- claimed without drawing/submitting, so it stops being stuck 'in-progress' and others can claim it.
-- Only the caller's OWN in-progress tile is affected — never a completed tile or someone else's.
create or replace function release_tile(p_tile_id text)
returns void as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update tiles
     set status='empty', assigned_user_id=null, contributor_name=null, started_at=null
   where id = p_tile_id and assigned_user_id = uid and status='in-progress';
end $$ language plpgsql volatile security definer set search_path = public;
