-- Two demo accounts: STOCK (moomoo-style paper trading, TrdEnv SIMULATE) and BINARY (IQ Option-style practice).
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,            -- 'STOCK' | 'BINARY'
  cash REAL NOT NULL,
  initial REAL NOT NULL
);
INSERT INTO accounts VALUES ('STOCK', 1000000, 1000000), ('BINARY', 10000, 10000);

CREATE TABLE positions (
  code TEXT PRIMARY KEY,
  qty REAL NOT NULL,
  avg_cost REAL NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  trd_side TEXT NOT NULL,         -- BUY | SELL
  order_type TEXT NOT NULL,       -- MARKET | NORMAL (limit)
  qty REAL NOT NULL,
  price REAL,                     -- limit price
  status TEXT NOT NULL,           -- SUBMITTED | FILLED_ALL | CANCELLED_ALL | FAILED
  dealt_avg_price REAL,
  remark TEXT,
  create_time INTEGER NOT NULL,
  updated_time INTEGER NOT NULL
);

CREATE TABLE binary_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  direction TEXT NOT NULL,        -- CALL (higher) | PUT (lower)
  amount REAL NOT NULL,
  strike REAL NOT NULL,
  payout REAL NOT NULL,           -- e.g. 0.87
  open_time INTEGER NOT NULL,
  expire_time INTEGER NOT NULL,
  status TEXT NOT NULL,           -- OPEN | WON | LOST | TIE
  close_price REAL,
  profit REAL
);
CREATE INDEX idx_bin_status ON binary_options(status, expire_time);
CREATE INDEX idx_orders_status ON orders(status);
