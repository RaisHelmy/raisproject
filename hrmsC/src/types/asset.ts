export type AssetStatus = "available" | "assigned" | "maintenance" | "retired";

export type Asset = {
  id: string;
  asset_tag: string;
  name: string;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  status: AssetStatus;
  assigned_employee_id: string | null;
  notes: string | null;
  updated_at: string;
};

export type AssetAssignmentLog = {
  id: string;
  asset_id: string;
  employee_id: string | null;
  action: "assigned" | "returned" | "maintenance" | "retired" | "reinstated";
  remarks: string | null;
  actor_name: string | null;
  created_at: string;
};
