import type { Role } from "../../core/types";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  is_active: number;
  created_at: string;
};
