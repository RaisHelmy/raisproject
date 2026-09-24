-- 0009_inventory_staff.sql
CREATE TABLE inventory_items (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  outlet_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL,
  qty_on_hand REAL NOT NULL DEFAULT 0,
  par_level   REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_inventory_tenant_outlet ON inventory_items (tenant_id, outlet_id);

CREATE TABLE inventory_movements (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  delta       REAL NOT NULL,
  reason      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_inv_move_tenant_item ON inventory_movements (tenant_id, item_id);

CREATE TABLE staff_shifts (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  outlet_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  role       TEXT NOT NULL
);
CREATE INDEX idx_staff_shifts_tenant_outlet ON staff_shifts (tenant_id, outlet_id, starts_at);
