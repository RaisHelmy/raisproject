import { Hono } from "hono";
import { z } from "zod";
import { MODEL_CATEGORIES, MODEL_STATUSES, MODEL_TAGS, PRICING_UNITS, CAPABILITIES } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { requireAdmin } from "../middleware/admin";
import { AdminModelService } from "../services/admin-model-service";
import { ModelSyncService } from "../services/model-sync-service";
import { toAdminModelDTO } from "../dto/model";

export const adminModels = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf(), requireAdmin()] as const;

adminModels.post("/admin/models/sync", ...guarded, async (c) => {
  const result = await new ModelSyncService(c.env).sync();
  return c.json(result);
});

/**
 * Loads Cloudflare's whole published catalog as `discovered` models (§125).
 *
 * Offline, from the copy of the catalog in docs/, so it works without account
 * credentials. Nothing it adds can be used until it is priced and tested.
 */
adminModels.post("/admin/models/import", ...guarded, async (c) => {
  return c.json(await new ModelSyncService(c.env).importDocumented());
});

const patchSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(MODEL_CATEGORIES).optional(),
  task: z.string().optional(),
  capabilities: z.array(z.enum(CAPABILITIES)).optional(),
  inputs: z.record(z.string()).optional(),
  outputs: z.record(z.string()).optional(),
  parameters: z.array(z.record(z.unknown())).optional(),
  limits: z.record(z.unknown()).optional(),
  tags: z.array(z.enum(MODEL_TAGS)).optional(),
  sortOrder: z.number().int().optional(),
});

adminModels.patch("/admin/models/:id{.+}", ...guarded, async (c) => {
  const auth = c.get("auth");
  const body = patchSchema.parse(await c.req.json());
  const model = await new AdminModelService(c.env).update(auth, c.req.param("id"), body as never);
  return c.json(toAdminModelDTO(model));
});

const pricingSchema = z.object({
  unit: z.enum(PRICING_UNITS),
  providerUsd: z.record(z.number()),
  markupPercent: z.number().min(0).max(500).optional(),
  minimumChargeSen: z.number().int().min(0).optional(),
  roundingSen: z.number().int().min(1).optional(),
  fxRateUsdMyr: z.number().positive().optional(),
});

adminModels.put("/admin/models/:id{.+}/pricing", ...guarded, async (c) => {
  const auth = c.get("auth");
  const body = pricingSchema.parse(await c.req.json());
  const service = new AdminModelService(c.env);
  await service.setPricing(auth, c.req.param("id"), body);
  return c.json({ ok: true, preview: await service.previewPrice(c.req.param("id")) });
});

adminModels.get("/admin/models/:id{.+}/pricing", ...guarded, async (c) => {
  const service = new AdminModelService(c.env);
  const id = c.req.param("id");
  return c.json({
    pricing: await service.currentPricing(id),
    preview: await service.previewPrice(id),
  });
});

adminModels.post("/admin/models/:id{.+}/test", ...guarded, async (c) => {
  const auth = c.get("auth");
  return c.json(await new AdminModelService(c.env).testRun(auth, c.req.param("id")));
});

adminModels.put("/admin/models/:id{.+}/status", ...guarded, async (c) => {
  const auth = c.get("auth");
  const { status } = z.object({ status: z.enum(MODEL_STATUSES) }).parse(await c.req.json());
  const model = await new AdminModelService(c.env).setStatus(auth, c.req.param("id"), status);
  return c.json(toAdminModelDTO(model));
});
