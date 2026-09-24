import { Hono } from "hono";
import type { AppEnv } from "../types";
import { listOutlets, createOutlet, getOutlet } from "../db/outlets";
import { zValidator, getValidated } from "../middleware/validate";
import { z } from "zod";
import { isGroupAdmin } from "../lib/rbac";
import { forbidden, notFound } from "../lib/errors";

export const outletRoutes = new Hono<AppEnv>();

outletRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const outlets = await listOutlets(c.env.DB, tenantId);
  return c.json({ ok: true, data: outlets });
});

const createOutletSchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  address: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
});

outletRoutes.post("/", zValidator("json", createOutletSchema), async (c) => {
  const auth = c.get("auth");
  if (!isGroupAdmin(auth)) throw forbidden("Only owners/group admins can create outlets");
  const tenantId = c.get("tenantId");
  const input = getValidated<z.infer<typeof createOutletSchema>>(c, "json");
  const outlet = await createOutlet(c.env.DB, tenantId, input);
  return c.json({ ok: true, data: outlet }, 201);
});

outletRoutes.get("/:outletId", async (c) => {
  const tenantId = c.get("tenantId");
  const outlet = await getOutlet(c.env.DB, tenantId, c.req.param("outletId"));
  if (!outlet) throw notFound();
  return c.json({ ok: true, data: outlet });
});
