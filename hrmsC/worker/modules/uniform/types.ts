import type { ApplicationStatus } from "../../core/types";

export type UniformItem = {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  available_sizes: string;
  is_active: number;
  created_at: string;
};

export type UniformOrder = {
  id: string;
  tenant_id: string;
  employee_id: string;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
};

export type UniformOrderLine = {
  id: string;
  tenant_id: string;
  order_id: string;
  uniform_item_id: string;
  size: string;
  quantity: number;
};
