-- Drawie2 schema: enums + tables + indexes.
-- Canvas/tile ids are TEXT (not uuid) to preserve existing slug ids
-- (e.g. 'canvas-world-mosaic') and the tile-id format '<canvasId>:t-<row>-<col>'
-- the frontend already uses in routes and session keys.

-- ── Enums ────────────────────────────────────────────────────────────────
create type canvas_status      as enum ('open','almost-complete','completed','locked');
create type tile_status        as enum ('empty','in-progress','completed');
create type canvas_visibility  as enum ('public','private-link');
create type participation_mode as enum ('free-pick','random');
create type neighbor_size      as enum ('small','large');
create type notification_type  as enum ('canvas-completed');

-- ── profiles (maps domain User) ───────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  avatar        text not null default '#7c8cff',   -- initials background hex
  photo_url     text,
  is_premium    boolean not null default false,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── canvases (maps Canvas + CanvasConfig) ──────────────────────────────────
create table canvases (
  id                    text primary key default ('canvas-' || replace(gen_random_uuid()::text,'-','')),
  title                 text not null,
  description           text not null default '',
  founder_id            uuid not null references profiles(id),
  category              text not null,
  topic                 text not null default '',
  style                 text not null default '',
  -- config
  grid_rows             int not null check (grid_rows between 1 and 64),
  grid_cols             int not null check (grid_cols between 1 and 64),
  allowed_tools         text[] not null default '{}',   -- empty = all allowed
  disallowed_tools      text[] not null default '{}',
  color_palette         text[],                          -- null = any color
  background            text not null default '#ffffff',
  style_guidance        text not null default '',
  participation_mode    participation_mode not null default 'free-pick',
  visibility            canvas_visibility not null default 'public',
  neighbor_preview_size neighbor_size not null default 'small',
  -- counters (trigger-maintained; total_tiles is generated)
  total_tiles           int generated always as (grid_rows * grid_cols) stored,
  completed_tiles       int not null default 0,
  active_contributors   int not null default 0,
  status                canvas_status not null default 'open',
  is_trending           boolean not null default false,   -- curated
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  preview_gradient      text not null default 'linear-gradient(135deg,#2f5742,#d6ee5a)',
  final_gradient        text,
  artwork_url           text,
  discussion_count      int not null default 0,
  -- private (link-only)
  participant_count     int,
  guest_token           text unique,
  host_token            text unique
);

create index canvases_visibility_status_idx on canvases (visibility, status);
create index canvases_category_idx on canvases (category) where visibility = 'public';
create index canvases_trending_idx on canvases (is_trending) where visibility = 'public';
create index canvases_search_idx on canvases
  using gin (to_tsvector('english', title || ' ' || description || ' ' || topic));

-- ── tiles (maps Tile; private-canvas participants fold in here) ─────────────
create table tiles (
  id               text primary key,   -- '<canvasId>:t-<row>-<col>'
  canvas_id        text not null references canvases(id) on delete cascade,
  row              int not null,
  col              int not null,
  status           tile_status not null default 'empty',
  assigned_user_id uuid references profiles(id) on delete set null,
  contributor_name text,               -- denormalized for guests (display only)
  is_host_tile     boolean not null default false,
  is_center        boolean not null default false,
  started_at       timestamptz,
  completed_at     timestamptz,
  artwork_path     text,               -- storage path of the composited tile PNG
  unique (canvas_id, row, col)
);

create index tiles_canvas_idx on tiles (canvas_id);
create index tiles_assigned_idx on tiles (assigned_user_id);
create index tiles_canvas_status_idx on tiles (canvas_id, status);
create index tiles_free_idx on tiles (canvas_id) where status = 'empty';

-- ── private_sessions (thin host metadata; founder ≠ host is possible) ───────
create table private_sessions (
  canvas_id  text primary key references canvases(id) on delete cascade,
  host_id    uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ── votes (+ community seed counts) ─────────────────────────────────────────
create table votes (
  user_id    uuid not null references profiles(id) on delete cascade,
  canvas_id  text not null references canvases(id) on delete cascade,
  month_key  text not null,                       -- e.g. '2026-06'
  created_at timestamptz not null default now(),
  primary key (user_id, month_key)                -- one vote per user per month
);
create index votes_tally_idx on votes (canvas_id, month_key);

create table vote_seeds (
  canvas_id text not null references canvases(id) on delete cascade,
  month_key text not null,
  count     int not null default 0,
  primary key (canvas_id, month_key)
);

-- ── comments ────────────────────────────────────────────────────────────────
create table comments (
  id         uuid primary key default gen_random_uuid(),
  canvas_id  text not null references canvases(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index comments_canvas_idx on comments (canvas_id, created_at desc);

-- ── saved_canvases ───────────────────────────────────────────────────────────
create table saved_canvases (
  user_id   uuid references profiles(id) on delete cascade,
  canvas_id text references canvases(id) on delete cascade,
  saved_at  timestamptz not null default now(),
  primary key (user_id, canvas_id)
);

-- ── notification read-state (notifications themselves are derived; see view) ──
create table notification_reads (
  user_id         uuid references profiles(id) on delete cascade,
  notification_id text not null,                  -- 'canvas-completed:<canvasId>'
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);
