-- 0002_guests.sql (Postgres port)
-- marketing_consent stays INTEGER (0/1): app code binds/reads 1/0, not
-- true/false, so keeping it INTEGER avoids touching every call site.
CREATE TABLE guests (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  name               TEXT NOT NULL,
  email              TEXT,
  phone              TEXT,
  marketing_consent  INTEGER NOT NULL DEFAULT 0,
  dob                TEXT,
  created_at         BIGINT NOT NULL,
  updated_at         BIGINT NOT NULL
);
CREATE INDEX idx_guests_tenant       ON guests (tenant_id);
CREATE INDEX idx_guests_tenant_email ON guests (tenant_id, email);
CREATE INDEX idx_guests_tenant_phone ON guests (tenant_id, phone);

CREATE TABLE guest_tags (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guest_id  TEXT NOT NULL,
  tag       TEXT NOT NULL
);
CREATE INDEX idx_guest_tags_tenant_guest ON guest_tags (tenant_id, guest_id);

CREATE TABLE guest_notes (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  guest_id   TEXT NOT NULL,
  author_id  TEXT,
  note       TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_guest_notes_tenant_guest ON guest_notes (tenant_id, guest_id);
