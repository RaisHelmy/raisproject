import { Hono } from "hono";
import { AppError, hasScope, type Capability, type ModelCategory, type ModelTag } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { requireAdmin } from "../middleware/admin";
import { z } from "zod";
import { ModelService } from "../services/model-service";
import { ModelPreferenceService } from "../services/model-preference-service";
import { ModelSeedService } from "../services/model-seed-service";
import { PricingService } from "../services/pricing-service";
import { toModelDTO, toAdminModelDTO } from "../dto/model";
import type { CanonicalInput } from "../providers/types";

export const models = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

models.get("/models", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const service = new ModelService(c.env);
  const capabilities = c.req
    .queries("capability")
    ?.filter(Boolean) as Capability[] | undefined;

  const list = await service.list({
    task: c.req.query("task"),
    category: c.req.query("category") as ModelCategory | undefined,
    tag: c.req.query("group") as ModelTag | undefined,
    search: c.req.query("q"),
    capabilities,
  });

  // A price next to every model is what makes cost-aware selection possible
  // (§92). This is the cost of a typical request, not of the user's draft.
  const pricing = new PricingService(c.env);
  const items = await Promise.all(
    list.map(async (model) => {
      const dto = toModelDTO(model);
      try {
        const estimate = await pricing.estimate(model, typicalRequestFor(model));
        return { ...dto, typicalCostSen: estimate.estimatedSen, typicalCostApproximate: estimate.approximate };
      } catch {
        // A model with no configured rate still lists, just without a price.
        return dto;
      }
    }),
  );
  return c.json({ items });
});

/**
 * A representative request per category. Deliberately does NOT pin width,
 * height, steps or duration: those come from each model's own defaults, so the
 * price listed beside a model is the price of generating with it as configured.
 * Overriding them made the list show RM0.18 for a model that actually charges
 * RM0.38 at its default size.
 */
function typicalRequestFor(model: { category: string }): CanonicalInput {
  switch (model.category) {
    case "image":
      return { prompt: "a rainy cyberpunk street" };
    case "video":
      return { prompt: "a rainy cyberpunk street" };
    case "audio":
      return { text: "The quick brown fox jumps over the lazy dog." };
    default:
      return { prompt: "Write a short logline." };
  }
}

const estimateSchema = z.object({
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  text: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  steps: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  imageCount: z.number().int().nonnegative().optional(),
  parameters: z.record(z.unknown()).optional(),
});

/** Live cost preview for the Generate button and node config panel. */
models.post("/models/:id{.+}/estimate", requireAuth(), requireCsrf(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const body = estimateSchema.parse(await c.req.json());
  const model = await new ModelService(c.env).getEnabled(c.req.param("id"));

  const { imageCount, ...rest } = body;
  const input: CanonicalInput = {
    ...rest,
    ...(imageCount ? { images: Array.from({ length: imageCount }, () => ({ mime: "image/png" })) } : {}),
  };
  const estimate = await new PricingService(c.env).estimate(model, input);

  // Only the customer-facing half of the estimate crosses this boundary.
  return c.json({ estimatedSen: estimate.estimatedSen, approximate: estimate.approximate, currency: "MYR" });
});

// Registered before the /models/:id wildcard, which would otherwise match
// "compatible" as a model id and answer 404.
/**
 * Models that can do what a request needs (§91). Returned alongside the reason
 * a chosen model cannot, so the UI can offer a way forward instead of only
 * reporting a problem.
 */
models.get("/models/compatible", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");

  const needed = (c.req.queries("capability") ?? []) as Capability[];
  const service = new ModelService(c.env);
  const task = c.req.query("task");
  const compatible = await service.findCompatible(needed, task);

  const chosenId = c.req.query("insteadOf");
  let reason: string | null = null;
  if (chosenId) {
    const chosen = await service.getAny(chosenId);
    if (chosen) {
      try {
        service.assertSupports(chosen, needed);
      } catch (error) {
        reason = error instanceof AppError ? error.message : null;
      }
    }
  }

  const pricing = new PricingService(c.env);
  const items = await Promise.all(
    compatible.map(async (model) => {
      const dto = toModelDTO(model);
      try {
        const estimate = await pricing.estimate(model, typicalRequestFor(model));
        return { ...dto, typicalCostSen: estimate.estimatedSen };
      } catch {
        return dto;
      }
    }),
  );
  return c.json({ items, reason });
});

const compareSchema = z.object({
  modelIds: z.array(z.string()).min(2).max(4),
  prompt: z.string().min(1),
  projectId: z.string().optional(),
});

models.post("/models/compare/estimate", requireAuth(), requireCsrf(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const body = compareSchema.parse(await c.req.json());
  const { ComparisonService } = await import("../services/comparison-service");
  const estimate = await new ComparisonService(c.env).estimate(body.modelIds, body.prompt);
  return c.json({ ...estimate, currency: "MYR" });
});

models.post("/models/compare", requireAuth(), requireCsrf(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot create generations.");
  const body = compareSchema.parse(await c.req.json());
  const { ComparisonService } = await import("../services/comparison-service");
  const result = await new ComparisonService(c.env).run(auth, body);

  return c.json({
    prompt: result.prompt,
    totalChargedSen: result.totalChargedSen,
    balanceAfterSen: result.balanceAfterSen,
    entries: result.entries.map((entry) => ({
      modelId: entry.modelId,
      displayName: entry.displayName,
      status: entry.status,
      outputs: entry.outputs ?? {},
      chargedSen: entry.chargedSen,
      durationMs: entry.durationMs,
      error: entry.error ?? null,
    })),
  }, 201);
});

/**
 * What this person favours and has reached for (§90). Personal, so it is keyed
 * to the signed-in user rather than the workspace.
 */
models.get("/models/preferences", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  return c.json({ items: await new ModelPreferenceService(c.env).list(auth) });
});

models.put("/models/:id{.+}/favourite", requireAuth(), requireCsrf(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const { favourite } = z.object({ favourite: z.boolean() }).parse(await c.req.json());
  return c.json(await new ModelPreferenceService(c.env).setFavourite(auth, c.req.param("id"), favourite));
});

models.get("/models/:id{.+}", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const service = new ModelService(c.env);
  return c.json(toModelDTO(await service.getEnabled(c.req.param("id"))));
});

models.get("/admin/models", requireAuth(), requireAdmin(), async (c) => {
  const service = new ModelService(c.env);
  const list = await service.list({ includeAllStatuses: true });
  return c.json({ items: list.map(toAdminModelDTO) });
});

/** Loads the curated catalog. Safe to re-run; used in dev and first deploy. */
models.post("/admin/models/seed", requireAuth(), requireCsrf(), requireAdmin(), async (c) => {
  const result = await new ModelSeedService(c.env).seed();
  return c.json(result, 201);
});
