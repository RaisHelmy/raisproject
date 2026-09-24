-- Personal API tokens for programmatic wealth access (REST + MCP).
-- Only the SHA-256 hash is stored; the plaintext token is shown once.

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,                 -- display-only, e.g. "rfk_1a2b3c4d"
  scopes TEXT NOT NULL DEFAULT 'read',  -- comma list: read | trade
  last_used_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
