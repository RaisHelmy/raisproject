export type OvertimeRequest = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  work_date: string;
  hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
  step_name?: string;
};
