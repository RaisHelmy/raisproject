import type { Db } from "../client";
import { getBookingById, getListingById, markBookingCompleted } from "../repositories/vehicleRentals";
import { getCommissionAmountMinor } from "../repositories/commissionRules";
import { writeBalancedLedgerEntries } from "../repositories/ledger";

/**
 * Completing a rental accrues the flat commission against the vehicle
 * owner exactly like a cash job's fee (CLAUDE.md "Vehicle rental
 * (peer-to-peer)") — the rental fee itself is settled directly between
 * owner and renter, off-platform, same as any cash job. No deposit
 * handling here; the platform never touches it (see the compliance note).
 */
export async function settleRentalBooking(db: Db, bookingId: string) {
  const booking = await getBookingById(db, bookingId);
  if (!booking) throw new Error(`rental booking ${bookingId} not found`);
  if (booking.status !== "active") {
    throw new Error(`booking ${bookingId} must be 'active' to complete, is '${booking.status}'`);
  }
  const listing = await getListingById(db, booking.listingId);
  if (!listing) throw new Error(`listing ${booking.listingId} not found`);

  const commissionMinor = await getCommissionAmountMinor(db, booking.groupId, "vehicle_rental");

  await writeBalancedLedgerEntries(db, `rental:${bookingId}:complete`, [
    {
      groupId: booking.groupId,
      jobId: null,
      accountType: "accrued_fee_receivable",
      accountRefId: listing.ownerUserId,
      direction: "debit",
      amountMinor: commissionMinor,
      description: `flat commission accrued on rental booking ${bookingId}`,
    },
    {
      groupId: booking.groupId,
      jobId: null,
      accountType: "platform_revenue",
      accountRefId: null,
      direction: "credit",
      amountMinor: commissionMinor,
    },
  ]);

  return markBookingCompleted(db, bookingId, commissionMinor);
}
