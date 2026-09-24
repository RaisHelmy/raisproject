export type Role =
  | "owner"
  | "group_admin"
  | "outlet_manager"
  | "host"
  | "server"
  | "marketing"
  | "read_only";

export type ReservationStatus =
  | "booked"
  | "seated"
  | "completed"
  | "no_show"
  | "cancelled";

export type ReservationSource =
  | "widget"
  | "google"
  | "instagram"
  | "facebook"
  | "phone"
  | "walkin";

export type OrderType = "dine_in" | "qr" | "takeaway" | "delivery";
export type OrderStatus = "open" | "placed" | "preparing" | "ready" | "completed" | "cancelled";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: number;
}

export interface Outlet {
  id: string;
  tenant_id: string;
  name: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  currency: string;
  settings: Record<string, unknown> | null;
  created_at: number;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  status: string;
  created_at: number;
}

export interface UserOutletRole {
  id: string;
  tenant_id: string;
  user_id: string;
  outlet_id: string;
  role: Role;
}

export interface Guest {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean;
  dob: string | null;
  created_at: number;
}

export interface GuestTag {
  id: string;
  tenant_id: string;
  guest_id: string;
  tag: string;
}

export interface Area {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
}

export interface RTable {
  id: string;
  tenant_id: string;
  outlet_id: string;
  area_id: string;
  label: string;
  seats_min: number;
  seats_max: number;
  x: number;
  y: number;
  combinable: boolean;
}

export interface ServiceShift {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  turn_time_by_party_size: Record<string, number> | null;
}

export interface Reservation {
  id: string;
  tenant_id: string;
  outlet_id: string;
  guest_id: string | null;
  service_id: string | null;
  starts_at: number;
  party_size: number;
  status: ReservationStatus;
  table_ids: string[];
  source: ReservationSource;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  outlet_id: string;
  guest_id: string | null;
  party_size: number;
  quoted_wait: number | null;
  status: "waiting" | "notified" | "seated" | "cancelled";
  created_at: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
