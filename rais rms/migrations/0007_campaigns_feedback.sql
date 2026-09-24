-- 0007_campaigns_feedback.sql
CREATE TABLE campaigns (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  segment    TEXT,             -- JSON
  trigger    TEXT NOT NULL CHECK (trigger IN ('birthday','winback','top_spender','manual')),
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_campaigns_tenant ON campaigns (tenant_id);

CREATE TABLE campaign_sends (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  campaign_id   TEXT NOT NULL,
  guest_id      TEXT NOT NULL,
  sent_at       INTEGER NOT NULL,
  opened        INTEGER NOT NULL DEFAULT 0,
  converted     INTEGER NOT NULL DEFAULT 0,
  revenue_minor INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sends_tenant_campaign ON campaign_sends (tenant_id, campaign_id);

CREATE TABLE feedback (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  outlet_id      TEXT NOT NULL,
  reservation_id TEXT,
  guest_id       TEXT,
  scores         TEXT,          -- JSON {ambiance, service, value, food}
  comment        TEXT,
  is_private     INTEGER NOT NULL DEFAULT 1,
  routed_to_public INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_feedback_tenant_outlet ON feedback (tenant_id, outlet_id);
