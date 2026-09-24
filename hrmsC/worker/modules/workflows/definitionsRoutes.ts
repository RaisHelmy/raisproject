import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { WorkflowDefinition, WorkflowStep } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requirePermission("workflows.manage"));

app.get("/", async (c) => {
  const auth = c.get("auth");
  const module = c.req.query("module");
  let sql = `SELECT * FROM workflow_definitions WHERE tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (module) {
    sql += ` AND module = ?`;
    params.push(module);
  }
  sql += ` ORDER BY created_at`;
  const definitions = await queryAll<WorkflowDefinition>(c.env.DB, sql, params);

  const withSteps = [];
  for (const def of definitions) {
    const steps = await queryAll<WorkflowStep>(
      c.env.DB,
      `SELECT * FROM workflow_steps WHERE workflow_definition_id = ? ORDER BY step_order`,
      [def.id],
    );
    withSteps.push({ ...def, steps });
  }
  return c.json({ definitions: withSteps });
});

const createDefinitionSchema = z.object({
  module: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional().nullable(),
  minAmount: z.number().optional().nullable(),
  maxAmount: z.number().optional().nullable(),
  isDefault: z.boolean().default(false),
});

app.post("/", async (c) => {
  const body = createDefinitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO workflow_definitions (id, tenant_id, module, name, category, min_amount, max_amount, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.module, d.name, d.category ?? null, d.minAmount ?? null, d.maxAmount ?? null, d.isDefault ? 1 : 0],
  );
  const definition = await queryOne<WorkflowDefinition>(
    c.env.DB,
    `SELECT * FROM workflow_definitions WHERE id = ?`,
    [id],
  );
  return c.json({ definition: { ...definition, steps: [] } }, 201);
});

const updateDefinitionSchema = createDefinitionSchema.partial().extend({ isActive: z.boolean().optional() });

app.put("/:id", async (c) => {
  const body = updateDefinitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<WorkflowDefinition>(
    c.env.DB,
    `SELECT * FROM workflow_definitions WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE workflow_definitions SET name=?, category=?, min_amount=?, max_amount=?, is_default=?, is_active=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.category !== undefined ? d.category : existing.category,
      d.minAmount !== undefined ? d.minAmount : existing.min_amount,
      d.maxAmount !== undefined ? d.maxAmount : existing.max_amount,
      d.isDefault !== undefined ? (d.isDefault ? 1 : 0) : existing.is_default,
      d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active,
      id,
      auth.tenantId,
    ],
  );
  const definition = await queryOne<WorkflowDefinition>(
    c.env.DB,
    `SELECT * FROM workflow_definitions WHERE id = ?`,
    [id],
  );
  return c.json({ definition });
});

