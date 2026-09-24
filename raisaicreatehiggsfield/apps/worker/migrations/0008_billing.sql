CREATE TABLE balances (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id),
  available_sen INTEGER NOT NULL DEFAULT 0,
  reserved_sen INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Append-only ledger. Never UPDATE or DELETE a row (invariant 1).
CREATE TABLE balance_transactions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('deposit','reservation','charge','refund','adjustment')),
  amount_sen INTEGER NOT NULL, -- signed
  balance_after_sen INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('generation','workflow_run','payment','admin')),
  reference_id TEXT,
  reservation_id TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id), -- null for system-initiated
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_balance_txn_org ON balance_transactions(org_id, created_at);
CREATE INDEX idx_balance_txn_reference ON balance_transactions(reference_type, reference_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe','toyyibpay','manual')),
  provider_txn_id TEXT,
  amount_sen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  receipt_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payments_org ON payments(org_id, created_at);

CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id),
  day TEXT NOT NULL, -- YYYY-MM-DD
  category TEXT NOT NULL, -- image|video|audio|text|workflow|movie
  model_id TEXT REFERENCES models(id),
  count INTEGER NOT NULL DEFAULT 0,
  customer_spent_sen INTEGER NOT NULL DEFAULT 0,
  provider_cost_micro_usd INTEGER NOT NULL DEFAULT 0 -- admin only
);
CREATE INDEX idx_usage_org_day ON usage_records(org_id, day);
