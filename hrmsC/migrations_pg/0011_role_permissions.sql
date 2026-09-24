-- Per-tenant permission overrides for the hr/manager/employee roles.
-- 'admin' is deliberately excluded (CHECK) — it is a fixed superuser and
-- never appears here; worker/core/permissions.ts short-circuits it to
-- always-granted before this table is ever consulted.
--
-- Only deviations from the hardcoded default (worker/core/permissions.ts,
-- DEFAULT_GRANTED_ROLES per key) are stored here — no row means "use the
-- default," so adding a new permission key later needs no backfill for
-- existing tenants.
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL CHECK (role IN ('hr','manager','employee')),
  permission_key TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (tenant_id, role, permission_key)
);
CREATE INDEX idx_role_permissions_tenant ON role_permissions(tenant_id);
