export type Role = "admin" | "hr" | "manager" | "employee";
export type ApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AuthUser = {
  userId: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
  email: string;
  name: string;
  simulatedByUserId: string | null;
  simulatedByName: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export type AuditLogEntry = {
  id: string;
  module: string;
  record_id: string;
  action: string;
  actor_name: string | null;
  remarks: string | null;
  created_at: string;
};

export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: number;
  created_at: string;
};

export type Attachment = {
  id: string;
  module: string;
  record_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by_user_id: string | null;
  created_at: string;
};
