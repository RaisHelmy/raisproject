import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser } from "../src/db/repositories/users";
import { createVehicle } from "../src/db/repositories/vehicles";
import { createCommissionRule } from "../src/db/repositories/commissionRules";
import { getAccountTotals } from "../src/db/repositories/ledger";
import {
  acceptBooking,
  activateBooking,
  createListing,
  requestBooking,
} from "../src/db/repositories/vehicleRentals";
import { settleRentalBooking } from "../src/db/services/rentalSettlement";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
});

async function seedListingAndRenter(db: Db) {
  const owner = await createUser(db, {
    realName: "Owner",
    phone: "+60144400001",
    passwordHash: "x",
    handle: "Runner #R001",
  });
  const renter = await createUser(db, {
    realName: "Renter",
    phone: "+60144400002",
    passwordHash: "x",
    handle: "Vendor #R002",
  });
  const vehicle = await createVehicle(db, {
    runnerUserId: owner.id,
    vehicleType: "car",
    brand: "Perodua",
    model: "Myvi",
    plateNumber: "WRX 100",
  });
  const listing = await createListing(db, {
    ownerUserId: owner.id,
    vehicleId: vehicle.id,
    dailyRateMinor: 8000,
    declaredDepositMinor: 30000,
  });
  return { owner, renter, listing };
}

describe("vehicle rental (peer-to-peer)", () => {
  it("declares a deposit as an attestation only — never a platform ledger entry", async () => {
    const { listing } = await seedListingAndRenter(db);
    expect(listing.declaredDepositMinor).toBe(30000);
    // No ledger entries exist yet at all — the deposit never touches the ledger.
    const totals = await getAccountTotals(db, null, "accrued_fee_receivable", listing.ownerUserId);
    expect(totals.entryCount).toBe(0);
  });

  it("walks requested -> accepted -> active -> completed and accrues commission against the owner", async () => {
    await createCommissionRule(db, { jobType: "vehicle_rental", amountMinor: 500 });
    const { owner, renter, listing } = await seedListingAndRenter(db);

    const booking = await requestBooking(db, {
      listingId: listing.id,
      renterUserId: renter.id,
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      totalFeeMinor: 16000,
      paymentMethod: "cash",
    });
    expect(booking.status).toBe("requested");

    await acceptBooking(db, booking.id);
    await activateBooking(db, booking.id);
    const completed = await settleRentalBooking(db, booking.id);
    expect(completed.status).toBe("completed");
    expect(completed.commissionMinor).toBe(500);

    const receivable = await getAccountTotals(db, null, "accrued_fee_receivable", owner.id);
    expect(receivable.debitTotal - receivable.creditTotal).toBe(500);
    const revenue = await getAccountTotals(db, null, "platform_revenue", null);
    expect(revenue.creditTotal - revenue.debitTotal).toBe(500);
  });

  it("rejects completing a booking that was never activated", async () => {
    await createCommissionRule(db, { jobType: "vehicle_rental", amountMinor: 500 });
    const { renter, listing } = await seedListingAndRenter(db);
    const booking = await requestBooking(db, {
      listingId: listing.id,
      renterUserId: renter.id,
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      totalFeeMinor: 16000,
      paymentMethod: "cash",
    });
    await expect(settleRentalBooking(db, booking.id)).rejects.toThrow(/must be 'active'/);
  });
});
