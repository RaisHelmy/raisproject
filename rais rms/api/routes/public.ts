import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { rateLimit } from "../middleware/rateLimit";
import {
  publicAvailabilityQuerySchema,
  publicBookingSchema,
  publicManageSchema,
  createFeedbackSchema,
} from "../../shared/schemas";
import { getTenantBySlug } from "../db/tenants";
import { getOutlet, listOutlets } from "../db/outlets";
import { computeAvailability, hasCapacityForSlot } from "../db/availability";
import { createReservation, getReservation, updateReservation } from "../db/reservations";
import { resolveGuestId } from "../lib/guestLookup";
import { createManageToken, verifyManageToken } from "../lib/manageToken";
import { sendEmail, reservationConfirmationEmail } from "../lib/notify";
import { getGuest } from "../db/guests";
import { createFeedback, feedbackAlreadyExists } from "../db/feedback";
import { getMenu, listItemsForMenu, listSections } from "../db/menu";
import { createOrder } from "../db/orders";
import { createOrderSchema } from "../../shared/schemas";
import { assertKeyBelongsToTenant } from "../lib/r2";
import { badRequest, forbidden, notFound } from "../lib/errors";
import type { PublicBookingInput } from "../../shared/schemas";
import type { AppDatabase } from "../lib/db";

export const publicRoutes = new Hono<AppEnv>();

async function resolveTenantOrThrow(db: AppDatabase, slug: string) {
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant || tenant.status !== "active") throw notFound("Restaurant not found");
  return tenant;
}

publicRoutes.get("/:tenantSlug/outlets", async (c) => {
  const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
  const outlets = await listOutlets(c.env.DB, tenant.id);
  return c.json({
    ok: true,
    data: outlets.map((o) => ({ id: o.id, name: o.name, timezone: o.timezone, currency: o.currency })),
  });
});

publicRoutes.get(
  "/:tenantSlug/outlets/:outletId/availability",
  zValidator("query", publicAvailabilityQuerySchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const outletId = c.req.param("outletId");
    const outlet = await getOutlet(c.env.DB, tenant.id, outletId);
    if (!outlet) throw notFound("Outlet not found");

    const { date, partySize } = getValidated<z.infer<typeof publicAvailabilityQuerySchema>>(c, "query");
    const slots = await computeAvailability(c.env.DB, tenant.id, outletId, date, partySize);
    return c.json({ ok: true, data: slots });
  },
);

publicRoutes.post(
  "/:tenantSlug/outlets/:outletId/reservations",
  rateLimit({ limit: 8, windowSeconds: 600, keyPrefix: "public-book" }),
  zValidator("json", publicBookingSchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const outletId = c.req.param("outletId");
    const outlet = await getOutlet(c.env.DB, tenant.id, outletId);
    if (!outlet) throw notFound("Outlet not found");

    const input = getValidated<PublicBookingInput>(c, "json");
    if (input.startsAt < Date.now() - 5 * 60_000) throw badRequest("Reservation time must be in the future");

    const fits = await hasCapacityForSlot(c.env.DB, tenant.id, outletId, input.startsAt, input.partySize);
    if (!fits) throw badRequest("Sorry, that time is no longer available", { code: "NO_AVAILABILITY" });

    const guestId = await resolveGuestId(c.env.DB, tenant.id, {
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
    });

    const reservation = await createReservation(c.env.DB, tenant.id, outletId, {
      guestId,
      startsAt: input.startsAt,
      partySize: input.partySize,
      source: "widget",
      notes: input.notes,
    });

    const token = await createManageToken(c.env.JWT_SECRET, tenant.id, reservation.id);
    const manageUrl = `${c.env.PUBLIC_APP_URL ?? new URL(c.req.url).origin}/book/${tenant.slug}/manage/${reservation.id}?token=${token}`;

    if (input.guestEmail) {
      const { subject, html } = reservationConfirmationEmail({
        outletName: outlet.name,
        guestName: input.guestName,
        startsAt: input.startsAt,
        partySize: input.partySize,
        manageUrl,
      });
      await sendEmail(c.env.DB, c.env, tenant.id, {
        to: input.guestEmail,
        subject,
        html,
        kind: "reservation_confirmation",
        referenceId: reservation.id,
      });
    }

    return c.json({ ok: true, data: { reservation, manageToken: token, manageUrl } }, 201);
  },
);

const tokenQuerySchema = z.object({ token: z.string().min(16) });

publicRoutes.get(
  "/:tenantSlug/reservations/:id",
  zValidator("query", tokenQuerySchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const reservationId = c.req.param("id");
    const { token } = getValidated<z.infer<typeof tokenQuerySchema>>(c, "query");

    const valid = await verifyManageToken(c.env.JWT_SECRET, tenant.id, reservationId, token);
    if (!valid) throw forbidden("Invalid or expired link");

    const outlets = await listOutlets(c.env.DB, tenant.id);
    let reservation = null;
    for (const outlet of outlets) {
      reservation = await getReservation(c.env.DB, tenant.id, outlet.id, reservationId);
      if (reservation) break;
    }
    if (!reservation) throw notFound();

    const guest = reservation.guest_id ? await getGuest(c.env.DB, tenant.id, reservation.guest_id) : null;
    return c.json({ ok: true, data: { reservation, guestName: guest?.name ?? null } });
  },
);

