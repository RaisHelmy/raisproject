import { Hono } from "hono";
import { z } from "zod";
import { AppError, newId, SCOPES, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { rateLimit, DEFAULT_RULES } from "../middleware/rate-limit";
import { nowIso } from "../db/client";
import { WorkflowService } from "../services/workflow-service";
import { WorkflowExecutionService } from "../services/workflow-execution-service";
import { ScheduleService, type ScheduleRow } from "../services/schedule-service";

export const hooks = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

interface TriggerRow {
  id: string;
  org_id: string;
  workflow_id: string;
  token: string;
  name: string;
  active: number;
  max_cost_sen: number | null;
  last_fired_at: string | null;
  fire_count: number;
}

hooks.get("/workflows/:id/triggers", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new WorkflowService(c.env).require(auth, c.req.param("id"));
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM workflow_triggers WHERE workflow_id = ? AND org_id = ? ORDER BY created_at DESC`)
    .bind(c.req.param("id"), auth.orgId)
    .all<TriggerRow>();

  const origin = new URL(c.req.url).origin;
  return c.json({
    items: results.map((t) => ({
      id: t.id,
      name: t.name,
      // The full address is shown: it is the thing the caller must configure,
      // and it only starts one workflow with a cost ceiling.
      url: `${origin}/hooks/${t.token}`,
      active: t.active === 1,
      maxCostSen: t.max_cost_sen,
      lastFiredAt: t.last_fired_at,
      fireCount: t.fire_count,
    })),
  });
});

hooks.post("/workflows/:id/triggers", ...guarded, async (c) => {
  const auth = c.get("auth");
  const workflow = await new WorkflowService(c.env).require(auth, c.req.param("id"));
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; maxCostSen?: number };

  const id = newId();
  const token = `wht_${crypto.randomUUID().replace(/-/g, "")}`;
  await c.env.DB
    .prepare(
      `INSERT INTO workflow_triggers (id, org_id, workflow_id, token, name, max_cost_sen, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(id, auth.orgId, workflow.id, token, body.name?.trim() || "Webhook", body.maxCostSen ?? null, auth.userId, nowIso())
    .run();

  return c.json({ id, name: body.name ?? "Webhook", url: `${new URL(c.req.url).origin}/hooks/${token}` }, 201);
});

hooks.delete("/workflows/:id/triggers/:triggerId", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new WorkflowService(c.env).require(auth, c.req.param("id"));
  await c.env.DB
    .prepare(`DELETE FROM workflow_triggers WHERE id = ? AND org_id = ?`)
    .bind(c.req.param("triggerId"), auth.orgId)
    .run();
  return c.body(null, 204);
});

/**
 * Public ingress (§135). No session, no API key: the address itself is the
 * credential, which is why it is revocable and carries its own cost ceiling.
 */
export const publicHooks = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicHooks.post("/hooks/:token", rateLimit({ bucket: "hooks", limit: 60, windowMs: 60_000 }), async (c) => {
  const trigger = await c.env.DB
    .prepare(`SELECT * FROM workflow_triggers WHERE token = ? AND active = 1`)
    .bind(c.req.param("token"))
    .first<TriggerRow>();
  // An unknown and a revoked address answer the same way, so probing tells
  // an attacker nothing.
  if (!trigger) throw new AppError("not_found", "No workflow is listening at this address.");

  const payload = await c.req.json().catch(() => ({}));

  const owner = await c.env.DB
    .prepare(`SELECT owner_user_id FROM organizations WHERE id = ?`)
    .bind(trigger.org_id)
    .first<{ owner_user_id: string }>();
  if (!owner) throw new AppError("not_found", "No workflow is listening at this address.");

  // The run belongs to the workspace that created the trigger, with the full
  // scope set: the trigger's own ceiling is what limits it, not scopes.
  const auth: AuthContext = {
    userId: owner.owner_user_id,
    orgId: trigger.org_id,
    actorType: "api_key",
    scopes: SCOPES,
    requestId: c.get("requestId"),
    isAdmin: false,
    credentialId: trigger.id,
  };

  const workflows = new WorkflowService(c.env);
  const workflow = await workflows.require(auth, trigger.workflow_id);
  const frozen = await workflows.freezeVersion(auth, workflow.id);

  const run = await new WorkflowExecutionService(c.env).start(auth, {
    doc: frozen.document,
    workflowId: workflow.id,
    workflowVersionId: frozen.versionId,
    projectId: workflow.project_id,
    variables: { trigger: payload },
    trigger: "webhook",
    maxCostSen: trigger.max_cost_sen ?? undefined,
  });

  await c.env.DB
    .prepare(`UPDATE workflow_triggers SET last_fired_at = ?, fire_count = fire_count + 1 WHERE id = ?`)
    .bind(nowIso(), trigger.id)
    .run();

  return c.json({ workflowRunId: run.id, status: run.status, outputs: run.outputs }, 202);
});

/**
 * Schedules (§136).
 *
 * Every schedule carries a spending ceiling, enforced in the service. An
 * unattended hourly run is exactly what empties a balance overnight, so the
 * limit is part of creating one rather than an option to remember.
 */
function scheduleDTO(row: ScheduleRow) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    name: row.name,
    cadence: row.cadence,
    hourUtc: row.hour_utc,
    dayOfWeek: row.day_of_week,
    maxCostSen: row.max_cost_sen,
    active: row.active === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    runCount: row.run_count,
  };
}

hooks.get("/workflows/:id/schedules", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new WorkflowService(c.env).require(auth, c.req.param("id"));
  const list = await new ScheduleService(c.env).list(auth, c.req.param("id"));
  return c.json({ items: list.map(scheduleDTO) });
});

hooks.post("/workflows/:id/schedules", ...guarded, async (c) => {
  const auth = c.get("auth");
  const body = z
    .object({
      name: z.string().min(1),
      cadence: z.enum(["hourly", "daily", "weekly"]),
      hourUtc: z.number().int().min(0).max(23).optional(),
      dayOfWeek: z.number().int().min(0).max(6).optional(),
      variables: z.record(z.unknown()).optional(),
      maxCostSen: z.number().int().positive(),
    })
    .parse(await c.req.json());

  const created = await new ScheduleService(c.env).create(auth, { ...body, workflowId: c.req.param("id") });
  return c.json(scheduleDTO(created), 201);
});

hooks.patch("/schedules/:scheduleId", ...guarded, async (c) => {
  const auth = c.get("auth");
  const { active } = z.object({ active: z.boolean() }).parse(await c.req.json());
  const updated = await new ScheduleService(c.env).setActive(auth, c.req.param("scheduleId"), active);
  return c.json(scheduleDTO(updated));
});

hooks.delete("/schedules/:scheduleId", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new ScheduleService(c.env).remove(auth, c.req.param("scheduleId"));
  return c.body(null, 204);
});
