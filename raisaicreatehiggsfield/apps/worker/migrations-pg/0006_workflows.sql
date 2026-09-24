CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  current_version INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  forked_from_workflow_id TEXT REFERENCES workflows(id),
  is_system INTEGER NOT NULL DEFAULT 0, -- 1 for hidden Quick Create wrapper workflows (ADR-004)
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  deleted_at TEXT
);
CREATE INDEX idx_workflows_project ON workflows(project_id, deleted_at);

-- Immutable: never UPDATE a row after insert (see ADR / DATA-MODEL invariant 2).
CREATE TABLE workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version INTEGER NOT NULL,
  document_json TEXT NOT NULL, -- WorkflowDocument
  document_hash TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (workflow_id, version)
);

CREATE TABLE workflow_drafts (
  workflow_id TEXT PRIMARY KEY REFERENCES workflows(id),
  document_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  template_version_id TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN ('ui','api','mcp','webhook','template')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','running','paused','completed','failed','cancelled')),
  variables_json TEXT NOT NULL DEFAULT '{}',
  outputs_json TEXT,
  estimated_cost_sen INTEGER NOT NULL DEFAULT 0,
  actual_cost_sen INTEGER,
  max_cost_sen INTEGER,
  reservation_txn_id TEXT,
  cf_workflow_instance_id TEXT,
  partial_from_node_ids_json TEXT,
  rerun_of_run_id TEXT REFERENCES workflow_runs(id),
  error_json TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE UNIQUE INDEX idx_workflow_runs_idempotency ON workflow_runs(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id, created_at);
CREATE INDEX idx_workflow_runs_org_status ON workflow_runs(org_id, status);

CREATE TABLE node_runs (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  node_id TEXT NOT NULL, -- matches WorkflowDocument node id
  node_type TEXT NOT NULL,
  model_id TEXT REFERENCES models(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped','cached')),
  attempt INTEGER NOT NULL DEFAULT 0,
  input_json TEXT,
  output_json TEXT,
  cache_key TEXT,
  estimated_cost_sen INTEGER NOT NULL DEFAULT 0,
  actual_cost_sen INTEGER,
  provider_request_id TEXT, -- admin only
  generation_id TEXT REFERENCES generations(id),
  error_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (workflow_run_id, node_id)
);
CREATE INDEX idx_node_runs_run ON node_runs(workflow_run_id);

CREATE TABLE node_cache (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  cache_key TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  expires_at TEXT,
  PRIMARY KEY (org_id, cache_key)
);
