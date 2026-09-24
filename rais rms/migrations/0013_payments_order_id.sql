-- 0013_payments_order_id.sql
ALTER TABLE payments ADD COLUMN order_id TEXT;
CREATE INDEX idx_payments_tenant_order ON payments (tenant_id, order_id);
