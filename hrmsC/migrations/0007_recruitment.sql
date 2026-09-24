CREATE TABLE job_postings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  department TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closing_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_job_postings_tenant ON job_postings(tenant_id);

-- Internal application pipeline: the applicant must be an existing employee
-- (this is an internal-mobility board, not a public careers site with
-- anonymous applicants — see CLAUDE.md for that scope call).
CREATE TABLE job_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  posting_id TEXT NOT NULL REFERENCES job_postings(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  cover_note TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','screening','interview','offered','rejected','hired','withdrawn')),
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_job_applications_tenant ON job_applications(tenant_id);
CREATE INDEX idx_job_applications_posting ON job_applications(posting_id);
CREATE INDEX idx_job_applications_employee ON job_applications(employee_id);
