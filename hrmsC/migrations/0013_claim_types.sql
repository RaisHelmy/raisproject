-- Admin-configurable claim type catalog, replacing the hardcoded frontend
-- list. `is_mileage` types compute amount = distance × mileage_rate rather
-- than accepting a free-typed amount (old_project's Mileage Book).
-- `is_advance` flags a pre-expense advance claim (old_project's Advance
-- Claims) — a lighter-weight equivalent without the full reconciliation
-- ledger old_project's charge-code-integrated system has.
CREATE TABLE claim_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  is_mileage INTEGER NOT NULL DEFAULT 0,
  mileage_rate REAL,
  is_advance INTEGER NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_claim_types_tenant ON claim_types(tenant_id);

ALTER TABLE claims ADD COLUMN claim_type_id TEXT REFERENCES claim_types(id);
ALTER TABLE claims ADD COLUMN distance REAL;
ALTER TABLE claims ADD COLUMN is_advance INTEGER NOT NULL DEFAULT 0;
