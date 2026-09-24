export type GrantStatus = "offered" | "accepted" | "declined";

export type EquityGrant = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  grant_date: string;
  quantity: number;
  vesting_start: string;
  vesting_end: string;
  status: GrantStatus;
  decided_at: string | null;
  notes: string | null;
  vestingPercent: number;
};
