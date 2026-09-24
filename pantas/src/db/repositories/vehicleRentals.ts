import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { vehicleRentalBookings, vehicleRentalListings } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

export type RentalBookingStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "active"
  | "completed"
  | "cancelled"
  | "disputed";

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export interface CreateListingInput {
  ownerUserId: string;
  vehicleId: string;
  groupId?: string | null;
  dailyRateMinor: number;
  declaredDepositMinor?: number;
}

export async function createListing(db: Db, input: CreateListingInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    ownerUserId: input.ownerUserId,
    vehicleId: input.vehicleId,
    groupId: input.groupId ?? null,
    dailyRateMinor: input.dailyRateMinor,
    declaredDepositMinor: input.declaredDepositMinor ?? null,
    active: true,
  };
  return withAudit(
    db,
    { action: "rental_listing.create", entityType: "vehicle_rental_listing", entityId: row.id },
    async () => {
      await db.insert(vehicleRentalListings).values(row);
      return row;
    },
  );
}

export async function listActiveListings(db: Db, groupId: string | null) {
  const rows = await db
    .select()
    .from(vehicleRentalListings)
    .where(groupScope(vehicleRentalListings.groupId, groupId));
  return rows.filter((r) => r.active);
}

export async function getListingById(db: Db, listingId: string) {
  const rows = await db
    .select()
    .from(vehicleRentalListings)
    .where(eq(vehicleRentalListings.id, listingId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setListingActive(db: Db, listingId: string, active: boolean) {
  return withAudit(
    db,
    { action: "rental_listing.set_active", entityType: "vehicle_rental_listing", entityId: listingId },
    async () => {
      await db
        .update(vehicleRentalListings)
        .set({ active, updatedAt: nowIso() })
        .where(eq(vehicleRentalListings.id, listingId));
      return { listingId, active };
    },
  );
}

// ---------------------------------------------------------------------------
// Bookings — a small validated state machine, same discipline as jobs.
// requested -> accepted -> active -> completed
//           -> rejected
// {requested, accepted} -> cancelled
// {active} -> disputed
// ---------------------------------------------------------------------------

const ALLOWED_BOOKING_TRANSITIONS: Record<RentalBookingStatus, RentalBookingStatus[]> = {
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["active", "cancelled"],
  rejected: [],
  active: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: [],
};

export interface CreateBookingInput {
  listingId: string;
  renterUserId: string;
  groupId?: string | null;
  startDate: string;
  endDate: string;
  totalFeeMinor: number;
  paymentMethod: "cash" | "gateway";
}

export async function requestBooking(db: Db, input: CreateBookingInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    listingId: input.listingId,
    renterUserId: input.renterUserId,
    groupId: input.groupId ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    totalFeeMinor: input.totalFeeMinor,
    paymentMethod: input.paymentMethod,
    commissionMinor: null,
    status: "requested" as const,
    requestedAt: now,
    acceptedAt: null,
    activeAt: null,
    completedAt: null,
    cancelledAt: null,
  };
  return withAudit(
    db,
    { action: "rental_booking.request", entityType: "vehicle_rental_booking", entityId: row.id },
    async () => {
      await db.insert(vehicleRentalBookings).values(row);
      return row;
    },
  );
}

export async function getBookingById(db: Db, bookingId: string) {
  const rows = await db
    .select()
    .from(vehicleRentalBookings)
    .where(eq(vehicleRentalBookings.id, bookingId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listBookingsForRenter(db: Db, renterUserId: string) {
  return db
    .select()
    .from(vehicleRentalBookings)
    .where(eq(vehicleRentalBookings.renterUserId, renterUserId));
}

async function transitionBooking(
  db: Db,
  bookingId: string,
  to: RentalBookingStatus,
  timestampColumn: string | null,
) {
  const booking = await getBookingById(db, bookingId);
  if (!booking) throw new Error(`rental booking ${bookingId} not found`);
  if (!ALLOWED_BOOKING_TRANSITIONS[booking.status as RentalBookingStatus].includes(to)) {
    throw new Error(`invalid rental booking transition: ${booking.status} -> ${to}`);
  }
  const now = nowIso();
  const set: Record<string, unknown> = { status: to, updatedAt: now };
  if (timestampColumn) set[timestampColumn] = now;
  await db.update(vehicleRentalBookings).set(set).where(eq(vehicleRentalBookings.id, bookingId));
  return { ...booking, ...set };
}

export async function acceptBooking(db: Db, bookingId: string) {
  return withAudit(
    db,
    { action: "rental_booking.accept", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "accepted", "acceptedAt"),
  );
}

export async function rejectBooking(db: Db, bookingId: string) {
  return withAudit(
    db,
    { action: "rental_booking.reject", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "rejected", null),
  );
}

export async function activateBooking(db: Db, bookingId: string) {
  return withAudit(
    db,
    { action: "rental_booking.activate", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "active", "activeAt"),
  );
}

export async function cancelBooking(db: Db, bookingId: string) {
  return withAudit(
    db,
    { action: "rental_booking.cancel", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "cancelled", "cancelledAt"),
  );
}

export async function disputeBooking(db: Db, bookingId: string) {
  return withAudit(
    db,
    { action: "rental_booking.dispute", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "disputed", null),
  );
}

/** Marks the booking row `completed` only — commission ledger entries are composed in src/db/services/rentalSettlement.ts. */
export async function markBookingCompleted(db: Db, bookingId: string, commissionMinor: number) {
  return withAudit(
    db,
    { action: "rental_booking.complete", entityType: "vehicle_rental_booking", entityId: bookingId },
    () => transitionBooking(db, bookingId, "completed", "completedAt").then(async (b) => {
      await db
        .update(vehicleRentalBookings)
        .set({ commissionMinor })
        .where(eq(vehicleRentalBookings.id, bookingId));
      return { ...b, commissionMinor };
    }),
  );
}
