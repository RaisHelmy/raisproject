import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createTicketEventSchema, createTicketOrderSchema } from "../../shared/schemas";
import {
  createEvent,
  createTicketOrder,
  getEvent,
  listEvents,
  listTicketOrders,
  ticketsSoldForEvent,
} from "../db/tickets";
import { resolveGuestId } from "../lib/guestLookup";
import { badRequest, notFound } from "../lib/errors";

export const ticketRoutes = new Hono<AppEnv>();
ticketRoutes.use("/:outletId/*", requireOutlet);

ticketRoutes.get("/:outletId/events", async (c) => {
  const events = await listEvents(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: events });
});

ticketRoutes.post(
  "/:outletId/events",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createTicketEventSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createTicketEventSchema>>(c, "json");
    const event = await createEvent(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input);
    return c.json({ ok: true, data: event }, 201);
  },
);

ticketRoutes.get("/:outletId/events/:eventId/orders", requireRole(ROLE_GROUPS.MANAGE_OUTLET), async (c) => {
  const tenantId = c.get("tenantId");
  const event = await getEvent(c.env.DB, tenantId, c.req.param("eventId"));
  if (!event || event.outlet_id !== c.req.param("outletId")) throw notFound();
  const orders = await listTicketOrders(c.env.DB, tenantId, event.id);
  return c.json({ ok: true, data: orders });
});

ticketRoutes.post(
  "/:outletId/events/:eventId/orders",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", createTicketOrderSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const event = await getEvent(c.env.DB, tenantId, c.req.param("eventId"));
    if (!event || event.outlet_id !== c.req.param("outletId")) throw notFound();

    const input = getValidated<z.infer<typeof createTicketOrderSchema>>(c, "json");
    const sold = await ticketsSoldForEvent(c.env.DB, tenantId, event.id);
    if (event.capacity > 0 && sold + input.quantity > event.capacity) {
      throw badRequest("Not enough tickets remaining for this event");
    }

    const guestId = await resolveGuestId(c.env.DB, tenantId, {
      guestId: input.guestId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
    });

    const order = await createTicketOrder(c.env.DB, tenantId, {
      eventId: event.id,
      guestId,
      quantity: input.quantity,
      totalMinor: event.price_minor * input.quantity,
    });
    return c.json({ ok: true, data: order }, 201);
  },
);
