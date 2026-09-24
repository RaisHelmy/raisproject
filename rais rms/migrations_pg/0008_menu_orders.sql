-- 0008_menu_orders.sql (Postgres port)
CREATE TABLE menus (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  outlet_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_menus_tenant_outlet ON menus (tenant_id, outlet_id);

CREATE TABLE menu_sections (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  menu_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_menu_sections_tenant_menu ON menu_sections (tenant_id, menu_id);

CREATE TABLE menu_items (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  section_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  price_minor  INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'USD',
  tags         TEXT,          -- JSON array
  image_r2_key TEXT,
  available    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_menu_items_tenant_section ON menu_items (tenant_id, section_id);

CREATE TABLE orders (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  outlet_id   TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('dine_in','qr','takeaway','delivery')),
  table_id    TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','placed','preparing','ready','completed','cancelled')),
  total_minor INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
CREATE INDEX idx_orders_tenant_outlet ON orders (tenant_id, outlet_id, created_at);

CREATE TABLE order_items (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  order_id      TEXT NOT NULL,
  menu_item_id  TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  modifiers     TEXT,        -- JSON
  price_minor   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_items_tenant_order ON order_items (tenant_id, order_id);
