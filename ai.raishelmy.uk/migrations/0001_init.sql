-- ai.raishelmy.uk control plane

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  key_prefix          TEXT NOT NULL,          -- displayable prefix, e.g. rais_sk_zakat_a8K2
  key_hash            TEXT NOT NULL UNIQUE,   -- sha256(full key), hex
  enabled             INTEGER NOT NULL DEFAULT 1,
  expires_at          INTEGER,                -- epoch seconds, NULL = never
  created_at          INTEGER NOT NULL,
  last_used_at        INTEGER,
  -- budget (USD, NULL = unlimited)
  daily_usd           REAL,
  weekly_usd          REAL,
  monthly_usd         REAL,
  on_limit            TEXT NOT NULL DEFAULT 'block',   -- block | fallback
  -- permissions
  allowed_models      TEXT NOT NULL DEFAULT '[]',      -- JSON array of model ids / aliases; [] = everything enabled
  default_model       TEXT NOT NULL DEFAULT 'auto',
  fallback_model      TEXT,                            -- used when on_limit = fallback
  requests_per_minute INTEGER,                         -- NULL = unlimited
  preset              TEXT NOT NULL DEFAULT 'custom'
);
CREATE INDEX IF NOT EXISTS api_keys_project ON api_keys(project_id);

CREATE TABLE IF NOT EXISTS models (
  id               TEXT PRIMARY KEY,   -- provider/model as accepted by AI Gateway compat endpoint
  provider         TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  input_usd_per_m  REAL NOT NULL DEFAULT 0,
  output_usd_per_m REAL NOT NULL DEFAULT 0,
  enabled          INTEGER NOT NULL DEFAULT 1,
  tags             TEXT NOT NULL DEFAULT '',  -- comma list: coding,cheap,reasoning,premium
  sort             INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS aliases (
  name        TEXT PRIMARY KEY,           -- e.g. auto/coding
  description TEXT NOT NULL DEFAULT '',
  candidates  TEXT NOT NULL DEFAULT '[]'  -- JSON array of model ids, tried in order
);

CREATE TABLE IF NOT EXISTS usage (
  id              TEXT PRIMARY KEY,   -- request id (also sent to AI Gateway as metadata.request_id)
  api_key_id      TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  model           TEXT NOT NULL,      -- model actually used (provider/model)
  provider        TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_usd        REAL NOT NULL DEFAULT 0,   -- our estimate from the pricing table
  cf_cost_usd     REAL,                      -- Cloudflare's figure, filled by cost sync
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  status          INTEGER NOT NULL,
  error           TEXT,
  streamed        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,   -- epoch seconds
  day             TEXT NOT NULL       -- YYYY-MM-DD in BUDGET_TIMEZONE
);
CREATE INDEX IF NOT EXISTS usage_key_time ON usage(api_key_id, created_at);
CREATE INDEX IF NOT EXISTS usage_project_time ON usage(project_id, created_at);
CREATE INDEX IF NOT EXISTS usage_time ON usage(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Global budgets (all projects combined). NULL/empty = no cap.
INSERT OR IGNORE INTO settings(key, value) VALUES ('global_daily_usd', '10');
INSERT OR IGNORE INTO settings(key, value) VALUES ('global_weekly_usd', '50');
INSERT OR IGNORE INTO settings(key, value) VALUES ('global_monthly_usd', '150');

-- Model catalog. Prices are USD per 1M tokens (Workers AI from the public price list,
-- Anthropic first-party list prices). Edit in the portal under Models.
INSERT OR IGNORE INTO models(id, provider, display_name, input_usd_per_m, output_usd_per_m, enabled, tags, sort) VALUES
  ('workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct',        'workers-ai', 'Qwen 2.5 Coder 32B',       0.660, 1.000, 1, 'coding,cheap',       10),
  ('workers-ai/@cf/qwen/qwen3-30b-a3b-fp8',                 'workers-ai', 'Qwen3 30B A3B',            0.051, 0.335, 1, 'cheap,fast',         11),
  ('workers-ai/@cf/qwen/qwen3.8-27b',                       'workers-ai', 'Qwen 3.8 27B',             0.450, 3.200, 1, 'reasoning',          12),
  ('workers-ai/@cf/qwen/qwq-32b',                           'workers-ai', 'QwQ 32B (reasoning)',      0.660, 1.000, 1, 'reasoning',          13),
  ('workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast',   'workers-ai', 'Llama 3.3 70B (fast)',     0.293, 2.253, 1, 'fast',               14),
  ('workers-ai/@cf/zai-org/glm-5.3-flash',                  'workers-ai', 'GLM 5.3 Flash',            0.150, 0.500, 1, 'cheap,fast,coding',  15),
  ('workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731',     'workers-ai', 'DeepSeek V4 Flash',        0.440, 1.320, 1, 'coding,cheap',       16),
  ('workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813',       'workers-ai', 'DeepSeek V4 Pro',          1.320, 3.960, 1, 'coding,reasoning',   17),
  ('anthropic/claude-sonnet-5',                             'anthropic',  'Claude Sonnet 5',          2.000, 10.000, 1, 'coding,premium',    20),
  ('anthropic/claude-opus-5',                               'anthropic',  'Claude Opus 5',            5.000, 25.000, 1, 'premium,reasoning', 21),
  ('anthropic/claude-haiku-4-5',                            'anthropic',  'Claude Haiku 4.5',         1.000, 5.000, 1, 'fast',               22),
  ('openai/gpt-5.2',                                        'openai',     'GPT-5.2',                  0.000, 0.000, 0, 'premium',            30),
  ('openrouter/qwen/qwen3-coder',                           'openrouter', 'Qwen3 Coder (OpenRouter)', 0.000, 0.000, 0, 'coding',             40);

INSERT OR IGNORE INTO aliases(name, description, candidates) VALUES
  ('auto',            'Sensible default: cheap Workers AI model, Claude Sonnet as fallback',
     '["workers-ai/@cf/qwen/qwen3-30b-a3b-fp8","workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast","anthropic/claude-sonnet-5"]'),
  ('auto/coding',     'Qwen Coder first, DeepSeek then Claude Sonnet if unavailable',
     '["workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct","workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731","anthropic/claude-sonnet-5"]'),
  ('auto/reasoning',  'Strong reasoning model with a cheaper fallback',
     '["anthropic/claude-opus-5","workers-ai/@cf/qwen/qwq-32b"]'),
  ('cheap',           'Cheapest usable chat model',
     '["workers-ai/@cf/qwen/qwen3-30b-a3b-fp8","workers-ai/@cf/zai-org/glm-5.3-flash"]'),
  ('fast',            'Lowest latency',
     '["workers-ai/@cf/zai-org/glm-5.3-flash","workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"]'),
  ('premium',         'Best quality regardless of price',
     '["anthropic/claude-opus-5","anthropic/claude-sonnet-5"]');
