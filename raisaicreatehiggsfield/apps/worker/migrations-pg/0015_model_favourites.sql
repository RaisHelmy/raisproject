-- Favourite models, and what a person actually reaches for (§90).
--
-- Per user rather than per organization: two people sharing a workspace do not
-- share taste. `last_used_at` is written by the generation path, which is what
-- makes "recently used" real rather than a guess from history queries.
CREATE TABLE model_favourites (
  user_id TEXT NOT NULL REFERENCES users(id),
  model_id TEXT NOT NULL REFERENCES models(id),
  favourite INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, model_id)
);
CREATE INDEX idx_model_favourites_user ON model_favourites(user_id, favourite);
