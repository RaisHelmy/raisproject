-- 0003_floor.sql
CREATE TABLE areas (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  name      TEXT NOT NULL
);
CREATE INDEX idx_areas_tenant_outlet ON areas (tenant_id, outlet_id);

CREATE TABLE tables (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  outlet_id  TEXT NOT NULL,
  area_id    TEXT NOT NULL,
  label      TEXT NOT NULL,
  seats_min  INTEGER NOT NULL DEFAULT 1,
  seats_max  INTEGER NOT NULL DEFAULT 4,
  x          REAL NOT NULL DEFAULT 0,
  y          REAL NOT NULL DEFAULT 0,
  combinable INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_tables_tenant_outlet ON tables (tenant_id, outlet_id);
CREATE INDEX idx_tables_tenant_area   ON tables (tenant_id, area_id);

CREATE TABLE services (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  outlet_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  days_of_week  TEXT NOT NULL,   -- JSON array of 0-6
  start_time    TEXT NOT NULL,   -- HH:MM
  end_time      TEXT NOT NULL,   -- HH:MM
  turn_time_by_party_size TEXT   -- JSON map
);
CREATE INDEX idx_services_tenant_outlet ON services (tenant_id, outlet_id);
