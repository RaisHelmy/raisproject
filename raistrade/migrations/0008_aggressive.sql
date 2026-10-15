-- Aggressive investment mode: per-session toggle; robots added by it are flagged so they can be paused/resumed together.
ALTER TABLE sessions ADD COLUMN aggressive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rules ADD COLUMN aggressive INTEGER NOT NULL DEFAULT 0;
