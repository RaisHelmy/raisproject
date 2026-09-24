-- User suggestions: from any predefined content area (theories, strategies,
-- providers, markets…) users propose ideas; admins review, approve/reject
-- with a note, and may mark approved ones implemented when shipped.

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context TEXT NOT NULL DEFAULT 'general',  -- where the button was clicked
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | implemented
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, created_at ASC);
