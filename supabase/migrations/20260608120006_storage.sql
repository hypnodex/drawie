-- Storage buckets + policies.
--   tiles/{canvas_id}/{tile_id}.png   — private; assignee uploads, members read
--   mosaics/{canvas_id}.png           — public-read; written by the composite Edge Fn (service role)
--   avatars/{user_id}/...             — public-read; owner writes

insert into storage.buckets (id, name, public) values
  ('tiles',   'tiles',   false),
  ('mosaics', 'mosaics', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- tiles: only the tile's assignee may upload/update; canvas members may read.
-- name = '<canvas_id>/<tile_id>.png'
create policy tile_obj_read on storage.objects for select
  using (bucket_id = 'tiles' and is_member_of(split_part(name,'/',1)));

create policy tile_obj_write on storage.objects for insert
  with check (bucket_id = 'tiles' and exists (
    select 1 from tiles t
     where t.id = replace(split_part(name,'/',2),'.png','')
       and t.assigned_user_id = auth.uid()));

create policy tile_obj_update on storage.objects for update
  using (bucket_id = 'tiles' and exists (
    select 1 from tiles t
     where t.id = replace(split_part(name,'/',2),'.png','')
       and t.assigned_user_id = auth.uid()));

-- avatars: owner-scoped writes (folder = user id); world read via public bucket.
create policy avatar_obj_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatar_obj_write on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- mosaics are public-read (public bucket); only the service role (Edge Fn) writes.
create policy mosaic_obj_read on storage.objects for select
  using (bucket_id = 'mosaics');
