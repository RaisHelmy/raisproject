-- 0001_init.sql
CREATE TABLE tenants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'trial',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  created_at INTEGER NOT NULL
);

CREATE TABLE outlets (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  address    TEXT,
  phone      TEXT,
  currency   TEXT NOT NULL DEFAULT 'USD',
  settings   TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_outlets_tenant ON outlets (tenant_id);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_users_tenant_email ON users (tenant_id, email);

CREATE TABLE user_outlet_roles (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  outlet_id  TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN
    ('owner','group_admin','outlet_manager','host','server','marketing','read_only')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_uor_tenant_user   ON user_outlet_roles (tenant_id, user_id);
CREATE INDEX idx_uor_tenant_outlet ON user_outlet_roles (tenant_id, outlet_id);

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  user_id    TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  at         INTEGER NOT NULL
);
CREATE INDEX idx_audit_tenant_at ON audit_log (tenant_id, at);
