import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { createWaitlistSchema } from "../../shared/schemas";
import { createWaitlistEntry, listWaitlist, updateWaitlistStatus } from "../db/waitlist";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { resolveGuestId } from "../lib/guestLookup";
import { notFound } from "../lib/errors";
import type { CreateWaitlistInput } from "../../shared/schemas";

export const waitlistRoutes = new Hono<AppEnv>();
waitlistRoutes.use("/:outletId/*", requireOutlet);

waitlistRoutes.get("/:outletId", async (c) => {
  const entries = await listWaitlist(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: entries });
});

waitlistRoutes.post("/:outletId", requireRole(ROLE_GROUPS.FOH_OPERATE), zValidator("json", createWaitlistSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const outletId = c.req.param("outletId");
  const input = getValidated<CreateWaitlistInput>(c, "json");

  const guestId = await resolveGuestId(c.env.DB, tenantId, {
    guestId: input.guestId,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
  });

  const entry = await createWaitlistEntry(c.env.DB, tenantId, outletId, {
    guestId,
    partySize: input.partySize,
    quotedWait: input.quotedWait,
  });
  return c.json({ ok: true, data: entry }, 201);
});

const statusSchema = z.object({
  status: z.enum(["waiting", "notified", "seated", "cancelled"]),
});

waitlistRoutes.patch(
  "/:outletId/:id",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", statusSchema),
  async (c) => {
  const input = getValidated<z.infer<typeof statusSchema>>(c, "json");
  const changed = await updateWaitlistStatus(
    c.env.DB,
    c.get("tenantId"),
    c.req.param("outletId"),
    c.req.param("id"),
    input.status,
  );
  if (!changed) throw notFound();
  return c.json({ ok: true, data: { updated: true } });
});
