import { AppError, newId, SCOPES, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { WorkflowService } from "./workflow-service";
import { WorkflowExecutionService } from "./workflow-execution-service";
import { Logger } from "../lib/logger";

export type Cadence = "hourly" | "daily" | "weekly";

export interface ScheduleRow {
  id: string;
  org_id: string;
  workflow_id: string;
  name: string;
  cadence: Cadence;
  hour_utc: number;
  day_of_week: number | null;
  variables_json: string;
  max_cost_sen: number | null;
  active: number;
  last_run_at: string | null;
  next_run_at: string;
  run_count: number;
}

/**
 * Scheduled workflow runs (§136).
 *
 * Every schedule must carry a cost ceiling. A workflow that runs unattended
 * every hour is exactly the thing that empties a balance overnight, and the
 * person who set it up is asleep.
 */
export class ScheduleService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  async create(
    auth: AuthContext,
    input: { workflowId: string; name: string; cadence: Cadence; hourUtc?: number; dayOfWeek?: number; variables?: Record<string, unknown>; maxCostSen: number },
  ): Promise<ScheduleRow> {
    await new WorkflowService(this.env).require(auth, input.workflowId);

    if (!Number.isInteger(input.maxCostSen) || input.maxCostSen <= 0) {
      throw new AppError("invalid_input", "A schedule needs a spending limit per run.", {
        action: "Set the most this run may cost.",
      });
    }
    const hourUtc = input.hourUtc ?? 9;
    if (hourUtc < 0 || hourUtc > 23) throw new AppError("invalid_input", "The hour must be between 0 and 23.");
    if (input.cadence === "weekly" && (input.dayOfWeek === undefined || input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
      throw new AppError("invalid_input", "A weekly schedule needs a day of the week.");
    }

    const id = newId();
    await this.env.DB
      .prepare(
        `INSERT INTO workflow_schedules (id, org_id, workflow_id, name, cadence, hour_utc, day_of_week,
            variables_json, max_cost_sen, next_run_at, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id, auth.orgId, input.workflowId, input.name.trim() || "Schedule", input.cadence, hourUtc,
        input.cadence === "weekly" ? input.dayOfWeek! : null,
        JSON.stringify(input.variables ?? {}), input.maxCostSen,
        nextRunAt(input.cadence, hourUtc, input.dayOfWeek).toISOString(), auth.userId, nowIso(),
      )
      .run();
    return this.require(auth, id);
  }

  async list(auth: AuthContext, workflowId?: string): Promise<ScheduleRow[]> {
    const sql = workflowId
      ? `SELECT * FROM workflow_schedules WHERE org_id = ? AND workflow_id = ? ORDER BY created_at DESC`
      : `SELECT * FROM workflow_schedules WHERE org_id = ? ORDER BY created_at DESC`;
    const { results } = await this.env.DB
      .prepare(sql)
      .bind(...(workflowId ? [auth.orgId, workflowId] : [auth.orgId]))
      .all<ScheduleRow>();
    return results;
  }

  async require(auth: AuthContext, id: string): Promise<ScheduleRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM workflow_schedules WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<ScheduleRow>();
    if (!row) throw new AppError("not_found", "Schedule not found.");
    return row;
  }

  async setActive(auth: AuthContext, id: string, active: boolean): Promise<ScheduleRow> {
    await this.require(auth, id);
    await this.env.DB
      .prepare(`UPDATE workflow_schedules SET active = ? WHERE id = ? AND org_id = ?`)
      .bind(active ? 1 : 0, id, auth.orgId)
      .run();
    return this.require(auth, id);
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.require(auth, id);
    await this.env.DB.prepare(`DELETE FROM workflow_schedules WHERE id = ? AND org_id = ?`).bind(id, auth.orgId).run();
  }

  /**
   * Runs everything that is due. Called from the cron trigger.
   *
   * The next run time is advanced before the work starts, so a slow or failing
   * run cannot cause the same schedule to fire repeatedly.
   */
  async runDue(
    now: Date = new Date(),
    options: { limit?: number; provider?: import("../providers/types").AIProvider } = {},
  ): Promise<{ fired: number; failed: number }> {
    const logger = new Logger({ job: "schedules" });
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM workflow_schedules WHERE active = 1 AND next_run_at <= ? ORDER BY next_run_at LIMIT ?`)
      .bind(now.toISOString(), options.limit ?? 20)
      .all<ScheduleRow>();

    let fired = 0;
    let failed = 0;

    for (const schedule of results) {
      const advanceTo = nextRunAt(schedule.cadence, schedule.hour_utc, schedule.day_of_week ?? undefined, now);
      await this.env.DB
        .prepare(`UPDATE workflow_schedules SET next_run_at = ?, last_run_at = ?, run_count = run_count + 1 WHERE id = ?`)
        .bind(advanceTo.toISOString(), now.toISOString(), schedule.id)
        .run();

      try {
        const owner = await this.env.DB
          .prepare(`SELECT owner_user_id FROM organizations WHERE id = ?`)
          .bind(schedule.org_id)
          .first<{ owner_user_id: string }>();
        if (!owner) continue;

        const auth: AuthContext = {
          userId: owner.owner_user_id, orgId: schedule.org_id, actorType: "api_key",
          scopes: SCOPES, requestId: newId(), isAdmin: false, credentialId: schedule.id,
        };

        const workflows = new WorkflowService(this.env);
        const workflow = await workflows.require(auth, schedule.workflow_id);
        const frozen = await workflows.freezeVersion(auth, workflow.id);

        await new WorkflowExecutionService(this.env).start(auth, {
          doc: frozen.document,
          workflowId: workflow.id,
          workflowVersionId: frozen.versionId,
          projectId: workflow.project_id,
          variables: JSON.parse(schedule.variables_json) as Record<string, unknown>,
          trigger: "api",
          maxCostSen: schedule.max_cost_sen ?? undefined,
          ...(options.provider ? { provider: options.provider } : {}),
        });
        fired += 1;
      } catch (error) {
        failed += 1;
        // A failing schedule is logged and left active: one bad run should not
        // silently switch off something the user set up.
        logger.error("schedule.run_failed", {
          scheduleId: schedule.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { fired, failed };
  }
}

/** The next occurrence strictly after `from`. */
export function nextRunAt(cadence: Cadence, hourUtc: number, dayOfWeek?: number, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  if (cadence === "hourly") {
    next.setUTCMinutes(0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }

  next.setUTCMinutes(0);
  next.setUTCHours(hourUtc);
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  if (cadence === "weekly" && dayOfWeek !== undefined) {
    while (next.getUTCDay() !== dayOfWeek) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}
