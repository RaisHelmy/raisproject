-- Sessions: every rule, trade, order and audit entry belongs to one; one session is ACTIVE at a time.
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,              -- ACTIVE | STOPPED
  parent_id INTEGER,                 -- session it was created from (reference)
  start_stock REAL NOT NULL,         -- account balances when the session started (USD)
  start_binary REAL NOT NULL,
  end_stock REAL,                    -- balances when it was stopped
  end_binary REAL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  stopped_at INTEGER
);
ALTER TABLE rules ADD COLUMN session_id INTEGER;
ALTER TABLE rule_trades ADD COLUMN session_id INTEGER;
ALTER TABLE binary_options ADD COLUMN session_id INTEGER;
ALTER TABLE orders ADD COLUMN session_id INTEGER;
ALTER TABLE audit_log ADD COLUMN session_id INTEGER;
CREATE INDEX idx_rules_session ON rules(session_id, status);
CREATE INDEX idx_rule_trades_session ON rule_trades(session_id, id);
CREATE INDEX idx_bin_session ON binary_options(session_id, id);
CREATE INDEX idx_orders_session ON orders(session_id, id);
CREATE INDEX idx_audit_session ON audit_log(session_id, id);

-- Everything that exists today becomes session 1.
INSERT INTO sessions (name, status, start_stock, start_binary, notes, created_at)
  SELECT 'Session 1', 'ACTIVE', (SELECT initial FROM accounts WHERE id='STOCK'), (SELECT initial FROM accounts WHERE id='BINARY'),
         'Created from existing rules and history', COALESCE((SELECT MIN(created_at) FROM rules), CAST(strftime('%s','now') AS INTEGER) * 1000);
UPDATE rules SET session_id = 1;
UPDATE rule_trades SET session_id = 1;
UPDATE binary_options SET session_id = 1;
UPDATE orders SET session_id = 1;
UPDATE audit_log SET session_id = 1;
