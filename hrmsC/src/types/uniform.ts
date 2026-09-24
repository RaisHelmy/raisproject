import type { ApplicationStatus } from "./common";

export type UniformItem = {
  id: string;
  name: string;
  category: string | null;
  available_sizes: string;
  is_active: number;
};

export type UniformOrderLine = {
  id: string;
  uniform_item_id: string;
  item_name: string;
  size: string;
  quantity: number;
};

export type UniformOrder = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
  step_name?: string;
  lines: UniformOrderLine[];
};
