import { Hono } from "hono";
import { AppError } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { AssetService } from "../services/asset-service";
import { ModelService } from "../services/model-service";
import { PricingService } from "../services/pricing-service";
import { TemplateService } from "../services/template-service";
import { registerBuiltinNodes } from "../engine/nodes";
import { STUDIO_NODES } from "../engine/nodes/ai-presets";
import type { CanonicalInput } from "../providers/types";

/**
 * Unauthenticated, read-only views for the marketing pages.
 *
 * Nothing here leaks a customer's data: showcase assets are the ones an
 * admin explicitly featured, template previews are served only for public
 * templates, and pricing is the same customer-facing number the app shows
 * (provider cost and markup never cross this boundary, ADR-006).
 */
export const publicRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const CACHE = "public, max-age=300";

publicRoutes.get("/public/showcase", async (c) => {
  const items = await new AssetService(c.env).listFeatured(48);
  return c.json(
    {
      items: items.map((a) => ({
        id: a.id,
        kind: a.kind,
        mime: a.mime,
        name: a.name,
        width: a.width,
        height: a.height,
        durationMs: a.duration_ms,
        prompt: a.prompt,
        studio: a.studio,
        url: `/api/v1/public/showcase/${a.id}/content`,
      })),
    },
    200,
    { "cache-control": CACHE },
  );
});

publicRoutes.get("/public/showcase/:id/content", async (c) => {
  const service = new AssetService(c.env);
  const version = await service.featuredVersion(c.req.param("id"));
  if (!version) throw new AppError("not_found", "Nothing is featured under that id.");
  const object = await c.env.ASSETS.get(version.r2_key);
  if (!object) throw new AppError("not_found", "The stored file is missing.");
  return new Response(object.body, {
    headers: { "content-type": version.mime, "cache-control": "public, max-age=86400", "content-length": String(version.size_bytes) },
  });
});

/** Preview image of a *public* template, for the community gallery and the landing page. */
publicRoutes.get("/public/templates/:id/preview", async (c) => {
  const version = await new TemplateService(c.env).publicPreviewVersion(c.req.param("id"));
  if (!version) throw new AppError("not_found", "That template has no public preview.");
  const object = await c.env.ASSETS.get(version.r2_key);
  if (!object) throw new AppError("not_found", "The stored file is missing.");
  return new Response(object.body, {
    headers: { "content-type": version.mime, "cache-control": "public, max-age=86400", "content-length": String(version.size_bytes) },
  });
});

/**
 * What a typical request costs today, per studio and per enabled model.
 * The studio price is that of the model the studio would auto-pick, which is
 * exactly what a new account pays when it presses Generate.
 */
publicRoutes.get("/public/pricing", async (c) => {
  registerBuiltinNodes();
  const models = new ModelService(c.env);
  const pricing = new PricingService(c.env);
  const enabled = await models.list({});

  const priced = await Promise.all(
    enabled.map(async (m) => {
      try {
        const e = await pricing.estimate(m, typicalRequestFor(m));
        return { id: m.id, displayName: m.displayName, category: m.category, task: m.task, typicalSen: e.estimatedSen, approximate: e.approximate };
      } catch {
        return null;
      }
    }),
  );

  const studios = await Promise.all(
    STUDIO_NODES.map(async (node) => {
      const [best] = await models.findCompatible((node.requiredCapabilities ?? []) as never);
      if (!best) return { type: node.type, label: node.label, description: node.description, available: false as const };
      try {
        const e = await pricing.estimate(best, typicalRequestFor(best));
        return { type: node.type, label: node.label, description: node.description, available: true as const, model: best.displayName, typicalSen: e.estimatedSen, approximate: e.approximate };
      } catch {
        return { type: node.type, label: node.label, description: node.description, available: false as const };
      }
    }),
  );

  return c.json(
    { currency: "MYR", studios, models: priced.filter((p): p is NonNullable<typeof p> => p !== null) },
    200,
    { "cache-control": CACHE },
  );
});

function typicalRequestFor(model: { category: string }): CanonicalInput {
  switch (model.category) {
    case "image": return { prompt: "a rainy cyberpunk street" };
    case "video": return { prompt: "a rainy cyberpunk street" };
    case "audio": return { text: "The quick brown fox jumps over the lazy dog." };
    default: return { prompt: "Write a short logline." };
  }
}
