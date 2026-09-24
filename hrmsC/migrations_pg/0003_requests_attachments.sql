-- Generic file attachments, reusable across any module (leave applications,
-- claims, employee requests, ...) via (module, record_id) — mirrors
-- old_project's Attachment/Attachment1/SubAttachment pattern that nearly
-- every module partial reused, rather than one attachments table per module.
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_attachments_record ON attachments(module, record_id);
CREATE INDEX idx_attachments_tenant ON attachments(tenant_id);

-- Generic, admin-configurable "employee request" — covers every old_project
-- module that is really just [form + optional amount + attachment + routed
-- approval + history] with its own field set swapped out: Allowance, Loan,
-- Medical Board, Death Donation, Verification Letter, Mobility, Temporary
-- Position, Contract Absorption, ETK/EMS, ETransfer, GenCoLetter,
-- ServiceAcceptance. Admins define a request_type per need (name doubles as
-- the workflow-routing category) instead of each getting bespoke tables.
CREATE TABLE request_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  requires_amount INTEGER NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);
CREATE INDEX idx_request_types_tenant ON request_types(tenant_id);

CREATE TABLE employee_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  request_type_id TEXT NOT NULL REFERENCES request_types(id),
  title TEXT NOT NULL,
  amount REAL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_at TEXT,
  decision_remarks TEXT,
  applied_at TEXT NOT NULL DEFAULT (now()::text),
  workflow_instance_id TEXT REFERENCES workflow_instances(id)
);
CREATE INDEX idx_employee_requests_tenant ON employee_requests(tenant_id);
CREATE INDEX idx_employee_requests_employee ON employee_requests(employee_id);
