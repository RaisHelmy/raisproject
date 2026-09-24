import type { ApplicationStatus } from "../../core/types";

export type ClaimType = {
  id: string;
  tenant_id: string;
  name: string;
  is_mileage: number;
  mileage_rate: number | null;
  is_advance: number;
  requires_attachment: number;
  is_active: number;
  created_at: string;
};

export type Claim = {
  id: string;
  tenant_id: string;
  employee_id: string;
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
};
