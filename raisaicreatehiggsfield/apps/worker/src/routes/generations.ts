import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { GenerationService } from "../services/generation-service";
import { WorkflowExecutionService } from "../services/workflow-execution-service";
import { toGenerationDTO } from "../dto/generation";

export const generations = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

const createSchema = z.object({
  modelId: z.string().min(1),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  imageAssetIds: z.array(z.string()).max(10).optional(),
  parameters: z.record(z.unknown()).optional(),
  projectId: z.string().optional(),
});

generations.post("/generations", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot create generations.");
  const body = createSchema.parse(await c.req.json());

  const result = await new GenerationService(c.env).create(auth, {
    ...body,
    idempotencyKey: c.req.header("idempotency-key"),
  });

  return c.json(
    {
      generation: toGenerationDTO(result.generation, result.outputs),
      balanceAfterSen: result.balanceAfterSen,
    },
    201,
  );
});

generations.get("/generations", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:read")) throw new AppError("insufficient_scope", "This token cannot read generations.");
  const { items, nextCursor } = await new GenerationService(c.env).list(auth, {
    projectId: c.req.query("projectId"),
    modelId: c.req.query("modelId"),
    status: c.req.query("status"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    cursor: c.req.query("cursor"),
  });
  return c.json({ items: items.map((i) => toGenerationDTO(i.generation, i.outputs)), nextCursor });
});

/**
 * The graph a generation actually ran (ADR-004).
 *
 * Quick Create really is a workflow, so "open in workflow" hands over a real
 * document rather than reconstructing something that looks similar. Returned
 * as a document to import, not the hidden system workflow itself, so editing
 * it cannot rewrite history.
 */
generations.get("/generations/:id/workflow", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:read")) throw new AppError("insufficient_scope", "This token cannot read generations.");

  const row = await c.env.DB
    .prepare(
      `SELECT wv.document_json, g.model_id FROM generations g
         JOIN workflow_runs wr ON wr.id = g.workflow_run_id
         JOIN workflow_versions wv ON wv.id = wr.workflow_version_id
        WHERE g.id = ? AND g.org_id = ?`,
    )
    .bind(c.req.param("id"), auth.orgId)
    .first<{ document_json: string; model_id: string }>();

  if (!row) {
    throw new AppError("not_found", "That generation has no workflow to open.", {
      action: "Only generations made in this workspace can be opened.",
    });
  }
  return c.json({
    format: "raisai.workflow",
    formatVersion: 1,
    name: `From ${row.model_id.split("/").pop()}`,
    document: JSON.parse(row.document_json) as unknown,
  });
});

/**
 * Stops a generation that is still running (§57).
 *
 * A generation is one run underneath, so this is the run's own cancellation
 * with the id the customer actually holds.
 */
generations.post("/generations/:id/cancel", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot stop generations.");
  const { generation } = await new GenerationService(c.env).get(auth, c.req.param("id"));
  if (!generation.workflow_run_id) {
    throw new AppError("invalid_input", "That generation is not running.", { action: "Nothing to stop." });
  }
  return c.json(await new WorkflowExecutionService(c.env).cancel(auth, generation.workflow_run_id));
});

generations.get("/generations/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:read")) throw new AppError("insufficient_scope", "This token cannot read generations.");
  const { generation, outputs } = await new GenerationService(c.env).get(auth, c.req.param("id"));
  return c.json(toGenerationDTO(generation, outputs));
});
