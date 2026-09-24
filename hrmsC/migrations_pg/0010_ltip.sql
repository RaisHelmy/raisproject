-- Equity/share grants (old_project's LTIP module). Deliberately lighter
-- than the original's full offer/CDS-account/investment-bank integration:
-- admin issues a grant, the employee accepts or declines it, and vesting
-- progress is computed from vesting_start/vesting_end rather than tracked
-- through a separate vesting-event ledger.
CREATE TABLE equity_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  grant_date TEXT NOT NULL,
  quantity REAL NOT NULL,
  vesting_start TEXT NOT NULL,
  vesting_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined')),
  decided_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_equity_grants_tenant ON equity_grants(tenant_id);
CREATE INDEX idx_equity_grants_employee ON equity_grants(employee_id);
