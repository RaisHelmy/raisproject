-- 0011_notifications.sql (Postgres port)
CREATE TABLE notification_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  kind        TEXT NOT NULL,   -- e.g. 'reservation_confirmation', 'reservation_reminder', 'feedback_request', 'campaign'
  to_address  TEXT NOT NULL,
  reference_id TEXT,           -- e.g. reservation_id / campaign_id, for idempotency
  status      TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped_no_provider')),
  error       TEXT,
  created_at  BIGINT NOT NULL
);
CREATE INDEX idx_notif_tenant_kind_ref ON notification_log (tenant_id, kind, reference_id);
