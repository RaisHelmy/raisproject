CREATE TABLE overtime_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_date TEXT NOT NULL,
  hours REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TEXT,
  decision_remarks TEXT,
  workflow_instance_id TEXT REFERENCES workflow_instances(id),
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_overtime_tenant_employee ON overtime_requests(tenant_id, employee_id);

CREATE TABLE work_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  work_days TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_work_schedules_tenant ON work_schedules(tenant_id);

CREATE TABLE work_schedule_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_schedule_id TEXT NOT NULL REFERENCES work_schedules(id),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wsa_tenant_employee ON work_schedule_assignments(tenant_id, employee_id);
