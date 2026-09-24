-- Rais Timesheet — initial schema (PostgreSQL / Hyperdrive)
--
-- This is a direct, unmodified port of migrations/0001_init.sql (the original
-- SQLite/D1 schema). That file was already written as portable ANSI SQL — TEXT
-- UUID ids, ISO-8601 timestamps as TEXT, 0/1 INTEGER booleans, JSON-in-TEXT
-- columns, REAL for floats — and every construct it uses (CREATE INDEX,
-- REFERENCES, ON CONFLICT ... DO UPDATE SET x = excluded.x, RETURNING) reads
-- identically in Postgres, so nothing needed to change to run it here.
--
-- Deliberate choice (see docs/database.md and the API migration report): kept
-- booleans as INTEGER (0/1) and timestamps as TEXT (ISO-8601) rather than
-- switching to native BOOLEAN/TIMESTAMPTZ, because the application layer
-- (repositories, services, DTOs) binds/reads them as 0/1 numbers and ISO
-- strings throughout — widening to native types would have required touching
-- every insert/read call site for a purely cosmetic gain. TODO: migrate to
-- native BOOLEAN/TIMESTAMPTZ in a follow-up once on Postgres, updating the
-- application layer at the same time.
--
-- Applied once, by hand, over the SSH tunnel (no drizzle-kit / ORM in this
-- app — see src/db/pg-adapter.ts for why):
--   sshpass -p '...' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
--   psql "postgresql://postgres:postgres@localhost:15432/raishelmy?sslmode=require&options=--search_path%3Draistimesheet" \
--     -f migrations-pg/0001_init.sql
--
-- This app's tables live in the `raistimesheet` schema inside the shared
-- `raishelmy` database (one Postgres instance, one schema per app) — not a
-- dedicated `raistimesheet_db` database. Setting `search_path` via the
-- connection options above ensures any unqualified CREATE TABLE here lands
-- in the right schema if this file is ever re-run.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  whatsapp_aliases TEXT NOT NULL DEFAULT '[]',
  jira_account_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  jira_project_key TEXT,
  jira_url TEXT,
  default_issue_type TEXT NOT NULL DEFAULT 'Task',
  default_assignee_account_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  working_hours_start TEXT NOT NULL DEFAULT '09:00',
  working_hours_end TEXT NOT NULL DEFAULT '18:00',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  r2_key_original TEXT,
  r2_key_normalized TEXT,
  r2_key_analysis TEXT,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  message_count INTEGER NOT NULL DEFAULT 0,
  messages_processed INTEGER NOT NULL DEFAULT 0,
  tasks_detected INTEGER NOT NULL DEFAULT 0,
  ai_provider TEXT,
  error_message TEXT,
  correlation_id TEXT,
  raw_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX idx_imports_user ON imports(user_id, created_at);

