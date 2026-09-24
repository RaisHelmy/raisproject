-- Track lead source metadata
ALTER TABLE orders ADD COLUMN domain   TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN referrer TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN browser  TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN device   TEXT DEFAULT '';
