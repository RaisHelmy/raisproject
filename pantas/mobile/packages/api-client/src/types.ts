export type Role = "purchaser" | "runner" | "vendor" | "admin";

export interface Me {
  userId: string;
  activeRole: Role;
  roles: Role[];
}

export interface AuthResult {
  userId: string;
  handle: string;
  role: Role;
  sessionId: string;
}

export type JobType = "food_order" | "item_order" | "fetch" | "delivery" | "ride";
export type JobStatus =
  | "draft"
  | "posted"
  | "claimed"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "settled"
  | "cancelled"
  | "disputed";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  paymentMethod: "cash" | "gateway";
  deliveryFeeMinor: number;
  purchaserUserId: string;
  runnerUserId: string | null;
  vendorId: string | null;
  isAnonymousJob: boolean;
  createdAt: string;
}

export interface Offer {
  id: string;
  jobId: string;
  runnerUserId: string;
  proposedFeeMinor: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "expired";
}

export type VehicleType = "motorcycle" | "car";
export type CarSegment = "hatchback" | "sedan" | "suv" | "mpv" | "pickup" | "van";
export type AircondCondition = "excellent" | "good" | "fair" | "poor";

export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  plateNumber: string;
  segment: CarSegment | null;
  seatCount: number | null;
  leatherSeats: boolean;
  aircondCondition: AircondCondition | null;
  active: boolean;
}

export interface PayoutBatch {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalPayableMinor: number;
  totalFeesDeductedMinor: number;
  status: "pending" | "processing" | "paid" | "failed";
}

export interface Vendor {
  id: string;
  businessName: string;
  status: "active" | "suspended";
}

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  priceMinor: number;
  active: boolean;
}

export interface VendorContract {
  id: string;
  pricePerMealMinor: number;
  mealTime: string;
  status: "negotiating" | "active" | "ended" | "cancelled";
}

export interface VendorContractOffer {
  id: string;
  contractId: string;
  proposedPricePerMealMinor: number;
  proposedByRole: "group" | "vendor";
  status: "pending" | "accepted" | "rejected" | "withdrawn";
}

export interface RentalListing {
  id: string;
  ownerUserId: string;
  vehicleId: string;
  dailyRateMinor: number;
  declaredDepositMinor: number | null;
  active: boolean;
}

export interface RentalBooking {
  id: string;
  listingId: string;
  renterUserId: string;
  totalFeeMinor: number;
  status: "requested" | "accepted" | "rejected" | "active" | "completed" | "cancelled" | "disputed";
}

export interface SosIncident {
  id: string;
  jobId: string;
  triggeredByUserId: string;
  status: "triggered" | "acknowledged" | "resolved";
  createdAt: string;
}
