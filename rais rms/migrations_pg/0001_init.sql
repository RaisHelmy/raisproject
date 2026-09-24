-- 0001_init.sql (Postgres port of migrations/0001_init.sql)
--
-- These migrations create UNQUALIFIED tables (no schema prefix) and rely on
-- the connection's search_path to land them in the right place. This app's
-- tables live in schema `raisrms` inside the shared `raishelmy` Postgres
-- database (one DB, one schema per app account-wide) — NOT `public`. If
-- re-running these against `raishelmy`, first `CREATE SCHEMA IF NOT EXISTS
-- raisrms;` and `SET search_path TO raisrms;` (or pass
-- `?options=-c%20search_path=raisrms` / use `bun run db:migrate`, which sets
-- this for you — see package.json). The schema+tables already exist from a
-- dump/restore as of 2026-09, so these do not need to be re-applied normally.
--
-- Timestamp columns (epoch ms, from Date.now()) are BIGINT: SQLite's INTEGER
-- is a flexible 64-bit affinity, but Postgres's INTEGER is 32-bit (max ~2.1B)
-- and epoch-ms values (~1.7e12 today) would overflow it.
CREATE TABLE tenants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'trial',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  created_at BIGINT NOT NULL
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
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_outlets_tenant ON outlets (tenant_id);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at    BIGINT NOT NULL
);
CREATE UNIQUE INDEX idx_users_tenant_email ON users (tenant_id, email);

CREATE TABLE user_outlet_roles (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  outlet_id  TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN
    ('owner','group_admin','outlet_manager','host','server','marketing','read_only')),
  created_at BIGINT NOT NULL
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
  at         BIGINT NOT NULL
);
CREATE INDEX idx_audit_tenant_at ON audit_log (tenant_id, at);
