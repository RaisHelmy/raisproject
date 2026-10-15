-- Risk guards the user runs, and their trip/clear/block history.
CREATE TABLE risk_guards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,              -- GuardConfig JSON (scope, perAsset, detectors, cooldownMin)
  status TEXT NOT NULL,              -- ACTIVE | OFF
  tripped_until INTEGER,             -- new trades blocked until this time
  blocked TEXT,                      -- JSON list of blocked codes while tripped
  last_reason TEXT,
  last_trip INTEGER,
  trips INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE risk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guard_id INTEGER,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,                -- TRIP | CLEAR | DRILL | BLOCKED
  detail TEXT,
  session_id INTEGER
);
CREATE INDEX idx_risk_events ON risk_events(id);
