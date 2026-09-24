import type { Role } from "./common";

export type ApproverType = "employee_manager" | "role" | "specific_user";
export type WorkflowStatus = "in_progress" | "approved" | "rejected" | "cancelled";
export type StepActionState = "pending" | "approved" | "rejected" | "skipped";

export type WorkflowStep = {
  id: string;
  workflow_definition_id: string;
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  manager_level: number;
  approver_role: Role | null;
  approver_user_id: string | null;
};

export type WorkflowDefinition = {
  id: string;
  module: string;
  name: string;
  category: string | null;
  min_amount: number | null;
  max_amount: number | null;
  is_default: number;
  is_active: number;
  created_at: string;
  steps: WorkflowStep[];
};

export type WorkflowInstance = {
  id: string;
  module: string;
  record_id: string;
  workflow_definition_id: string;
  current_step_order: number;
  status: WorkflowStatus;
  created_at: string;
  completed_at: string | null;
};

export type WorkflowInstanceListItem = WorkflowInstance & {
  employee_name: string | null;
  employee_no: string | null;
  record_label: string | null;
};

export type WorkflowStepActionEntry = {
  id: string;
  workflow_instance_id: string;
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  resolved_approver_employee_id: string | null;
  resolved_approver_role: Role | null;
  action: StepActionState;
  acted_by_user_id: string | null;
  acted_by_name: string | null;
  remarks: string | null;
  acted_at: string | null;
  reassigned_from_employee_id: string | null;
  reassigned_from_name: string | null;
  reassignment_comment: string | null;
  reassigned_at: string | null;
};

export type ReassignableTask = {
  id: string;
  workflow_instance_id: string;
  module: string;
  step_name: string;
  applicant_employee_id: string;
  applicant_name: string;
  applicant_no: string;
  record_label: string | null;
  created_at: string;
};
