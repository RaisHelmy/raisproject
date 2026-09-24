-- Per-bucket accounting effects for every ledger entry.
--
-- Without these, `balances` cannot be reconstructed from `balance_transactions`:
-- a charge settled against a reservation reduces `reserved`, while an overage
-- charge reduces `available`, and `type` alone cannot tell the two apart.
-- With them the invariant is exact:
--   available_sen = SUM(available_delta_sen)
--   reserved_sen  = SUM(reserved_delta_sen)
ALTER TABLE balance_transactions ADD COLUMN available_delta_sen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE balance_transactions ADD COLUMN reserved_delta_sen INTEGER NOT NULL DEFAULT 0;
