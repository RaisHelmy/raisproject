import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { adjustLoyaltyPoints, getLoyaltyAccount, listLoyaltyTransactions } from "../db/loyalty";
import { getGuest } from "../db/guests";
import { badRequest, notFound } from "../lib/errors";

export const loyaltyRoutes = new Hono<AppEnv>();

loyaltyRoutes.get("/:guestId", async (c) => {
  const tenantId = c.get("tenantId");
  const guestId = c.req.param("guestId");
  const guest = await getGuest(c.env.DB, tenantId, guestId);
  if (!guest) throw notFound();

  const account = await getLoyaltyAccount(c.env.DB, tenantId, guestId);
  const transactions = await listLoyaltyTransactions(c.env.DB, tenantId, guestId);
  return c.json({ ok: true, data: { ...account, transactions } });
});

const redeemSchema = z.object({
  points: z.number().int().min(1),
  reason: z.string().min(1).max(200),
});

loyaltyRoutes.post(
  "/:guestId/redeem",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", redeemSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const guestId = c.req.param("guestId");
    const guest = await getGuest(c.env.DB, tenantId, guestId);
    if (!guest) throw notFound();

    const input = getValidated<z.infer<typeof redeemSchema>>(c, "json");
    const account = await getLoyaltyAccount(c.env.DB, tenantId, guestId);
    if (account.points_balance < input.points) throw badRequest("Guest does not have enough points");

    const updated = await adjustLoyaltyPoints(c.env.DB, tenantId, guestId, {
      delta: -input.points,
      reason: `redeem:${input.reason}`,
    });
    return c.json({ ok: true, data: updated });
  },
);
