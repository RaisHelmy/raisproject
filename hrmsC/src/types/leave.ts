import type { ApplicationStatus } from "./common";

export type LeaveType = {
  id: string;
  name: string;
  default_entitlement_days: number;
  requires_attachment: number;
  is_active: number;
};

export type LeaveBalanceEntry = {
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
};

export type LeaveQuotaGrant = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  leave_type_id: string;
  leave_type_name?: string;
  year: number;
  granted_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
  step_name?: string;
};

export type LeaveEncashment = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  leave_type_id: string;
  leave_type_name?: string;
  days: number;
  daily_rate: number;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
  step_name?: string;
};

export type LeaveCalendarEntry = {
  id: string;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  days: number;
  leave_type_name: string;
};

export type LeaveApplication = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name?: string;
  employee_name?: string;
  employee_no?: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
  step_name?: string;
};
