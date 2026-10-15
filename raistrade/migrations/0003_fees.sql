-- moomoo Malaysia fees charged on each stock fill (in the instrument's price units).
ALTER TABLE orders ADD COLUMN fee REAL NOT NULL DEFAULT 0;
