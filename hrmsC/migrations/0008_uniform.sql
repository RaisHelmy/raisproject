CREATE TABLE uniform_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  category TEXT,
  available_sizes TEXT NOT NULL, -- comma-separated, e.g. "S,M,L,XL"
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_uniform_items_tenant ON uniform_items(tenant_id);

CREATE TABLE uniform_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_at TEXT,
  decision_remarks TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  workflow_instance_id TEXT REFERENCES workflow_instances(id)
);
CREATE INDEX idx_uniform_orders_tenant ON uniform_orders(tenant_id);
CREATE INDEX idx_uniform_orders_employee ON uniform_orders(employee_id);

CREATE TABLE uniform_order_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  order_id TEXT NOT NULL REFERENCES uniform_orders(id),
  uniform_item_id TEXT NOT NULL REFERENCES uniform_items(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_uniform_order_lines_order ON uniform_order_lines(order_id);
