CREATE TABLE payslips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  pay_period TEXT NOT NULL, -- 'YYYY-MM'
  gross_amount REAL NOT NULL,
  deductions REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by_user_id TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX idx_payslips_employee_period ON payslips(employee_id, pay_period);
CREATE INDEX idx_payslips_tenant ON payslips(tenant_id);
