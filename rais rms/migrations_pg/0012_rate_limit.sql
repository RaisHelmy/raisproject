-- 0012_rate_limit.sql (Postgres port)
CREATE TABLE rate_limit_buckets (
  bucket_key   TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL
);
