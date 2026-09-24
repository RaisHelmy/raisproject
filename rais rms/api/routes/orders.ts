import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createOrderSchema, updateOrderStatusSchema } from "../../shared/schemas";
import { createOrder, getOrder, listOrders, setOrderStatus } from "../db/orders";
import { badRequest, notFound } from "../lib/errors";

export const orderRoutes = new Hono<AppEnv>();
orderRoutes.use("/:outletId/*", requireOutlet);

const listQuerySchema = z.object({ activeOnly: z.coerce.boolean().optional() });

orderRoutes.get("/:outletId/orders", zValidator("query", listQuerySchema), async (c) => {
  const { activeOnly } = getValidated<z.infer<typeof listQuerySchema>>(c, "query");
  const orders = await listOrders(c.env.DB, c.get("tenantId"), c.req.param("outletId"), { activeOnly });
  return c.json({ ok: true, data: orders });
});

// Staff-created orders (dine-in POS) start "placed" — the kitchen sees them immediately.
// Guest-facing QR orders go through /api/public/... instead, which gates on payment.
orderRoutes.post(
  "/:outletId/orders",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", createOrderSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const outletId = c.req.param("outletId");
    const input = getValidated<z.infer<typeof createOrderSchema>>(c, "json");

    try {
      const order = await createOrder(c.env.DB, tenantId, outletId, { ...input, initialStatus: "placed" });
      return c.json({ ok: true, data: order }, 201);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Could not create order");
    }
  },
);

orderRoutes.get("/:outletId/orders/:id", async (c) => {
  const order = await getOrder(c.env.DB, c.get("tenantId"), c.req.param("outletId"), c.req.param("id"));
  if (!order) throw notFound();
  return c.json({ ok: true, data: order });
});

orderRoutes.patch(
  "/:outletId/orders/:id/status",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", updateOrderStatusSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof updateOrderStatusSchema>>(c, "json");
    const changed = await setOrderStatus(c.env.DB, c.get("tenantId"), c.req.param("outletId"), c.req.param("id"), input.status);
    if (!changed) throw notFound();
    return c.json({ ok: true, data: { updated: true } });
  },
);
