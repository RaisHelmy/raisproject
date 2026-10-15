-- Trade cost engine: expected vs actual fill, spread/slippage, fee schedule version, realized net P/L.
ALTER TABLE orders ADD COLUMN expected_px REAL;
ALTER TABLE orders ADD COLUMN quote_ts INTEGER;
ALTER TABLE orders ADD COLUMN slippage REAL;
ALTER TABLE orders ADD COLUMN spread_cost REAL;
ALTER TABLE orders ADD COLUMN fee_version TEXT;
ALTER TABLE orders ADD COLUMN costs TEXT;
ALTER TABLE orders ADD COLUMN realized_gross REAL;
ALTER TABLE orders ADD COLUMN realized_net REAL;
ALTER TABLE positions ADD COLUMN fee_paid REAL NOT NULL DEFAULT 0;