publicRoutes.post(
  "/:tenantSlug/reservations/:id/manage",
  zValidator("query", tokenQuerySchema),
  zValidator("json", publicManageSchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const reservationId = c.req.param("id");
    const { token } = getValidated<z.infer<typeof tokenQuerySchema>>(c, "query");
    const input = getValidated<z.infer<typeof publicManageSchema>>(c, "json");

    const valid = await verifyManageToken(c.env.JWT_SECRET, tenant.id, reservationId, token);
    if (!valid) throw forbidden("Invalid or expired link");

    const outlets = await listOutlets(c.env.DB, tenant.id);
    let outletId: string | null = null;
    let reservation = null;
    for (const outlet of outlets) {
      reservation = await getReservation(c.env.DB, tenant.id, outlet.id, reservationId);
      if (reservation) {
        outletId = outlet.id;
        break;
      }
    }
    if (!reservation || !outletId) throw notFound();
    if (reservation.status !== "booked") throw badRequest("This reservation can no longer be changed");

    if (input.action === "cancel") {
      const updated = await updateReservation(c.env.DB, tenant.id, outletId, reservationId, { status: "cancelled" });
      return c.json({ ok: true, data: updated });
    }

    // reschedule
    if (!input.startsAt) throw badRequest("startsAt is required to reschedule");
    if (input.startsAt < Date.now() - 5 * 60_000) throw badRequest("Reservation time must be in the future");
    const fits = await hasCapacityForSlot(
      c.env.DB,
      tenant.id,
      outletId,
      input.startsAt,
      reservation.party_size,
      reservationId,
    );
    if (!fits) throw badRequest("Sorry, that time is no longer available", { code: "NO_AVAILABILITY" });

    const updated = await updateReservation(c.env.DB, tenant.id, outletId, reservationId, {
      startsAt: input.startsAt,
    });
    return c.json({ ok: true, data: updated });
  },
);

publicRoutes.post(
  "/:tenantSlug/reservations/:id/feedback",
  rateLimit({ limit: 5, windowSeconds: 600, keyPrefix: "public-feedback" }),
  zValidator("query", tokenQuerySchema),
  zValidator("json", createFeedbackSchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const reservationId = c.req.param("id");
    const { token } = getValidated<z.infer<typeof tokenQuerySchema>>(c, "query");

    const valid = await verifyManageToken(c.env.JWT_SECRET, tenant.id, reservationId, token);
    if (!valid) throw forbidden("Invalid or expired link");

    const outlets = await listOutlets(c.env.DB, tenant.id);
    let outletId: string | null = null;
    let reservation = null;
    for (const outlet of outlets) {
      reservation = await getReservation(c.env.DB, tenant.id, outlet.id, reservationId);
      if (reservation) {
        outletId = outlet.id;
        break;
      }
    }
    if (!reservation || !outletId) throw notFound();

    const already = await feedbackAlreadyExists(c.env.DB, tenant.id, reservationId);
    if (already) throw badRequest("Feedback was already submitted for this visit");

    const input = getValidated<z.infer<typeof createFeedbackSchema>>(c, "json");
    const feedback = await createFeedback(c.env.DB, tenant.id, {
      outletId,
      reservationId,
      guestId: reservation.guest_id,
      scores: input.scores,
      comment: input.comment,
    });

    return c.json({ ok: true, data: { routedToPublic: feedback.routed_to_public } }, 201);
  },
);

// --- QR ordering (menu read + order placement) ---

publicRoutes.get("/:tenantSlug/outlets/:outletId/menus/:menuId", async (c) => {
  const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
  const outletId = c.req.param("outletId");
  const menu = await getMenu(c.env.DB, tenant.id, c.req.param("menuId"));
  if (!menu || menu.outlet_id !== outletId) throw notFound();

  const sections = await listSections(c.env.DB, tenant.id, menu.id);
  const items = (await listItemsForMenu(c.env.DB, tenant.id, menu.id)).filter((i) => i.available);
  return c.json({
    ok: true,
    data: {
      ...menu,
      sections: sections.map((s) => ({ ...s, items: items.filter((i) => i.section_id === s.id) })),
    },
  });
});

publicRoutes.post(
  "/:tenantSlug/outlets/:outletId/orders",
  rateLimit({ limit: 15, windowSeconds: 600, keyPrefix: "public-order" }),
  zValidator("json", createOrderSchema),
  async (c) => {
    const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
    const outletId = c.req.param("outletId");
    const outlet = await getOutlet(c.env.DB, tenant.id, outletId);
    if (!outlet) throw notFound();

    const input = getValidated<z.infer<typeof createOrderSchema>>(c, "json");

    // "Only paid orders reach the kitchen" (UMAI 2 Go): without Stripe configured we can't
    // gate on payment, so the order is placed directly and staff collect payment in person.
    // Once STRIPE_SECRET_KEY is set, wire a payment step here before flipping to "placed".
    try {
      const order = await createOrder(c.env.DB, tenant.id, outletId, { ...input, initialStatus: "placed" });
      return c.json({ ok: true, data: order }, 201);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Could not place order");
    }
  },
);

publicRoutes.get("/:tenantSlug/images/*", async (c) => {
  const tenant = await resolveTenantOrThrow(c.env.DB, c.req.param("tenantSlug"));
  const key = c.req.path.split("/images/")[1];
  if (!key) throw notFound();

  try {
    assertKeyBelongsToTenant(key, tenant.id);
  } catch {
    throw notFound();
  }

  const object = await c.env.BUCKET.get(key);
  if (!object) throw notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
