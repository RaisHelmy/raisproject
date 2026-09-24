CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER  PRIMARY KEY AUTOINCREMENT,
  name           TEXT     NOT NULL,
  email          TEXT     DEFAULT '',
  whatsapp       TEXT     NOT NULL,
  products       TEXT     NOT NULL DEFAULT '[]',
  total_estimate TEXT     DEFAULT '',
  ic             TEXT     DEFAULT '',
  address        TEXT     DEFAULT '',
  followup       INTEGER  DEFAULT 0,
  domain         TEXT     DEFAULT '',
  referrer       TEXT     DEFAULT '',
  browser        TEXT     DEFAULT '',
  device         TEXT     DEFAULT '',
  status         TEXT     DEFAULT 'new',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER  NOT NULL,
  note       TEXT     NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_followups (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER  NOT NULL,
  type         TEXT     DEFAULT 'manual',
  status       TEXT     DEFAULT 'done',
  note         TEXT     DEFAULT '',
  scheduled_at DATETIME,
  completed_at DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES orders(id) ON DELETE CASCADE
);
