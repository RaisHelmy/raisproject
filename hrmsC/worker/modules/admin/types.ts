export type AuditLog = {
  id: string;
  tenant_id: string;
  module: string;
  record_id: string;
  action: string;
  actor_user_id: string | null;
  remarks: string | null;
  created_at: string;
};
