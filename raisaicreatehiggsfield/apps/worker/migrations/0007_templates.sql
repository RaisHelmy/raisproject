CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  preview_asset_id TEXT REFERENCES assets(id),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  current_version INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_sen INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_templates_org ON templates(org_id, deleted_at);
CREATE INDEX idx_templates_visibility ON templates(visibility, category);

-- Immutable once published (invariant 2 / §54).
CREATE TABLE template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  version INTEGER NOT NULL,
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  variables_json TEXT NOT NULL DEFAULT '[]', -- declared inputs: name,type,label,required,default
  model_preferences_json TEXT NOT NULL DEFAULT '{}',
  changelog TEXT,
  published_by TEXT NOT NULL REFERENCES users(id),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (template_id, version)
);
