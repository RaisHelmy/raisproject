-- Generic, config-driven multi-step approval routing engine.
-- Replaces the old "approver_id = employee's manager" shortcut on
-- leave_applications/claims with a real workflow: per-tenant workflow
-- definitions (matched by module + category + amount range), each with an
-- ordered list of steps, each step resolved to a concrete approver
-- (an employee's manager N levels up, a role, or a specific user) at
-- submission time. Every step's decision is logged in workflow_step_actions
-- (the "routing log", mirroring old_project's RoutingLogs module).
--
-- `module` is intentionally NOT constrained to a fixed set of values here so
-- future modules (payroll, training, loan, asset requests, ...) can reuse
-- this engine without another schema migration.

CREATE TABLE workflow_definitions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  min_amount REAL,
  max_amount REAL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_workflow_definitions_tenant_module ON workflow_definitions(tenant_id, module);

CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  approver_type TEXT NOT NULL CHECK (approver_type IN ('employee_manager','role','specific_user')),
  manager_level INTEGER NOT NULL DEFAULT 1,
  approver_role TEXT,
  approver_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (workflow_definition_id, step_order)
);
CREATE INDEX idx_workflow_steps_definition ON workflow_steps(workflow_definition_id);

CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  workflow_definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
  current_step_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','approved','rejected','cancelled')),
  created_at TEXT NOT NULL DEFAULT (now()::text),
  completed_at TEXT
);
CREATE INDEX idx_workflow_instances_tenant_module ON workflow_instances(tenant_id, module);
CREATE INDEX idx_workflow_instances_record ON workflow_instances(module, record_id);

CREATE TABLE workflow_step_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  approver_type TEXT NOT NULL,
  resolved_approver_employee_id TEXT REFERENCES employees(id),
  resolved_approver_role TEXT,
  action TEXT NOT NULL DEFAULT 'pending'
    CHECK (action IN ('pending','approved','rejected','skipped')),
  acted_by_user_id TEXT REFERENCES users(id),
  remarks TEXT,
  acted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (workflow_instance_id, step_order)
);
CREATE INDEX idx_workflow_step_actions_instance ON workflow_step_actions(workflow_instance_id);
CREATE INDEX idx_workflow_step_actions_approver_employee ON workflow_step_actions(resolved_approver_employee_id);
CREATE INDEX idx_workflow_step_actions_tenant ON workflow_step_actions(tenant_id);

ALTER TABLE leave_applications ADD COLUMN workflow_instance_id TEXT REFERENCES workflow_instances(id);
ALTER TABLE claims ADD COLUMN workflow_instance_id TEXT REFERENCES workflow_instances(id);
