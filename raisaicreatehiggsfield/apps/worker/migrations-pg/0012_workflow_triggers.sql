-- Public addresses that start a workflow (§135).
--
-- The address is a secret token rather than the workflow id: it is handed to
-- an outside system, and a leaked one must be revocable without touching the
-- workflow it starts.
CREATE TABLE workflow_triggers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  -- A ceiling per call, so an external system cannot spend without bound.
  max_cost_sen INTEGER,
  last_fired_at TEXT,
  fire_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id);
