-- Workflows that run on a schedule (§136).
--
-- Deliberately not general cron: an interval and an optional time of day cover
-- what people actually ask for, and are far harder to misconfigure into
-- something that runs every minute and empties a balance overnight.
CREATE TABLE workflow_schedules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('hourly','daily','weekly')),
  -- Hour of day in UTC for daily and weekly; day of week 0-6 for weekly.
  hour_utc INTEGER NOT NULL DEFAULT 9,
  day_of_week INTEGER,
  variables_json TEXT NOT NULL DEFAULT '{}',
  max_cost_sen INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_schedules_due ON workflow_schedules(active, next_run_at);
CREATE INDEX idx_schedules_workflow ON workflow_schedules(workflow_id);
