-- 0006_payments_tickets.sql
CREATE TABLE tickets_events (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  outlet_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  starts_at    INTEGER NOT NULL,
  price_minor  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'USD',
  capacity     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_events_tenant_outlet_time ON tickets_events (tenant_id, outlet_id, starts_at);

CREATE TABLE ticket_orders (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  guest_id      TEXT,
  quantity      INTEGER NOT NULL DEFAULT 1,
  total_minor   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','refunded')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_ticket_orders_tenant_event ON ticket_orders (tenant_id, event_id);

CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  outlet_id     TEXT NOT NULL,
  guest_id      TEXT,
  reservation_id TEXT,
  type          TEXT NOT NULL CHECK (type IN
                ('deposit','preauth','prepaid','cancellation_fee','order')),
  amount_minor  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  provider      TEXT NOT NULL DEFAULT 'stripe',
  provider_ref  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','authorized','captured','failed','refunded')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_payments_tenant_outlet ON payments (tenant_id, outlet_id);
CREATE INDEX idx_payments_tenant_res    ON payments (tenant_id, reservation_id);
