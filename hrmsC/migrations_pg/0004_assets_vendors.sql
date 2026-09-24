-- Company asset registry + assignment tracking (old_project's `Asset`
-- module). Distinct from the generic Requests module because it needs a
-- real inventory (assets exist and have a lifecycle independent of any one
-- request), not just a form-and-approve flow.
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  asset_tag TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  purchase_value REAL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','assigned','maintenance','retired')),
  assigned_employee_id TEXT REFERENCES employees(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE UNIQUE INDEX idx_assets_tenant_tag ON assets(tenant_id, asset_tag);
CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_assets_assigned ON assets(assigned_employee_id);

CREATE TABLE asset_assignment_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  asset_id TEXT NOT NULL REFERENCES assets(id),
  employee_id TEXT REFERENCES employees(id),
  action TEXT NOT NULL CHECK (action IN ('assigned','returned','maintenance','retired','reinstated')),
  remarks TEXT,
  actor_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_asset_logs_asset ON asset_assignment_logs(asset_id);
CREATE INDEX idx_asset_logs_tenant ON asset_assignment_logs(tenant_id);

-- Vendor registry (old_project's `Vendor` module, e.g. the "iDispensary"
-- panel-clinic listing). A simpler master-data registry, no workflow.
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  category TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_vendors_tenant ON vendors(tenant_id);
