-- Cancelling a run (§24, §57).
--
-- A separate column rather than a status change, because the run is not
-- cancelled the moment someone asks: the durable runner has to notice, stop
-- scheduling work, and settle whatever the provider already produced. Until
-- that happens the status still says what is genuinely true.
ALTER TABLE workflow_runs ADD COLUMN cancel_requested_at TEXT;
