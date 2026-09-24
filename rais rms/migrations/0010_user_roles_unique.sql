-- 0010_user_roles_unique.sql
CREATE UNIQUE INDEX idx_uor_unique ON user_outlet_roles (tenant_id, user_id, outlet_id);
