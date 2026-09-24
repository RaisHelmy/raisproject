-- 0005_waitlist.sql (Postgres port)
CREATE TABLE waitlist_entries (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  outlet_id   TEXT NOT NULL,
  guest_id    TEXT,
  party_size  INTEGER NOT NULL,
  quoted_wait INTEGER,
  status      TEXT NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting','notified','seated','cancelled')),
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
CREATE INDEX idx_wait_tenant_outlet_status ON waitlist_entries (tenant_id, outlet_id, status);
