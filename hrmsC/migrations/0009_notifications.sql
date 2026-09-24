-- In-app notifications: the practical substitute for old_project's
-- Routing/CreateEmail-style email templates. No external email provider is
-- configured in this environment, so workflow events (a new approval
-- landed in your queue, your request was decided) surface here instead of
-- via email. See worker/modules/notifications/service.ts.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
