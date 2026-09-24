import type { ApplicationStatus } from "../../core/types";

export type RequestType = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  requires_amount: number;
  requires_attachment: number;
  is_active: number;
  created_at: string;
};

export type EmployeeRequest = {
  id: string;
  tenant_id: string;
  employee_id: string;
  request_type_id: string;
  title: string;
  amount: number | null;
  details: string | null;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
};
