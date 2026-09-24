-- 0004_reservations.sql (Postgres port)
CREATE TABLE reservations (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  outlet_id    TEXT NOT NULL,
  guest_id     TEXT,
  service_id   TEXT,
  starts_at    BIGINT NOT NULL,          -- epoch ms
  party_size   INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'booked'
               CHECK (status IN ('booked','seated','completed','no_show','cancelled')),
  source       TEXT NOT NULL DEFAULT 'widget',
  table_ids    TEXT,                       -- JSON array
  deposit_id   TEXT,
  notes        TEXT,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);
CREATE INDEX idx_res_tenant_outlet_time ON reservations (tenant_id, outlet_id, starts_at);
CREATE INDEX idx_res_tenant_guest       ON reservations (tenant_id, guest_id);
