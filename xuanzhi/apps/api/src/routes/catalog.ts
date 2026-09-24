import { Hono } from "hono";
import type { HonoEnv } from "../middleware";
import { ok } from "../lib/http";
import { entitlements } from "../services/entitlements";
import { toCategoryDTO, toModeDTO, toModelDTO, toPlanDTO } from "../services/mappers";
import { providerConfigured } from "../services/ai/registry";

const router = new Hono<HonoEnv>();

/** Models the catalog exposes; when signed in, each model carries `available` + `required_plan` for the current plan. */
router.get("/models", async (c) => {
  const ctx = c.get("ctx");
  const models = await ctx.repos.models.listActive();
  const providers = await ctx.repos.providers.list();
  const configured = new Map<string, boolean>();
  for (const p of providers) configured.set(p.id, await providerConfigured(ctx, p));
  const usable = models.filter((m) => configured.get(m.provider_id));
  if (!ctx.user) return ok(c, usable.map((m) => toModelDTO(m)));
  const ent = entitlements(ctx);
  const out = [];
  for (const m of usable) { const r = await ent.canUseModel(ctx.user, m); out.push(toModelDTO(m, { available: r.allowed, required_plan: r.required_plan })); };
  return ok(c, out);
});

router.get("/plans", async (c) => ok(c, (await c.get("ctx").repos.plans.listActive()).map(toPlanDTO)));

router.get("/modes", async (c) => {
  const ctx = c.get("ctx");
  const modes = await ctx.repos.modes.listActive();
  if (!ctx.user) return ok(c, modes.map((m) => toModeDTO(m)));
  const ent = entitlements(ctx); const out = [];
  for (const m of modes) out.push(toModeDTO(m, (await ent.canUseAdvancedMode(ctx.user, m)).allowed));
  return ok(c, out);
});

router.get("/categories", async (c) => ok(c, (await c.get("ctx").repos.categories.list()).map(toCategoryDTO)));

export default router;
