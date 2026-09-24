export type OvertimeRequest = {
  id: string;
  tenant_id: string;
  employee_id: string;
  work_date: string;
  hours: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_remarks: string | null;
  workflow_instance_id: string | null;
  applied_at: string;
};