CREATE TABLE import_messages (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES imports(id),
  seq INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_attachment INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_import_messages_import ON import_messages(import_id, seq);

CREATE TABLE ai_analyses (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES imports(id),
  provider TEXT NOT NULL,
  model TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  summary_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT
);
CREATE INDEX idx_ai_analyses_import ON ai_analyses(import_id);

CREATE TABLE ai_work_items (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES ai_analyses(id),
  import_id TEXT NOT NULL REFERENCES imports(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  executor TEXT NOT NULL,
  is_mine INTEGER NOT NULL DEFAULT 1,
  work_date_json TEXT NOT NULL,
  duration_json TEXT NOT NULL,
  start_time_json TEXT NOT NULL,
  end_time_json TEXT NOT NULL,
  work_status_json TEXT NOT NULL,
  jira_candidates_json TEXT NOT NULL DEFAULT '[]',
  explicit_jira_key TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  assumptions_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'PENDING',
  timesheet_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ai_work_items_import ON ai_work_items(import_id, sort_order);

CREATE TABLE timesheet_sequences (
  year INTEGER PRIMARY KEY,
  next_value INTEGER NOT NULL
);

-- One row = one work entry (timesheet item). Reference TS-YYYY-NNNNN.
CREATE TABLE timesheets (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  work_date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  work_status TEXT NOT NULL DEFAULT 'COMPLETED',
  jira_sync_status TEXT NOT NULL DEFAULT 'NOT_LINKED',
  source_import_id TEXT REFERENCES imports(id),
  source_work_item_id TEXT,
  confidence REAL,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);
CREATE INDEX idx_timesheets_user_date ON timesheets(user_id, work_date);
CREATE INDEX idx_timesheets_status ON timesheets(status);
CREATE INDEX idx_timesheets_project_date ON timesheets(project_id, work_date);
CREATE INDEX idx_timesheets_sync ON timesheets(jira_sync_status);

CREATE TABLE timesheet_approvals (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_timesheet_approvals_ts ON timesheet_approvals(timesheet_id, created_at);

-- Organisation-level Jira connection (one active row). Tokens encrypted at rest.
CREATE TABLE jira_connections (
  id TEXT PRIMARY KEY,
  auth_type TEXT NOT NULL,             -- OAUTH | API_TOKEN
  site_url TEXT NOT NULL,
  cloud_id TEXT,
  account_id TEXT,
  account_name TEXT,
  account_email TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  api_token_enc TEXT,
  token_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'HEALTHY',
  last_sync_at TEXT,
  last_ok_at TEXT,
  last_error TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE jira_oauth_states (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Local cache of Jira issues (Jira remains the source of truth).
CREATE TABLE jira_issues (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  issue_id TEXT,
  project_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  status_category TEXT NOT NULL DEFAULT 'unknown',
  issue_type TEXT NOT NULL DEFAULT 'Task',
  assignee_account_id TEXT,
  assignee_name TEXT,
  priority TEXT,
  due_date TEXT,
  resolved_at TEXT,
  jira_created_at TEXT,
  jira_updated_at TEXT,
  url TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL
);
CREATE INDEX idx_jira_issues_project ON jira_issues(project_key);
CREATE INDEX idx_jira_issues_assignee ON jira_issues(assignee_account_id);

CREATE TABLE timesheet_jira_links (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL UNIQUE REFERENCES timesheets(id),
  jira_issue_key TEXT NOT NULL,
  match_type TEXT NOT NULL,
  match_confidence REAL,
  linked_at TEXT NOT NULL,
  linked_by TEXT REFERENCES users(id),
  sync_status TEXT NOT NULL DEFAULT 'LINKED',
  last_sync_at TEXT,
  sync_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tjl_issue ON timesheet_jira_links(jira_issue_key);

CREATE TABLE jira_match_candidates (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id),
  jira_issue_key TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN | ACCEPTED | DISMISSED
  created_at TEXT NOT NULL
);
CREATE INDEX idx_jmc_timesheet ON jira_match_candidates(timesheet_id);

CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                   -- CREATE_ISSUE | UPDATE_ISSUE | RECONCILE | REFRESH_ISSUES
  timesheet_id TEXT REFERENCES timesheets(id),
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | RUNNING | SUCCEEDED | FAILED | DEAD
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_run_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  last_error TEXT,
  result_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, next_run_at);

CREATE TABLE sync_errors (
  id TEXT PRIMARY KEY,
  sync_job_id TEXT REFERENCES sync_jobs(id),
  timesheet_id TEXT REFERENCES timesheets(id),
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  correlation_id TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sync_errors_ts ON sync_errors(timesheet_id, resolved_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '/',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  correlation_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE report_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  r2_key TEXT,
  row_count INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_report_jobs_user ON report_jobs(user_id, created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

INSERT INTO roles (id, name, description) VALUES
  ('role-admin', 'ADMIN', 'Manage users, projects, Jira, AI and system settings'),
  ('role-approver', 'APPROVER', 'Timesheet owner: review, approve, reject, export and report'),
  ('role-user', 'USER', 'Import WhatsApp, review AI, create and submit timesheets');
