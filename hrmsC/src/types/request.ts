import type { ApplicationStatus } from "./common";

export type RequestType = {
  id: string;
  name: string;
  description: string | null;
  requires_amount: number;
  requires_attachment: number;
  is_active: number;
};

export type EmployeeRequest = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  request_type_id: string;
  request_type_name?: string;
  title: string;
  amount: number | null;
  details: string | null;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
  step_name?: string;
};
