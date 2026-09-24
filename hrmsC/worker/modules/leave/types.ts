import type { ApplicationStatus } from "../../core/types";

export type LeaveType = {
  id: string;
  tenant_id: string;
  name: string;
  default_entitlement_days: number;
  requires_attachment: number;
  is_active: number;
  created_at: string;
};

export type LeaveBalance = {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  created_at: string;
};

export type LeaveQuotaGrant = {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  granted_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
  granted_by_user_id: string | null;
};

export type LeaveEncashment = {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type_id: string;
  days: number;
  daily_rate: number;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
};

export type LeaveApplication = {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
};
