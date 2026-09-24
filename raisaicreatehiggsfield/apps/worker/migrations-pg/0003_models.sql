CREATE TABLE models (
  id TEXT PRIMARY KEY, -- e.g. "@cf/black-forest-labs/flux-1-schnell" or "vidu/q3-pro"
  provider TEXT NOT NULL DEFAULT 'cloudflare',
  hosting TEXT NOT NULL CHECK (hosting IN ('workers-ai','third-party')),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('image','video','audio','text','vision','embedding','utility')),
  task TEXT NOT NULL, -- e.g. "text-to-image", "image-to-video"
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_schema_json TEXT NOT NULL DEFAULT '{}',
  parameter_schema_json TEXT NOT NULL DEFAULT '[]',
  limits_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered','configured','enabled','deprecated')),
  tags_json TEXT NOT NULL DEFAULT '[]',
  doc_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '1',
  discovered_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_models_status_task ON models(status, task);
CREATE INDEX idx_models_category ON models(category, status);

CREATE TABLE model_pricing (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id),
  effective_from TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  unit TEXT NOT NULL CHECK (unit IN ('tile_step','megapixel_tiered','tokens','audio_minute','characters','video_seconds','flat')),
  provider_price_json TEXT NOT NULL DEFAULT '{}', -- admin only: USD rates per unit
  markup_percent REAL NOT NULL DEFAULT 20,
  minimum_charge_sen INTEGER NOT NULL DEFAULT 1,
  rounding_sen INTEGER NOT NULL DEFAULT 1,
  fx_rate_usd_myr REAL NOT NULL DEFAULT 4.70,
  currency TEXT NOT NULL DEFAULT 'MYR',
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX idx_model_pricing_model ON model_pricing(model_id, effective_from);

CREATE TABLE model_favorites (
  user_id TEXT NOT NULL REFERENCES users(id),
  model_id TEXT NOT NULL REFERENCES models(id),
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  PRIMARY KEY (user_id, model_id)
);

CREATE TABLE model_usage_stats (
  model_id TEXT NOT NULL REFERENCES models(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  day TEXT NOT NULL, -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  spent_sen INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (model_id, org_id, day)
);
CREATE INDEX idx_model_usage_org_day ON model_usage_stats(org_id, day);
