-- Investment job queue: analysis runs and robo orders are processed
-- asynchronously by the worker (cron trigger in production, waitUntil in dev).

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'analysis' | 'order'
  payload TEXT NOT NULL,           -- JSON
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  result TEXT,                     -- JSON
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);
