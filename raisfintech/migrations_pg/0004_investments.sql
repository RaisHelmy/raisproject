-- Multi-broker investment architecture.
-- Internal Rais Fintech IDs are primary keys everywhere; provider-native IDs
-- are stored in provider_* columns. owner_type prepares for future family /
-- estate ownership without redesign. shariah/zakat columns are reserved for
-- the Islamic wealth layer (populated where known, never required).

CREATE TABLE IF NOT EXISTS investment_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL DEFAULT 'user',       -- future: 'family' | 'trust' | 'estate'
  provider_id TEXT NOT NULL,                     -- registry id: moomoo | ibkr | ...
  status TEXT NOT NULL DEFAULT 'connected',      -- connected|syncing|needs_attention|auth_expired|disconnected|error
  environment TEXT NOT NULL DEFAULT 'live',      -- live | paper
  label TEXT,
  credential_ref TEXT,                           -- reference into secret storage; NEVER the secret itself
  sync_interval_min INTEGER NOT NULL DEFAULT 15,
  last_sync_at TEXT,
  last_sync_status TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS idx_iconn_user ON investment_connections(user_id);

CREATE TABLE IF NOT EXISTS investment_accounts (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES investment_connections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'brokerage',        -- brokerage | cash | margin | retirement
  currency TEXT NOT NULL DEFAULT 'MYR',
  cash_balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_iacct_provider ON investment_accounts(connection_id, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_iacct_user ON investment_accounts(user_id);

CREATE TABLE IF NOT EXISTS investment_holdings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  provider_security_id TEXT,
  quantity REAL NOT NULL,
  avg_cost REAL,
  last_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  market_value REAL NOT NULL,
  asset_class TEXT,                              -- stock | etf | reit | bond | cash | ...
  shariah_status TEXT,                           -- compliant | non-compliant | review | NULL (unknown)
  zakat_eligible INTEGER,                        -- reserved for Islamic wealth layer
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ihold_acct_sym ON investment_holdings(account_id, symbol);
CREATE INDEX IF NOT EXISTS idx_ihold_user ON investment_holdings(user_id);

CREATE TABLE IF NOT EXISTS investment_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  type TEXT NOT NULL,                            -- buy | sell | deposit | withdrawal | fee
  symbol TEXT,
  quantity REAL,
  price REAL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  occurred_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_itx_provider ON investment_transactions(account_id, provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_itx_user ON investment_transactions(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS investment_dividends (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  provider_dividend_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MYR',
  pay_date TEXT NOT NULL,
  purification_amount REAL                        -- reserved: dividend purification
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_idiv_provider ON investment_dividends(account_id, provider_dividend_id);
CREATE INDEX IF NOT EXISTS idx_idiv_user ON investment_dividends(user_id, pay_date DESC);

CREATE TABLE IF NOT EXISTS investment_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  provider_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL,
  status TEXT NOT NULL DEFAULT 'filled',
  placed_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS idx_iord_user ON investment_orders(user_id, placed_at DESC);

CREATE TABLE IF NOT EXISTS investment_sync_logs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES investment_connections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,                          -- ok | error
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS idx_isync_conn ON investment_sync_logs(connection_id, finished_at DESC);

-- Broker affiliate / referral configuration. The Worker resolves the right
-- row; React never hardcodes affiliate URLs.
CREATE TABLE IF NOT EXISTS investment_affiliates (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '*',             -- ISO country or '*' fallback
  affiliate_url TEXT NOT NULL,
  referral_code TEXT,
  campaign_code TEXT,
  terms_url TEXT,
  disclosure_text TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT,
  end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_iaff_provider ON investment_affiliates(provider_id, country);

-- Seed: the existing Moomoo MY referral link (previously hardcoded in React).
INSERT INTO investment_affiliates (id, provider_id, country, affiliate_url, disclosure_text, active)
VALUES (
  'aff-moomoo-my',
  'moomoo',
  'MY',
  'https://j.moomoo.com/0IpwrU',
  'Moomoo MY Welcome Package: RM1,800* in new user rewards & RM5,000* in transfer rewards. *Rewards are provided by Moomoo and subject to Moomoo''s terms. Rais Fintech may receive a referral or affiliate benefit if you open an account through this link. This does not affect the broker''s services or fees.',
  1
);
