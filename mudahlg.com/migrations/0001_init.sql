-- Initial schema
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER  PRIMARY KEY AUTOINCREMENT,
  name           TEXT     NOT NULL,
  email          TEXT     NOT NULL,
  whatsapp       TEXT     NOT NULL,
  products       TEXT     NOT NULL,
  total_estimate TEXT,
  followup       INTEGER  DEFAULT 0,
  domain         TEXT     DEFAULT '',
  referrer       TEXT     DEFAULT '',
  browser        TEXT     DEFAULT '',
  device         TEXT     DEFAULT '',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
