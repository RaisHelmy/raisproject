-- Movie production entities (§31-§46).
--
-- A movie is structured data, never one large text blob (§32): every scene,
-- shot and line of dialogue is addressable, so a single shot can be regenerated
-- without touching the rest.

CREATE TABLE movies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  logline TEXT,
  synopsis TEXT,
  idea TEXT,
  style_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','story','storyboard','shots','audio','timeline','exported')),
  target_duration_s INTEGER,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  deleted_at TEXT
);
CREATE INDEX idx_movies_project ON movies(project_id, deleted_at);

-- Characters and locations are project-level, not movie-level, so they can be
-- reused across several movies in the same project (§33, §35).
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  age TEXT,
  description TEXT,
  appearance TEXT,
  personality TEXT,
  voice_json TEXT NOT NULL DEFAULT '{}',
  reference_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_characters_project ON characters(project_id);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  style TEXT,
  lighting TEXT,
  reference_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_locations_project ON locations(project_id);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movies(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id),
  time_of_day TEXT,
  characters_json TEXT NOT NULL DEFAULT '[]',
  action TEXT,
  dialogue_json TEXT NOT NULL DEFAULT '[]',
  visual_style TEXT,
  camera TEXT,
  lighting TEXT,
  duration_s INTEGER,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (movie_id, number)
);
CREATE INDEX idx_scenes_movie ON scenes(movie_id, number);

CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id),
  number INTEGER NOT NULL,
  shot_type TEXT,
  camera_movement TEXT,
  description TEXT NOT NULL DEFAULT '',
  duration_s REAL NOT NULL DEFAULT 4,
  cinematic_json TEXT NOT NULL DEFAULT '{}',
  -- Assets carry their own version history, so a regenerated shot never
  -- destroys the take before it (§41).
  image_asset_id TEXT REFERENCES assets(id),
  video_asset_id TEXT REFERENCES assets(id),
  selected_image_version INTEGER,
  selected_video_version INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','image_ready','video_ready','failed')),
  cost_sen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (scene_id, number)
);
CREATE INDEX idx_shots_scene ON shots(scene_id, number);

CREATE TABLE timeline_tracks (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movies(id),
  kind TEXT NOT NULL CHECK (kind IN ('video','voice','dialogue','music','sfx','subtitles')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  muted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_tracks_movie ON timeline_tracks(movie_id, sort_order);

CREATE TABLE timeline_items (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES timeline_tracks(id),
  asset_id TEXT REFERENCES assets(id),
  shot_id TEXT REFERENCES shots(id),
  label TEXT,
  start_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  trim_in_ms INTEGER NOT NULL DEFAULT 0,
  trim_out_ms INTEGER NOT NULL DEFAULT 0,
  volume REAL NOT NULL DEFAULT 1,
  fade_in_ms INTEGER NOT NULL DEFAULT 0,
  fade_out_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_items_track ON timeline_items(track_id, start_ms);
