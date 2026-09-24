CREATE TABLE training_programs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_date TEXT,
  end_date TEXT,
  location TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_training_programs_tenant ON training_programs(tenant_id);

CREATE TABLE training_enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  program_id TEXT NOT NULL REFERENCES training_programs(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled','completed')),
  decided_at TEXT,
  decision_remarks TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  workflow_instance_id TEXT REFERENCES workflow_instances(id)
);
CREATE INDEX idx_training_enrollments_tenant ON training_enrollments(tenant_id);
CREATE INDEX idx_training_enrollments_employee ON training_enrollments(employee_id);
CREATE INDEX idx_training_enrollments_program ON training_enrollments(program_id);

CREATE TABLE training_evaluations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enrollment_id TEXT NOT NULL REFERENCES training_enrollments(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_training_evals_enrollment ON training_evaluations(enrollment_id);
