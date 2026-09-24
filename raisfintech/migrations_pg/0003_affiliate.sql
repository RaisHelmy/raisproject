-- Affiliate & gamification: referral codes, points ledger, achievements.

ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by TEXT; -- user id of the referrer

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_refcode ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Every point earned is a ledger entry — auditable, never recomputed away.
CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,       -- e.g. 'achievement:first-trade', 'referral-joined'
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON points_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL DEFAULT (now()),
  PRIMARY KEY (user_id, achievement_id)
);
