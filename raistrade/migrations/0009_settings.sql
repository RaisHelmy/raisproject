-- Key/value settings (e.g. the secret key for the shared read-only performance report).
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
