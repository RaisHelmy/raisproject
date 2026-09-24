import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { WorkflowService, type WorkflowRow } from "../services/workflow-service";
import { WorkflowExecutionService } from "../services/workflow-execution-service";
import { ProjectService } from "../services/project-service";
import { registerBuiltinNodes } from "../engine/nodes";
import { listNodeDefinitions, toPaletteEntry } from "../engine/registry";
import { workflowDocumentSchema } from "../engine/document";

export const workflows = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: WorkflowRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectId: row.project_id,
    version: row.current_version,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The node library. Serializable definitions only; executors stay server-side (§128). */
workflows.get("/nodes", requireAuth(), async (c) => {
  registerBuiltinNodes();
  return c.json({ items: listNodeDefinitions().map(toPaletteEntry) });
});

workflows.get("/workflows", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read workflows.");
  const list = await new WorkflowService(c.env).list(auth, c.req.query("projectId"));
  return c.json({ items: list.map(toDTO) });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().optional(),
  document: z.record(z.unknown()).optional(),
});

workflows.post("/workflows", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:write")) throw new AppError("insufficient_scope", "This token cannot create workflows.");
  const body = createSchema.parse(await c.req.json());
  const projectId = body.projectId ?? (await new ProjectService(c.env).getOrCreateDefault(auth)).id;
  const created = await new WorkflowService(c.env).create(auth, {
    name: body.name,
    description: body.description,
    projectId,
    document: body.document ? workflowDocumentSchema.parse(body.document) : undefined,
  });
  return c.json({ ...toDTO(created.workflow), document: created.document }, 201);
});

workflows.get("/workflows/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read workflows.");
  const { workflow, document, hasUnsavedChanges } = await new WorkflowService(c.env).get(auth, c.req.param("id"));
  return c.json({ ...toDTO(workflow), document, hasUnsavedChanges });
});

/** Autosave. Called continuously by the editor, so it stays cheap (§84). */
workflows.patch("/workflows/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:write")) throw new AppError("insufficient_scope", "This token cannot edit workflows.");
  const body = z
    .object({ name: z.string().optional(), description: z.string().optional(), document: z.record(z.unknown()).optional() })
    .parse(await c.req.json());

  const service = new WorkflowService(c.env);
  if (body.name !== undefined || body.description !== undefined) {
    await service.rename(auth, c.req.param("id"), { name: body.name, description: body.description });
  }
  if (body.document) {
    await service.saveDraft(auth, c.req.param("id"), workflowDocumentSchema.parse(body.document));
  }
  return c.json({ savedAt: new Date().toISOString() });
});

workflows.delete("/workflows/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:write")) throw new AppError("insufficient_scope", "This token cannot delete workflows.");
  await new WorkflowService(c.env).softDelete(auth, c.req.param("id"));
  return c.body(null, 204);
});

/** Validation and cost preview before anyone spends anything (§28, §127). */
workflows.post("/workflows/:id/preview", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read workflows.");
  const body = z.object({ variables: z.record(z.unknown()).default({}) }).parse(await c.req.json().catch(() => ({})));

  const { workflow, document } = await new WorkflowService(c.env).get(auth, c.req.param("id"));
  const preview = await new WorkflowExecutionService(c.env).preview(auth, document, body.variables, workflow.project_id);
  return c.json({
    valid: preview.valid,
    errors: preview.errors,
    estimatedSen: preview.estimatedSen,
    approximate: preview.approximate,
    currency: "MYR",
  });
});

/**
 * Portable JSON (§129, §130). The export is the domain document plus a header,
 * so a workflow can move between workspaces or into version control without
 * carrying ids that only mean something here.
 */
workflows.get("/workflows/:id/export", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:read")) throw new AppError("insufficient_scope", "This token cannot read workflows.");
  const { workflow, document } = await new WorkflowService(c.env).get(auth, c.req.param("id"));

  return c.json({
    format: "raisai.workflow",
    formatVersion: 1,
    name: workflow.name,
    // Omitted rather than null: an exported file must always be importable,
    // and a null here was being rejected on the way back in.
    ...(workflow.description ? { description: workflow.description } : {}),
    exportedAt: new Date().toISOString(),
    document,
  });
});

const importSchema = z.object({
  format: z.literal("raisai.workflow").optional(),
  name: z.string().optional(),
  // Tolerant of null as well as absent, so a hand-edited file still imports.
  description: z.string().nullish(),
  document: z.record(z.unknown()),
  projectId: z.string().optional(),
});

workflows.post("/workflows/import", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:write")) throw new AppError("insufficient_scope", "This token cannot create workflows.");
  const body = importSchema.parse(await c.req.json());

  // Parsed through the same schema as any other document, so a malformed or
  // hand-edited file is refused here rather than failing mid-run.
  let document;
  try {
    document = workflowDocumentSchema.parse(body.document);
  } catch {
    throw new AppError("invalid_input", "That file is not a valid RaisAI workflow.", {
      action: "Export it again from RaisAI, or check the JSON.",
    });
  }

  const projectId = body.projectId ?? (await new ProjectService(c.env).getOrCreateDefault(auth)).id;
  const created = await new WorkflowService(c.env).create(auth, {
    name: body.name?.trim() || "Imported workflow",
    description: body.description ?? undefined,
    projectId,
    document,
  });
  return c.json({ ...toDTO(created.workflow), document: created.document }, 201);
});

workflows.post("/workflows/:id/duplicate", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:write")) throw new AppError("insufficient_scope", "This token cannot create workflows.");
  const service = new WorkflowService(c.env);
  const { workflow, document } = await service.get(auth, c.req.param("id"));

  const copy = await service.create(auth, {
    name: `${workflow.name} (copy)`,
    description: workflow.description ?? undefined,
    projectId: workflow.project_id,
    document,
  });
  return c.json(toDTO(copy.workflow), 201);
});

workflows.post("/workflows/:id/run", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "workflows:execute")) throw new AppError("insufficient_scope", "This token cannot run workflows.");
  const body = z
    .object({
      variables: z.record(z.unknown()).default({}),
      fromNodeIds: z.array(z.string()).optional(),
      rerunOfRunId: z.string().optional(),
      maxCostSen: z.number().int().positive().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const service = new WorkflowService(c.env);
  const { workflow } = await service.get(auth, c.req.param("id"));
  // Running freezes the draft, so the run points at an immutable version (§118).
  const frozen = await service.freezeVersion(auth, workflow.id);

  const run = await new WorkflowExecutionService(c.env).start(auth, {
    doc: frozen.document,
    workflowId: workflow.id,
    workflowVersionId: frozen.versionId,
    projectId: workflow.project_id,
    variables: body.variables,
    trigger: auth.actorType === "user" ? "ui" : auth.actorType === "mcp" ? "mcp" : "api",
    fromNodeIds: body.fromNodeIds,
    rerunOfRunId: body.rerunOfRunId,
    maxCostSen: body.maxCostSen,
    idempotencyKey: c.req.header("idempotency-key"),
  });

  return c.json(
    {
      id: run.id,
      status: run.status,
      estimatedCostSen: run.estimatedCostSen,
      chargedSen: run.actualCostSen,
      outputs: run.outputs,
      nodes: run.nodes.map((n) => ({
        nodeId: n.nodeId, status: n.status, attempt: n.attempt,
        chargedSen: n.actualCostSen ?? 0, durationMs: n.durationMs ?? null,
        outputs: n.outputs ?? null, error: n.error ?? null,
      })),
      ...(run.error ? { error: run.error } : {}),
      ...(run.pauseReason ? { pauseReason: run.pauseReason } : {}),
    },
    201,
  );
});
