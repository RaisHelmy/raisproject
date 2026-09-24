import type { ApplicationStatus } from "./common";

export type ClaimType = {
  id: string;
  name: string;
  is_mileage: number;
  mileage_rate: number | null;
  is_advance: number;
  requires_attachment: number;
  is_active: number;
};

export type Claim = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  claim_type: string;
  claim_type_id: string | null;
  amount: number;
  currency: string;
  claim_date: string;
  description: string | null;
  distance: number | null;
  is_advance: number;
  status: ApplicationStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
  step_name?: string;
};
