-- Drawie2 seed: demo users + canvas catalog, mirroring src/mock/*.
-- Demo accounts log in with password 'drawie123' (dev impersonation only).
-- Canvas/tile counters and statuses are produced by the real triggers — we
-- just drive tile statuses to match the mock catalog so the app looks alive.

-- ── Demo auth users (fixed UUIDs so relationships line up) ─────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated', s.email,
       extensions.crypt('drawie123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('name', s.name, 'email', s.email),
       now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'maya@drawie.test',  'Maya'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'alex@drawie.test',  'Alex'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'river@drawie.test', 'River'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'nico@drawie.test',  'Nico'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'soren@drawie.test', 'Soren'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'wren@drawie.test',  'Wren')
) as s(id, email, name)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'name', u.raw_user_meta_data->>'name'),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@drawie.test'
on conflict (provider, provider_id) do nothing;

-- handle_new_user() already created profiles; set the demo-specific fields.
update profiles set avatar='#f472b6', photo_url='https://i.pravatar.cc/300?img=47', is_premium=false where id='00000000-0000-0000-0000-000000000001';
update profiles set avatar='#7c8cff', photo_url='https://i.pravatar.cc/300?img=12', is_premium=false where id='00000000-0000-0000-0000-000000000002';
update profiles set avatar='#10b981', photo_url=null, is_premium=true  where id='00000000-0000-0000-0000-000000000003';
update profiles set avatar='#fb923c', photo_url='https://i.pravatar.cc/300?img=22', is_premium=false where id='00000000-0000-0000-0000-000000000004';
update profiles set avatar='#a78bfa', photo_url=null, is_premium=true  where id='00000000-0000-0000-0000-000000000005';
update profiles set avatar='#22d3ee', photo_url=null, is_premium=false where id='00000000-0000-0000-0000-000000000006';

-- ── Canvas catalog (tiles auto-seeded by trigger) ──────────────────────────
insert into canvases (id, title, description, founder_id, category, topic, style,
  grid_rows, grid_cols, color_palette, preview_gradient, artwork_url, style_guidance,
  discussion_count, is_trending, created_at) values
('canvas-world-mosaic','World Mosaic','A wall of small worlds — surreal cats, ghosts, flowers, and faces, each tile a vignette.','00000000-0000-0000-0000-000000000003','Surreal','A collage of imagined worlds','Mixed media',9,9,null,'linear-gradient(135deg, #0d1a2d 0%, #2f5742 40%, #d6ee5a 75%, #f3f7ec 100%)','/completed/1.png','No theme limits. Each tile is its own scene; soft edges may bleed into neighbors.',312,false, timestamptz '2026-06-01 00:00:00+00' - interval '110 days'),
('canvas-glyph-garden','Glyph Garden','Aztec-pattern blooms and a wandering creature carry a sprout across a cosmic dust storm.','00000000-0000-0000-0000-000000000003','Surreal','A cosmic creature gardener','Pattern / Ink',10,10,null,'linear-gradient(135deg, #0d1a2d 0%, #5c8a6c 35%, #d6ee5a 70%, #dfeacf 100%)','/completed/2.png','Fill tiles with pattern. Ink linework over washes; a single creature crosses the canvas.',188,false, timestamptz '2026-06-01 00:00:00+00' - interval '75 days'),
('canvas-watercolor-garden','Watercolor Garden','A loose botanical wash — peony bloom and storm clouds drift across the canvas.','00000000-0000-0000-0000-000000000003','Botanical','Flowers blooming in soft weather','Watercolor',6,6,array['#ffd6e0','#ffe9b0','#caffd6','#bfe6ff','#d6c5ff','#fff4d6'],'linear-gradient(135deg, #f3f7ec 0%, #c4dab8 30%, #5c8a6c 60%, #dfeacf 100%)','/completed/3.png','Soft watercolor washes, generous whitespace, no hard outlines.',86,false, timestamptz '2026-06-01 00:00:00+00' - interval '48 days'),
('canvas-pixel-meadow','Pixel Meadow','Watercolor flora arranged on a chunky grid — small tiles, lots of breathing room.','00000000-0000-0000-0000-000000000003','Botanical','Quiet wildflower meadow','Watercolor / Pixel',16,16,null,'linear-gradient(135deg, #f3f7ec 0%, #dfeacf 40%, #c4dab8 70%, #ffffff 100%)','/completed/4.png','Loose washes, occasional sharp blossom. Empty cells are part of the composition.',142,false, timestamptz '2026-06-01 00:00:00+00' - interval '70 days'),
('canvas-jellyfish-bloom','Jellyfish Bloom','Translucent creatures drifting through colored clouds.','00000000-0000-0000-0000-000000000003','Botanical','Jellyfish among watercolor blooms','Watercolor',5,5,array['#ffd6e0','#ffe9b0','#caffd6','#bfe6ff','#d6c5ff','#fff4d6'],'linear-gradient(135deg, #dfeacf 0%, #c4dab8 40%, #f3f7ec 75%, #ffffff 100%)','/completed/5.png','Sparse composition, water-on-water bleeds, translucent overlapping forms.',58,false, timestamptz '2026-06-01 00:00:00+00' - interval '36 days'),
('canvas-wildflower-grid','Wildflower Grid','169 separate watercolor wildflowers — a single calm field tiled across the canvas.','00000000-0000-0000-0000-000000000003','Botanical','A field of wildflowers — one per tile','Watercolor',13,13,null,'linear-gradient(135deg, #ffffff 0%, #dfeacf 35%, #c4dab8 65%, #e6f593 100%)','/completed/6.png','One flower per tile. Stems may extend into adjacent tiles by mutual consent.',217,false, timestamptz '2026-06-01 00:00:00+00' - interval '95 days'),
('canvas-cosmic-splash','Cosmic Splash','A weightless watercolor explosion — nebula, bloom, and a few quiet creatures.','00000000-0000-0000-0000-000000000003','Abstract','Cosmic watercolor energy','Watercolor',7,7,null,'linear-gradient(135deg, #0d1a2d 0%, #2f5742 25%, #5c8a6c 50%, #d6ee5a 75%, #f3f7ec 100%)','/completed/7.png','Energetic, splashy, no negative space rules. Let edges drift across seams.',124,false, timestamptz '2026-06-01 00:00:00+00' - interval '55 days'),
('canvas-bloom-creature','Bloom Creature','A surreal portrait of a flower that became someone — sea-anemone hair and a serene face.','00000000-0000-0000-0000-000000000003','Character','A blooming creature with a serene face','Mixed media',6,6,null,'linear-gradient(135deg, #264363 0%, #5c8a6c 35%, #c4dab8 65%, #f3f7ec 100%)','/completed/8.png','Ink lines + watercolor washes. Build a single creature across all tiles.',191,false, timestamptz '2026-06-01 00:00:00+00' - interval '28 days'),
('canvas-bloom-spirits','Bloom Spirits','A drifting spirit-creature wreathed in watercolor swirls and a single carried flower.','00000000-0000-0000-0000-000000000003','Surreal','A traveling watercolor spirit','Watercolor',5,5,null,'linear-gradient(135deg, #dfeacf 0%, #c4dab8 30%, #5c8a6c 65%, #2f5742 100%)','/completed/9.png','Loose color spirits, soft edges, a small bloom as the anchor.',73,false, timestamptz '2026-06-01 00:00:00+00' - interval '40 days'),
('canvas-cosmic-bloom','Cosmic Bloom','Galactic flowers spreading across the void — 41 of 49 tiles done.','00000000-0000-0000-0000-000000000003','Botanical','Flowers blooming in space','Painterly',7,7,null,'linear-gradient(135deg, #0d1a2d 0%, #2f5742 40%, #5c8a6c 70%, #d6ee5a 100%)',null,'Lean into the contrast — deep voids next to high-chroma blooms.',78,true, timestamptz '2026-06-01 00:00:00+00' - interval '14 days'),
('canvas-ocean-bloom','Reef Bloom','Coral reef in full color — only a few tiles left.','00000000-0000-0000-0000-000000000001','Animal','Coral reef ecosystem','Watercolor',5,5,array['#0a4d68','#088395','#05bfdb','#00ffca','#cfffe5','#ffffff'],'linear-gradient(135deg, #0d1a2d 0%, #264363 35%, #5c8a6c 70%, #c4dab8 100%)',null,'Watercolor brushes encouraged. Leave white space — let the paper breathe.',33,true, timestamptz '2026-06-01 00:00:00+00' - interval '9 days'),
('canvas-city-jungle','City Jungle','Modern skyline overgrown by jungle. Maximalist + chaotic.','00000000-0000-0000-0000-000000000003','Architecture','Reclaimed-by-nature cityscape','Cinematic',6,6,null,'linear-gradient(135deg, #2f5742 0%, #5c8a6c 50%, #d6ee5a 100%)',null,'Where steel meets vines — let the architecture lose to the green.',17,true, timestamptz '2026-06-01 00:00:00+00' - interval '4 days'),
('canvas-festival-night','Festival Night','Late-night crowd at a music festival; warm lights, neon stage.','00000000-0000-0000-0000-000000000003','Character','Festival crowd and stage','Cinematic',6,6,null,'linear-gradient(135deg, #0d1a2d 0%, #264363 35%, #d6ee5a 75%, #e6f593 100%)',null,'Strong directional lighting. Faces in silhouette are fine.',4,false, timestamptz '2026-06-01 00:00:00+00' - interval '2 days'),
('canvas-myth-river','River of Myth','Legendary creatures bathing in a slow-moving river.','00000000-0000-0000-0000-000000000001','Mythical','Mythical creatures by a river','Painterly',5,5,array['#1b4332','#2d6a4f','#52b788','#95d5b2','#d8f3dc','#fefae0'],'linear-gradient(135deg, #2f5742 0%, #5c8a6c 50%, #c4dab8 80%, #f3f7ec 100%)',null,'Calm, deliberate strokes. No bright neon.',9,false, timestamptz '2026-06-01 00:00:00+00' - interval '5 days'),
('canvas-portrait-tile','Fragments','Single portrait shattered into 16 tile fragments.','00000000-0000-0000-0000-000000000003','Portrait','Abstract human portrait','Abstract',4,4,null,'linear-gradient(135deg, #264363 0%, #5c8a6c 50%, #f3f7ec 100%)',null,'Lean into the fragmentation — don''t try to make tile edges match.',12,false, timestamptz '2026-06-01 00:00:00+00' - interval '7 days'),
('canvas-neon-tokyo','Neon Tokyo','Rain-slick Tokyo street, every sign in neon.','00000000-0000-0000-0000-000000000003','Architecture','Neon Tokyo street','Cinematic',6,6,array['#ff00aa','#00f0ff','#a3ff00','#ff8800','#5b00ff','#fff200'],'linear-gradient(135deg, #0d1a2d 0%, #2f5742 35%, #d6ee5a 75%, #ffffff 100%)',null,'Neon palette only. Wet streets, reflective surfaces.',28,true, timestamptz '2026-06-01 00:00:00+00' - interval '11 days'),
('canvas-cardboard-robot','Cardboard Robot','A giant friendly robot built from cardboard scraps.','00000000-0000-0000-0000-000000000001','Character','Cardboard robot in a meadow','Sketch',5,5,array['#3e2723','#6d4c41','#8d6e63','#a1887f','#bcaaa4','#efebe9'],'linear-gradient(135deg, #f3f7ec 0%, #c4dab8 50%, #5c8a6c 100%)',null,'Pencil-driven, gentle linework. Imperfect = correct.',2,false, timestamptz '2026-06-01 00:00:00+00' - interval '1 days'),
('canvas-deep-time','Deep Time','Geological layers, fossils, and root systems. Earth as cross-section.','00000000-0000-0000-0000-000000000003','Abstract','Earth cross-section through time','Geometric',5,5,array['#3e2723','#6d4c41','#8d6e63','#a1887f','#bcaaa4','#efebe9'],'linear-gradient(180deg, #0d1a2d 0%, #264363 30%, #5c8a6c 60%, #c4dab8 85%, #f3f7ec 100%)',null,'Cross-section logic — horizontal banding rewards composition.',6,false, timestamptz '2026-06-01 00:00:00+00' - interval '3 days'),
('canvas-quiet-sea','Quiet Sea','Slow ocean at dusk. Almost no human marks.','00000000-0000-0000-0000-000000000003','Landscape','Calm ocean horizon','Minimalist',4,6,array['#0a4d68','#088395','#05bfdb','#00ffca','#cfffe5','#ffffff'],'linear-gradient(180deg, #dfeacf 0%, #5c8a6c 60%, #2f5742 100%)',null,'Minimal, near-monochrome. Horizon line is sacred.',11,false, timestamptz '2026-06-01 00:00:00+00' - interval '6 days');

-- ── Drive tile statuses to match the mock catalog ──────────────────────────
-- completed = first N tiles; in-progress = next M; rest empty. Users round-robin.
with tgt(canvas_id, completed, active) as (values
  ('canvas-world-mosaic',81,0),('canvas-glyph-garden',100,0),('canvas-watercolor-garden',36,0),
  ('canvas-pixel-meadow',256,0),('canvas-jellyfish-bloom',25,0),('canvas-wildflower-grid',169,0),
  ('canvas-cosmic-splash',49,0),('canvas-bloom-creature',36,0),('canvas-bloom-spirits',25,0),
  ('canvas-cosmic-bloom',41,4),('canvas-ocean-bloom',22,1),('canvas-city-jungle',11,8),
  ('canvas-festival-night',6,5),('canvas-myth-river',7,6),('canvas-portrait-tile',5,4),
  ('canvas-neon-tokyo',20,11),('canvas-cardboard-robot',4,3),('canvas-deep-time',3,2),
  ('canvas-quiet-sea',9,7)
),
ranked as (
  select t.id, t.canvas_id,
         row_number() over (partition by t.canvas_id order by t.row, t.col) as rn
  from tiles t
),
users(idx, uid, uname) as (values
  (0,'00000000-0000-0000-0000-000000000001'::uuid,'Maya'),
  (1,'00000000-0000-0000-0000-000000000002'::uuid,'Alex'),
  (2,'00000000-0000-0000-0000-000000000003'::uuid,'River'),
  (3,'00000000-0000-0000-0000-000000000004'::uuid,'Nico'),
  (4,'00000000-0000-0000-0000-000000000005'::uuid,'Soren'),
  (5,'00000000-0000-0000-0000-000000000006'::uuid,'Wren')
)
update tiles tt set
  status = (case when r.rn <= tg.completed then 'completed' else 'in-progress' end)::tile_status,
  assigned_user_id = u.uid,
  contributor_name = u.uname,
  started_at = c.created_at,
  completed_at = case when r.rn <= tg.completed then c.created_at else null end
from ranked r
  join tgt tg on tg.canvas_id = r.canvas_id
  join canvases c on c.id = r.canvas_id
  join users u on u.idx = (r.rn % 6)
where tt.id = r.id and r.rn <= tg.completed + tg.active;

-- Restore historical completed_at on fully-completed canvases (the counter
-- trigger stamped now(); the mock had specific dates).
update canvases set completed_at = timestamptz '2026-06-01 00:00:00+00' - (d || ' days')::interval
from (values
  ('canvas-world-mosaic',2),('canvas-glyph-garden',8),('canvas-watercolor-garden',10),
  ('canvas-pixel-meadow',18),('canvas-jellyfish-bloom',6),('canvas-wildflower-grid',22),
  ('canvas-cosmic-splash',12),('canvas-bloom-creature',3),('canvas-bloom-spirits',5)
) as v(cid, d)
where canvases.id = v.cid;

-- ── Community seed votes (June 2026) ───────────────────────────────────────
insert into vote_seeds (canvas_id, month_key, count) values
  ('canvas-world-mosaic','2026-06',54),('canvas-glyph-garden','2026-06',38),
  ('canvas-watercolor-garden','2026-06',29),('canvas-pixel-meadow','2026-06',21),
  ('canvas-jellyfish-bloom','2026-06',17),('canvas-wildflower-grid','2026-06',12),
  ('canvas-cosmic-splash','2026-06',9),('canvas-bloom-creature','2026-06',7),
  ('canvas-bloom-spirits','2026-06',5)
on conflict (canvas_id, month_key) do nothing;
