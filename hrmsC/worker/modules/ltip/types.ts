export type GrantStatus = "offered" | "accepted" | "declined";

export type EquityGrant = {
  id: string;
  tenant_id: string;
  employee_id: string;
  grant_date: string;
  quantity: number;
  vesting_start: string;
  vesting_end: string;
  status: GrantStatus;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
};