app.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const inUse = await queryOne<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*)::int as n FROM workflow_instances WHERE workflow_definition_id = ?`,
    [id],
  );
  if ((inUse?.n ?? 0) > 0) {
    return c.json({ error: "This workflow has been used by submitted requests; deactivate it instead of deleting" }, 400);
  }
  await exec(c.env.DB, `DELETE FROM workflow_steps WHERE workflow_definition_id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  const result = await exec(c.env.DB, `DELETE FROM workflow_definitions WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

const stepSchema = z.object({
  stepName: z.string().min(1).max(160),
  approverType: z.enum(["employee_manager", "role", "specific_user"]),
  managerLevel: z.number().int().min(1).max(10).default(1),
  approverRole: z.enum(["admin", "hr"]).optional().nullable(),
  approverUserId: z.string().optional().nullable(),
});

app.post("/:defId/steps", async (c) => {
  const body = stepSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const defId = c.req.param("defId");
  const definition = await queryOne<WorkflowDefinition>(
    c.env.DB,
    `SELECT * FROM workflow_definitions WHERE id = ? AND tenant_id = ?`,
    [defId, auth.tenantId],
  );
  if (!definition) return c.json({ error: "Not found" }, 404);

  const d = body.data;
  if (d.approverType === "role" && !d.approverRole) {
    return c.json({ error: "approverRole is required for role-based steps" }, 400);
  }
  if (d.approverType === "specific_user" && !d.approverUserId) {
    return c.json({ error: "approverUserId is required for specific-user steps" }, 400);
  }

  const maxOrder = await queryOne<{ n: number }>(
    c.env.DB,
    `SELECT COALESCE(MAX(step_order), 0) as n FROM workflow_steps WHERE workflow_definition_id = ?`,
    [defId],
  );
  const stepOrder = (maxOrder?.n ?? 0) + 1;

  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO workflow_steps
       (id, tenant_id, workflow_definition_id, step_order, step_name, approver_type, manager_level, approver_role, approver_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      auth.tenantId,
      defId,
      stepOrder,
      d.stepName,
      d.approverType,
      d.managerLevel,
      d.approverType === "role" ? d.approverRole : null,
      d.approverType === "specific_user" ? d.approverUserId : null,
    ],
  );

  const step = await queryOne<WorkflowStep>(c.env.DB, `SELECT * FROM workflow_steps WHERE id = ?`, [id]);
  return c.json({ step }, 201);
});

app.put("/:defId/steps/:stepId", async (c) => {
  const body = stepSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const { defId, stepId } = c.req.param();
  const existing = await queryOne<WorkflowStep>(
    c.env.DB,
    `SELECT * FROM workflow_steps WHERE id = ? AND workflow_definition_id = ? AND tenant_id = ?`,
    [stepId, defId, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);

  const d = body.data;
  const approverType = d.approverType ?? existing.approver_type;
  await exec(
    c.env.DB,
    `UPDATE workflow_steps SET step_name=?, approver_type=?, manager_level=?, approver_role=?, approver_user_id=? WHERE id=?`,
    [
      d.stepName ?? existing.step_name,
      approverType,
      d.managerLevel ?? existing.manager_level,
      approverType === "role" ? (d.approverRole !== undefined ? d.approverRole : existing.approver_role) : null,
      approverType === "specific_user"
        ? (d.approverUserId !== undefined ? d.approverUserId : existing.approver_user_id)
        : null,
      stepId,
    ],
  );
  const step = await queryOne<WorkflowStep>(c.env.DB, `SELECT * FROM workflow_steps WHERE id = ?`, [stepId]);
  return c.json({ step });
});

app.delete("/:defId/steps/:stepId", async (c) => {
  const auth = c.get("auth");
  const { defId, stepId } = c.req.param();
  const result = await exec(
    c.env.DB,
    `DELETE FROM workflow_steps WHERE id = ? AND workflow_definition_id = ? AND tenant_id = ?`,
    [stepId, defId, auth.tenantId],
  );
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);

  const remaining = await queryAll<WorkflowStep>(
    c.env.DB,
    `SELECT * FROM workflow_steps WHERE workflow_definition_id = ? ORDER BY step_order`,
    [defId],
  );
  for (let i = 0; i < remaining.length; i++) {
    const desiredOrder = i + 1;
    if (remaining[i].step_order !== desiredOrder) {
      await exec(c.env.DB, `UPDATE workflow_steps SET step_order = ? WHERE id = ?`, [desiredOrder, remaining[i].id]);
    }
  }
  return c.json({ ok: true });
});

const reorderSchema = z.object({ orderedStepIds: z.array(z.string()).min(1) });

app.post("/:defId/steps/reorder", async (c) => {
  const body = reorderSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const defId = c.req.param("defId");
  const steps = await queryAll<WorkflowStep>(
    c.env.DB,
    `SELECT * FROM workflow_steps WHERE workflow_definition_id = ? AND tenant_id = ?`,
    [defId, auth.tenantId],
  );
  const validIds = new Set(steps.map((s) => s.id));
  if (body.data.orderedStepIds.length !== steps.length || !body.data.orderedStepIds.every((id) => validIds.has(id))) {
    return c.json({ error: "orderedStepIds must match this workflow's existing steps exactly" }, 400);
  }
  for (let i = 0; i < body.data.orderedStepIds.length; i++) {
    await exec(c.env.DB, `UPDATE workflow_steps SET step_order = ? WHERE id = ?`, [i + 1, body.data.orderedStepIds[i]]);
  }
  const updated = await queryAll<WorkflowStep>(
    c.env.DB,
    `SELECT * FROM workflow_steps WHERE workflow_definition_id = ? ORDER BY step_order`,
    [defId],
  );
  return c.json({ steps: updated });
});

export default app;
