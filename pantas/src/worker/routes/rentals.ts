import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  acceptBooking,
  activateBooking,
  cancelBooking,
  createListing,
  disputeBooking,
  getListingById,
  listActiveListings,
  listBookingsForRenter,
  rejectBooking,
  requestBooking,
  setListingActive,
} from "../../db/repositories/vehicleRentals";
import { settleRentalBooking } from "../../db/services/rentalSettlement";

const rentals = new Hono<AppEnv>();
rentals.use("*", requireAuth);

const listingSchema = z.object({
  vehicleId: z.string(),
  dailyRateMinor: z.number().int().positive(),
  declaredDepositMinor: z.number().int().positive().optional(),
});

/**
 * Any user can list a vehicle for rent (CLAUDE.md "Vehicle rental
 * (peer-to-peer)") — not restricted to the vendor role. Trevo-style: a
 * runner renting out their own car when they're not using it is exactly
 * the intended case, same as a vendor renting out a van.
 */
rentals.post("/listings", async (c) => {
  const session = c.get("session")!;
  const body = listingSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const listing = await createListing(db, {
    ownerUserId: session.userId,
    groupId: session.groupId,
    ...body,
  });
  return c.json(listing, 201);
});

rentals.get("/listings", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listActiveListings(db, session.groupId));
});

rentals.post("/listings/:id/deactivate", async (c) => {
  const db = await createDb(c.env);
  await setListingActive(db, c.req.param("id"), false);
  return c.json({ ok: true });
});

const bookingSchema = z.object({
  listingId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  totalFeeMinor: z.number().int().positive(),
  paymentMethod: z.enum(["cash", "gateway"]),
});

/** Renter must be a runner or a vendor renting equipment for their own operations — see CLAUDE.md. */
rentals.post("/bookings", requireRole("runner", "vendor"), async (c) => {
  const session = c.get("session")!;
  const body = bookingSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const listing = await getListingById(db, body.listingId);
  if (!listing || !listing.active) return c.json({ error: "listing not available" }, 404);
  const booking = await requestBooking(db, {
    ...body,
    renterUserId: session.userId,
    groupId: session.groupId,
  });
  return c.json(booking, 201);
});

rentals.get("/bookings/mine", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listBookingsForRenter(db, session.userId));
});

rentals.post("/bookings/:id/accept", async (c) => {
  const db = await createDb(c.env);
  return c.json(await acceptBooking(db, c.req.param("id")));
});

rentals.post("/bookings/:id/reject", async (c) => {
  const db = await createDb(c.env);
  return c.json(await rejectBooking(db, c.req.param("id")));
});

rentals.post("/bookings/:id/activate", async (c) => {
  const db = await createDb(c.env);
  return c.json(await activateBooking(db, c.req.param("id")));
});

rentals.post("/bookings/:id/cancel", async (c) => {
  const db = await createDb(c.env);
  return c.json(await cancelBooking(db, c.req.param("id")));
});

rentals.post("/bookings/:id/dispute", async (c) => {
  const db = await createDb(c.env);
  return c.json(await disputeBooking(db, c.req.param("id")));
});

rentals.post("/bookings/:id/complete", async (c) => {
  const db = await createDb(c.env);
  return c.json(await settleRentalBooking(db, c.req.param("id")));
});

export default rentals;
