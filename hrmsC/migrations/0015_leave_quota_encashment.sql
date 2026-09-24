CREATE TABLE leave_quota_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  granted_days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TEXT,
  decision_remarks TEXT,
  workflow_instance_id TEXT REFERENCES workflow_instances(id),
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by_user_id TEXT REFERENCES users(id)
);
CREATE INDEX idx_leave_quota_grants_tenant_employee ON leave_quota_grants(tenant_id, employee_id);

CREATE TABLE leave_encashments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  days REAL NOT NULL,
  daily_rate REAL NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TEXT,
  decision_remarks TEXT,
  workflow_instance_id TEXT REFERENCES workflow_instances(id),
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leave_encashments_tenant_employee ON leave_encashments(tenant_id, employee_id);
