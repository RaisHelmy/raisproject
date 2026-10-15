ALTER TABLE orders ADD COLUMN rule_id INTEGER;
ALTER TABLE binary_options ADD COLUMN rule_id INTEGER;

CREATE TABLE rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  mode TEXT NOT NULL,               -- STOCK | BINARY
  code TEXT NOT NULL,
  ktype TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  amount REAL NOT NULL,             -- stock qty per entry, or binary stake
  expiry INTEGER,                   -- binary expiry seconds
  money_mgmt TEXT NOT NULL DEFAULT 'FIXED',
  stop_loss_pct REAL,
  take_profit_pct REAL,
  status TEXT NOT NULL,             -- ACTIVE | PAUSED | STOPPED | DELETED
  stop_reason TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  ties INTEGER NOT NULL DEFAULT 0,
  pnl REAL NOT NULL DEFAULT 0,
  pos_qty REAL NOT NULL DEFAULT 0,
  entry_price REAL,
  ref_price REAL,
  cur_stake REAL,
  last_bar INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_rules_status ON rules(status);

-- One row per trial: a binary option, or a stock round trip (entry → exit).
CREATE TABLE rule_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  kind TEXT NOT NULL,               -- BINARY | STOCK
  ref_id INTEGER,                   -- binary_options.id for BINARY
  side TEXT NOT NULL,               -- BUY/SELL or CALL/PUT
  qty REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  status TEXT NOT NULL,             -- OPEN | WON | LOST | TIE
  pnl REAL,
  reason TEXT,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE INDEX idx_rule_trades_rule ON rule_trades(rule_id, id);
CREATE INDEX idx_rule_trades_ref ON rule_trades(kind, ref_id);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  rule_id INTEGER,
  actor TEXT NOT NULL,              -- admin | bot | system
  event TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX idx_audit_rule ON audit_log(rule_id, id);
