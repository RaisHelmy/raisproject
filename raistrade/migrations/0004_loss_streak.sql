-- Auto-stop now triggers on consecutive losses instead of a success-rate threshold.
ALTER TABLE rules ADD COLUMN loss_streak INTEGER NOT NULL DEFAULT 0;
