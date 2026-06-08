-- Realtime: stream tile/canvas/comment changes to subscribed clients.
-- RLS applies to the replication stream, so private-canvas events only reach
-- members. replica identity full gives filters + DELETE payloads the full row.

alter table tiles    replica identity full;
alter table canvases replica identity full;
alter table comments replica identity full;

alter publication supabase_realtime add table tiles;
alter publication supabase_realtime add table canvases;
alter publication supabase_realtime add table comments;
