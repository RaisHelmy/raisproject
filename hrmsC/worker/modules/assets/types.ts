export type AssetStatus = "available" | "assigned" | "maintenance" | "retired";
export type AssetLogAction = "assigned" | "returned" | "maintenance" | "retired" | "reinstated";

export type Asset = {
  id: string;
  tenant_id: string;
  asset_tag: string;
  name: string;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  status: AssetStatus;
  assigned_employee_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetAssignmentLog = {
  id: string;
  tenant_id: string;
  asset_id: string;
  employee_id: string | null;
  action: AssetLogAction;
  remarks: string | null;
  actor_user_id: string | null;
  created_at: string;
};
