-- 0014_loyalty.sql
CREATE TABLE loyalty_accounts (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  guest_id       TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier           TEXT NOT NULL DEFAULT 'member',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_loyalty_accounts_tenant_guest ON loyalty_accounts (tenant_id, guest_id);

CREATE TABLE loyalty_transactions (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  guest_id     TEXT NOT NULL,
  delta        INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  reference_id TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_loyalty_tx_tenant_guest ON loyalty_transactions (tenant_id, guest_id);
