CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  model_id TEXT NOT NULL REFERENCES models(id),
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  input_json TEXT NOT NULL DEFAULT '{}',
  parameters_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  estimated_cost_sen INTEGER NOT NULL DEFAULT 0,
  actual_cost_sen INTEGER,
  cost_basis TEXT NOT NULL DEFAULT 'estimated' CHECK (cost_basis IN ('estimated','actual')),
  provider_cost_micro_usd INTEGER, -- admin only
  provider_request_id TEXT,        -- admin only
  error_code TEXT,
  error_message TEXT,
  workflow_run_id TEXT,
  node_run_id TEXT,
  request_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE UNIQUE INDEX idx_generations_idempotency ON generations(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_generations_project ON generations(project_id, created_at);
CREATE INDEX idx_generations_org_status ON generations(org_id, status);
CREATE INDEX idx_generations_workflow_run ON generations(workflow_run_id);

CREATE TABLE generation_inputs (
  generation_id TEXT NOT NULL REFERENCES generations(id),
  port TEXT NOT NULL,
  asset_id TEXT REFERENCES assets(id),
  value_json TEXT,
  PRIMARY KEY (generation_id, port)
);

CREATE TABLE generation_outputs (
  generation_id TEXT NOT NULL REFERENCES generations(id),
  port TEXT NOT NULL,
  asset_id TEXT REFERENCES assets(id),
  value_json TEXT,
  PRIMARY KEY (generation_id, port)
);
