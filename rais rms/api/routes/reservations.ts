import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { createReservationSchema, updateReservationSchema } from "../../shared/schemas";
import { createReservation, getReservation, listReservations, updateReservation } from "../db/reservations";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { resolveGuestId } from "../lib/guestLookup";
import { getGuest } from "../db/guests";
import { getOutlet } from "../db/outlets";
import { getTenantById } from "../db/tenants";
import { createManageToken } from "../lib/manageToken";
import { sendEmail, reservationConfirmationEmail, feedbackRequestEmail, alreadyNotified } from "../lib/notify";
import { createDepositSchema } from "../../shared/schemas";
import { createPayment, listPaymentsForReservation } from "../db/payments";
import { adjustLoyaltyPoints, pointsForPartySize } from "../db/loyalty";
import { createPaymentIntent, StripeError } from "../lib/stripe";
import { notFound, badRequest, ApiHttpError } from "../lib/errors";
import type { CreateReservationInput } from "../../shared/schemas";

export const reservationRoutes = new Hono<AppEnv>();
reservationRoutes.use("/:outletId/*", requireOutlet);

const listQuerySchema = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  status: z.enum(["booked", "seated", "completed", "no_show", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

reservationRoutes.get("/:outletId", zValidator("query", listQuerySchema), async (c) => {
  const tenantId = c.get("tenantId");
  const outletId = c.req.param("outletId");
  const q = getValidated<z.infer<typeof listQuerySchema>>(c, "query");
  const { items, total } = await listReservations(c.env.DB, tenantId, outletId, q);
  return c.json({ ok: true, data: items, meta: { page: q.page, pageSize: q.pageSize, total } });
});

reservationRoutes.post(
  "/:outletId",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", createReservationSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const outletId = c.req.param("outletId");
    const input = getValidated<CreateReservationInput>(c, "json");

    const guestId = await resolveGuestId(c.env.DB, tenantId, {
      guestId: input.guestId,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
    });

    const reservation = await createReservation(c.env.DB, tenantId, outletId, {
      guestId,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      partySize: input.partySize,
      source: input.source,
      tableIds: input.tableIds,
      notes: input.notes,
    });

    if (input.guestEmail) {
      const outlet = await getOutlet(c.env.DB, tenantId, outletId);
      const tenant = await getTenantById(c.env.DB, tenantId);
      const token = await createManageToken(c.env.JWT_SECRET, tenantId, reservation.id);
      const manageUrl = `${c.env.PUBLIC_APP_URL ?? new URL(c.req.url).origin}/book/${tenant?.slug}/manage/${reservation.id}?token=${token}`;
      const { subject, html } = reservationConfirmationEmail({
        outletName: outlet?.name ?? "the restaurant",
        guestName: input.guestName ?? "there",
        startsAt: input.startsAt,
        partySize: input.partySize,
        manageUrl,
      });
      await sendEmail(c.env.DB, c.env, tenantId, {
        to: input.guestEmail,
        subject,
        html,
        kind: "reservation_confirmation",
        referenceId: reservation.id,
      });
    }

    return c.json({ ok: true, data: reservation }, 201);
  },
);

reservationRoutes.get("/:outletId/:id", async (c) => {
  const reservation = await getReservation(c.env.DB, c.get("tenantId"), c.req.param("outletId"), c.req.param("id"));
  if (!reservation) throw notFound();
  return c.json({ ok: true, data: reservation });
});

reservationRoutes.patch(
  "/:outletId/:id",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", updateReservationSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const outletId = c.req.param("outletId");
    const id = c.req.param("id");
    const input = getValidated<z.infer<typeof updateReservationSchema>>(c, "json");
    const updated = await updateReservation(c.env.DB, tenantId, outletId, id, input);
    if (!updated) throw notFound();

    if (updated.status === "completed" && updated.guest_id) {
      await adjustLoyaltyPoints(c.env.DB, tenantId, updated.guest_id, {
        delta: pointsForPartySize(updated.party_size),
        reason: "reservation_completed",
        referenceId: updated.id,
      });

      const already = await alreadyNotified(c.env.DB, tenantId, "feedback_request", updated.id);
      if (!already) {
        const guest = await getGuest(c.env.DB, tenantId, updated.guest_id);
        if (guest?.email) {
          const outlet = await getOutlet(c.env.DB, tenantId, outletId);
          const tenant = await getTenantById(c.env.DB, tenantId);
          const feedbackToken = await createManageToken(c.env.JWT_SECRET, tenantId, updated.id);
          const feedbackUrl = `${c.env.PUBLIC_APP_URL ?? new URL(c.req.url).origin}/feedback/${tenant?.slug}/${updated.id}?token=${feedbackToken}`;
          const { subject, html } = feedbackRequestEmail({
            outletName: outlet?.name ?? "the restaurant",
            guestName: guest.name,
            feedbackUrl,
          });
          await sendEmail(c.env.DB, c.env, tenantId, {
            to: guest.email,
            subject,
            html,
            kind: "feedback_request",
            referenceId: updated.id,
          });
        }
      }
    }

    return c.json({ ok: true, data: updated });
  },
);

reservationRoutes.get("/:outletId/:id/payments", async (c) => {
  const tenantId = c.get("tenantId");
  const reservation = await getReservation(c.env.DB, tenantId, c.req.param("outletId"), c.req.param("id"));
  if (!reservation) throw notFound();
  const payments = await listPaymentsForReservation(c.env.DB, tenantId, reservation.id);
  return c.json({ ok: true, data: payments });
});

/**
 * Creates a Stripe PaymentIntent for a deposit/pre-auth/prepay/cancellation-fee tied to
 * a reservation. Returns the client_secret for the frontend to confirm with Stripe.js.
 * No-show protection (CLAUDE.md §8.5) hinges on this; it 501s cleanly until
 * STRIPE_SECRET_KEY is configured rather than pretending to charge a card.
 */
reservationRoutes.post(
  "/:outletId/:id/deposit",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", createDepositSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const outletId = c.req.param("outletId");
    const id = c.req.param("id");
    const reservation = await getReservation(c.env.DB, tenantId, outletId, id);
    if (!reservation) throw notFound();

    if (!c.env.STRIPE_SECRET_KEY) {
      throw new ApiHttpError(
        501,
        "PAYMENTS_NOT_CONFIGURED",
        "Stripe is not configured for this tenant yet — set STRIPE_SECRET_KEY.",
      );
    }

    const input = getValidated<z.infer<typeof createDepositSchema>>(c, "json");

    let intent;
    try {
      intent = await createPaymentIntent(c.env.STRIPE_SECRET_KEY, {
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: `${input.type} for reservation ${reservation.id}`,
        metadata: { tenantId, outletId, reservationId: reservation.id, type: input.type },
      });
    } catch (err) {
      if (err instanceof StripeError) throw badRequest(err.message);
      throw err;
    }

    const payment = await createPayment(c.env.DB, tenantId, {
      outletId,
      guestId: reservation.guest_id,
      reservationId: reservation.id,
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      providerRef: intent.id,
      status: "pending",
    });

    return c.json({ ok: true, data: { payment, clientSecret: intent.client_secret } }, 201);
  },
);
