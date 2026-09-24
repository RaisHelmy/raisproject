-- Core multi-tenant HRMS schema.
-- Every tenant-owned table carries tenant_id; application code must filter
-- by it on every query (see worker/db.ts).

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','hr','manager','employee')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id),
  employee_no TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  division TEXT,
  position_title TEXT,
  grade TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  join_date TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','on_leave','resigned','terminated')),
  manager_id TEXT REFERENCES employees(id),
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE UNIQUE INDEX idx_employees_tenant_no ON employees(tenant_id, employee_no);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_user ON employees(user_id);

CREATE TABLE leave_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  default_entitlement_days REAL NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_leave_types_tenant ON leave_types(tenant_id);

CREATE TABLE leave_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  entitled_days REAL NOT NULL DEFAULT 0,
  used_days REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (employee_id, leave_type_id, year)
);
CREATE INDEX idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);

CREATE TABLE leave_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id TEXT REFERENCES employees(id),
  decided_at TEXT,
  decision_remarks TEXT,
  applied_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_leave_apps_tenant ON leave_applications(tenant_id);
CREATE INDEX idx_leave_apps_employee ON leave_applications(employee_id);
CREATE INDEX idx_leave_apps_approver ON leave_applications(approver_id);

CREATE TABLE timesheets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  hours REAL,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (employee_id, work_date)
);
CREATE INDEX idx_timesheets_tenant ON timesheets(tenant_id);
CREATE INDEX idx_timesheets_employee ON timesheets(employee_id);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  claim_type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  claim_date TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id TEXT REFERENCES employees(id),
  decided_at TEXT,
  decision_remarks TEXT,
  applied_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_claims_tenant ON claims(tenant_id);
CREATE INDEX idx_claims_employee ON claims(employee_id);
CREATE INDEX idx_claims_approver ON claims(approver_id);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_record ON audit_logs(module, record_id);
