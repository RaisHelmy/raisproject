export type VendorStatus = "active" | "inactive";

export type Vendor = {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: VendorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
