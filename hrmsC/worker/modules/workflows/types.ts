import type { Role } from "../../core/types";

export type ApproverType = "employee_manager" | "role" | "specific_user";
export type WorkflowStatus = "in_progress" | "approved" | "rejected" | "cancelled";
export type StepActionState = "pending" | "approved" | "rejected" | "skipped";

export type WorkflowDefinition = {
  id: string;
  tenant_id: string;
  module: string;
  name: string;
  category: string | null;
  min_amount: number | null;
  max_amount: number | null;
  is_default: number;
  is_active: number;
  created_at: string;
};

export type WorkflowStep = {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  manager_level: number;
  approver_role: Role | null;
  approver_user_id: string | null;
  created_at: string;
};

export type WorkflowInstance = {
  id: string;
  tenant_id: string;
  module: string;
  record_id: string;
  workflow_definition_id: string;
  current_step_order: number;
  status: WorkflowStatus;
  created_at: string;
  completed_at: string | null;
};

export type WorkflowStepAction = {
  id: string;
  tenant_id: string;
  workflow_instance_id: string;
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  resolved_approver_employee_id: string | null;
  resolved_approver_role: Role | null;
  action: StepActionState;
  acted_by_user_id: string | null;
  remarks: string | null;
  acted_at: string | null;
  created_at: string;
  reassigned_from_employee_id: string | null;
  reassignment_comment: string | null;
  reassigned_at: string | null;
};
