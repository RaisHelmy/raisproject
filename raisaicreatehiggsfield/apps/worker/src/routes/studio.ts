import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { StudioService } from "../services/studio-service";
import { toGenerationDTO } from "../dto/generation";

export const studio = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

const inputSchema = z.object({
  prompt: z.string().optional(),
  imageAssetIds: z.array(z.string()).max(10).optional(),
  maskAssetId: z.string().optional(),
  videoAssetId: z.string().optional(),
  audioAssetId: z.string().optional(),
  modelId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  projectId: z.string().optional(),
});

/** The studios and whether any enabled model can serve each one right now. */
studio.get("/studios", requireAuth(), async (c) => {
  return c.json({ items: await new StudioService(c.env).list() });
});

studio.post("/studios/:type/estimate", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot estimate cost.");
  const body = inputSchema.parse(await c.req.json());
  return c.json(await new StudioService(c.env).estimate(auth, c.req.param("type"), body));
});

studio.post("/studios/:type/run", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot create generations.");
  const body = inputSchema.parse(await c.req.json());
  const result = await new StudioService(c.env).run(auth, c.req.param("type"), {
    ...body,
    idempotencyKey: c.req.header("idempotency-key"),
  });
  return c.json(
    { generation: toGenerationDTO(result.generation, result.outputs), balanceAfterSen: result.balanceAfterSen },
    201,
  );
});
