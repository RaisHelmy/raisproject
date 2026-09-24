-- Every take of a shot, kept (§40, §41).
--
-- Regenerating used to overwrite the shot's asset id, which left the previous
-- picture orphaned in the asset table with nothing pointing at it. A take row
-- per generation means a shot can be regenerated freely and an earlier version
-- chosen again, which is the whole point of trying a second time.
CREATE TABLE shot_takes (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id),
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  version INTEGER NOT NULL,
  asset_id TEXT REFERENCES assets(id),
  generation_id TEXT,
  model_id TEXT,
  prompt TEXT,
  cost_sen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (shot_id, kind, version)
);
CREATE INDEX idx_shot_takes_shot ON shot_takes(shot_id, kind, version);
