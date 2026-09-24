import { AppError, newId, type AuthContext, type ModelDefinition, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { hashDocument, type WorkflowDocument } from "../engine/document";
import { estimateWorkflow, runWorkflow, type CacheStore, type NodeRunState, type RunResult } from "../engine/execute";
import { registerBuiltinNodes } from "../engine/nodes";
import { DEFAULT_LIMITS, validateWorkflow, type ValidationError } from "../engine/validate";
import type { PortValue } from "../engine/values";
import { buildEngineServices } from "./engine-services";
import { LedgerService } from "./ledger-service";
import { WebhookService } from "./webhook-service";
import { ModelService } from "./model-service";
import { AuditLogService } from "./audit-log-service";
import type { AIProvider } from "../providers/types";

export interface StartRunInput {
  doc: WorkflowDocument;
  workflowId: string;
  workflowVersionId: string;
  projectId: string;
  variables: Record<string, unknown>;
  trigger: "ui" | "api" | "mcp" | "webhook" | "template";
  templateVersionId?: string;
  fromNodeIds?: string[];
  rerunOfRunId?: string;
  maxCostSen?: Sen;
  idempotencyKey?: string;
  /** Injected in tests; production uses CloudflareAIProvider. */
  provider?: AIProvider;
  /**
   * "inline" finishes inside the request, which suits fast models. "durable"
   * hands the run to Cloudflare Workflows and returns immediately, which is
   * what slow work such as video needs (ADR-003). "auto" picks per workflow.
   */
  mode?: "inline" | "durable" | "auto";
}

/** Concurrent runs allowed per workspace. Advanced plans can raise this. */
const MAX_CONCURRENT_RUNS = 5;

export interface RunSummary {
  id: string;
  status: RunResult["status"] | "queued";
  estimatedCostSen: Sen;
  actualCostSen: Sen;
  outputs: Record<string, PortValue>;
  nodes: NodeRunState[];
  error?: RunResult["error"];
  pauseReason?: RunResult["pauseReason"];
}

/**
 * Orchestrates a workflow run end to end: validate, estimate, hold the money,
 * execute, then settle for what was actually spent (§71, §127).
 *
 * MVP runs inline. Long jobs move to the durable Cloudflare Workflow runner
 * (task 1.4.7) without changing this contract, which is why the engine is
 * separate from its host.
 */
export class WorkflowExecutionService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "RAIS_WORKFLOW_RUN">>) {
    registerBuiltinNodes();
  }

  /**
   * Validation and cost preview without running or holding money.
   *
   * `checkVariables` separates two different questions: "is this graph sound?"
   * (saving a template, autosaving a draft) and "can this run right now?"
   * (pressing Run). A template legitimately declares required inputs that are
   * only supplied at execution time.
   */
  async preview(
    auth: AuthContext,
    doc: WorkflowDocument,
    variables: Record<string, unknown>,
    projectId: string,
    options: { checkVariables?: boolean } = {},
  ) {
    const models = await this.modelsFor(doc);
    const errors = validateWorkflow(doc, {
      models,
      ...(options.checkVariables === false ? {} : { variables }),
    });
    if (errors.length > 0) return { valid: false as const, errors, estimatedSen: 0, approximate: false };

    const services = buildEngineServices(this.env, { auth, projectId, workflowRunId: "preview" });
    const estimate = await estimateWorkflow({
      doc, variables, auth, projectId,
      services: { getModel: services.getModel, estimateCost: services.estimateCost, findModels: services.findModels },
    });
    return { valid: true as const, errors: [] as ValidationError[], estimatedSen: estimate.totalSen, approximate: estimate.approximate };
  }

  async start(auth: AuthContext, input: StartRunInput): Promise<RunSummary> {
    // An idempotent replay returns the original run rather than charging twice (§120).
    if (input.idempotencyKey) {
      const existing = await this.env.DB
        .prepare(`SELECT id FROM workflow_runs WHERE org_id = ? AND idempotency_key = ?`)
        .bind(auth.orgId, input.idempotencyKey)
        .first<{ id: string }>();
      if (existing) return this.get(auth, existing.id);
    }

    await this.assertRunSlotAvailable(auth);

    const models = await this.modelsFor(input.doc);
    const errors = validateWorkflow(input.doc, { models, variables: input.variables, limits: DEFAULT_LIMITS });
    if (errors.length > 0) {
      throw new AppError("workflow_invalid", errors[0]!.message, {
        action: errors[0]!.action,
        details: { errors },
      });
    }

    const services = buildEngineServices(this.env, {
      auth, projectId: input.projectId, workflowRunId: "pending", provider: input.provider,
    });
    const estimate = await estimateWorkflow({
      doc: input.doc, variables: input.variables, auth, projectId: input.projectId,
      services: { getModel: services.getModel, estimateCost: services.estimateCost, findModels: services.findModels },
    });

    const ledger = new LedgerService(this.env);
    const runId = newId();

    // Money is held before any provider call, and released or settled after.
    const { reservationId } = await ledger.reserve(auth.orgId, Math.max(estimate.totalSen, 1), {
      referenceType: "workflow_run",
      referenceId: runId,
      requestId: auth.requestId,
      createdBy: auth.userId,
    });

    await this.env.DB
      .prepare(
        `INSERT INTO workflow_runs (id, org_id, project_id, user_id, workflow_id, workflow_version_id,
            template_version_id, trigger, status, variables_json, estimated_cost_sen, max_cost_sen,
            reservation_txn_id, partial_from_node_ids_json, rerun_of_run_id, request_id, idempotency_key, started_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,'running',?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        runId, auth.orgId, input.projectId, auth.userId, input.workflowId, input.workflowVersionId,
        input.templateVersionId ?? null, input.trigger, JSON.stringify(input.variables),
        estimate.totalSen, input.maxCostSen ?? input.doc.settings.maxCostSen ?? null,
        reservationId, input.fromNodeIds ? JSON.stringify(input.fromNodeIds) : null,
        input.rerunOfRunId ?? null, auth.requestId, input.idempotencyKey ?? null, nowIso(), nowIso(),
      )
      .run();

    // A run that could outlast a request goes to the durable host instead.
    const durable = this.shouldRunDurably(input, models);
    if (durable && this.env.RAIS_WORKFLOW_RUN) {
      const instance = await this.env.RAIS_WORKFLOW_RUN.create({
        params: {
          workflowRunId: runId, userId: auth.userId, orgId: auth.orgId,
          projectId: input.projectId, requestId: auth.requestId, isAdmin: auth.isAdmin,
        },
      });
      await this.env.DB
        .prepare(`UPDATE workflow_runs SET status='queued', cf_workflow_instance_id=? WHERE id=?`)
        .bind(instance.id, runId)
        .run();
      return {
        id: runId, status: "queued", estimatedCostSen: estimate.totalSen,
        actualCostSen: 0, outputs: {}, nodes: [],
      };
    }

    const runServices = buildEngineServices(this.env, {
      auth, projectId: input.projectId, workflowRunId: runId, provider: input.provider,
    });

    let result: RunResult;
    try {
      result = await runWorkflow({
        doc: input.doc,
        variables: input.variables,
        auth,
        projectId: input.projectId,
        workflowRunId: runId,
        services: runServices,
        cache: this.cacheStore(auth),
        fromNodeIds: input.fromNodeIds,
        seedOutputs: input.rerunOfRunId ? await this.outputsFromRun(auth, input.rerunOfRunId) : undefined,
        maxCostSen: input.maxCostSen ?? input.doc.settings.maxCostSen,
      });
    } catch (error) {
      // Nothing ran, so the whole hold goes back.
      await ledger.releaseReservation(reservationId, { requestId: auth.requestId }).catch(() => undefined);
      await this.env.DB
        .prepare(`UPDATE workflow_runs SET status='failed', error_json=?, completed_at=? WHERE id=?`)
        .bind(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }), nowIso(), runId)
        .run();
      throw error;
    }

    const settlement = await this.finish(auth, {
      workflowRunId: runId,
      reservationId,
      result: {
        status: result.status,
        outputs: result.outputs,
        actualCostSen: result.actualCostSen,
        nodes: result.nodes,
        error: result.error,
        pauseReason: result.pauseReason,
      },
    });

    return {
      id: runId,
      status: result.status,
      estimatedCostSen: estimate.totalSen,
      actualCostSen: settlement.chargedSen,
      outputs: result.outputs,
      nodes: result.nodes,
      ...(result.error ? { error: result.error } : {}),
      ...(result.pauseReason ? { pauseReason: result.pauseReason } : {}),
    };
  }

  /**
   * Asks a run to stop (§24, §57).
   *
   * The request is recorded rather than applied: work already handed to a
   * provider cannot be recalled, and money that has been spent still has to be
   * settled honestly. The runner checks between nodes, stops scheduling, and
   * the customer is charged for what was actually produced and nothing more.
   */
  async cancel(auth: AuthContext, runId: string): Promise<{ id: string; status: string }> {
    const run = await this.env.DB
      .prepare(`SELECT id, status, completed_at, cancel_requested_at FROM workflow_runs WHERE id = ? AND org_id = ?`)
      .bind(runId, auth.orgId)
      .first<{ id: string; status: string; completed_at: string | null; cancel_requested_at: string | null }>();
    if (!run) throw new AppError("not_found", "That run does not exist.");

    if (run.completed_at) {
      throw new AppError("invalid_input", `That run already ${run.status === "completed" ? "finished" : run.status}.`, {
        action: "Nothing is still running, so there is nothing to stop.",
      });
    }

    if (!run.cancel_requested_at) {
      await this.env.DB
        .prepare(`UPDATE workflow_runs SET cancel_requested_at = ? WHERE id = ? AND completed_at IS NULL`)
        .bind(nowIso(), runId)
        .run();
    }
    return { id: runId, status: "cancelling" };
  }

  /** True once someone has asked this run to stop. */
  async isCancelRequested(runId: string): Promise<boolean> {
    const row = await this.env.DB
      .prepare(`SELECT cancel_requested_at FROM workflow_runs WHERE id = ?`)
      .bind(runId)
      .first<{ cancel_requested_at: string | null }>();
    return Boolean(row?.cancel_requested_at);
  }

  /**
   * Persists node results, settles the hold and closes out the run.
   *
   * Shared by the inline path and the durable runner so both settle money the
   * same way; the durable runner calls it inside a step, which makes it safe to
   * replay.
   */
  async finish(
    auth: AuthContext,
    input: {
      workflowRunId: string;
      reservationId: string | null;
      result: {
        status: RunResult["status"];
        outputs: Record<string, PortValue>;
        actualCostSen: Sen;
        nodes: NodeRunState[];
        error?: RunResult["error"];
        pauseReason?: RunResult["pauseReason"];
      };
    },
  ): Promise<{ chargedSen: Sen }> {
    const { workflowRunId, reservationId, result } = input;

    const alreadyClosed = await this.env.DB
      .prepare(`SELECT status FROM workflow_runs WHERE id = ? AND completed_at IS NOT NULL`)
      .bind(workflowRunId)
      .first<{ status: string }>();
    if (alreadyClosed) {
      // A replayed durable step must not settle twice.
      const row = await this.env.DB
        .prepare(`SELECT actual_cost_sen FROM workflow_runs WHERE id = ?`)
        .bind(workflowRunId)
        .first<{ actual_cost_sen: number | null }>();
      return { chargedSen: row?.actual_cost_sen ?? 0 };
    }

    await this.persistNodeRuns(workflowRunId, result.nodes);

    let chargedSen = 0;
    if (reservationId) {
      const settlement = await new LedgerService(this.env).settleReservation(reservationId, result.actualCostSen, {
        referenceType: "workflow_run",
        referenceId: workflowRunId,
        requestId: auth.requestId,
      });
      chargedSen = settlement.chargedSen + settlement.overageSen;
    }

    await this.env.DB
      .prepare(`UPDATE workflow_runs SET status=?, outputs_json=?, actual_cost_sen=?, error_json=?, completed_at=? WHERE id=?`)
      .bind(
        result.status, JSON.stringify(result.outputs), chargedSen,
        result.error ? JSON.stringify(result.error) : null, nowIso(), workflowRunId,
      )
      .run();

    await this.notify(auth, workflowRunId, result.status, result.outputs, chargedSen);
    return { chargedSen };
  }

  /**
   * Video, and any model that reports async jobs, can take minutes. Those runs
   * are handed to the durable host rather than held open in a request. A test
   * provider always runs inline so tests stay deterministic.
   */
  private shouldRunDurably(input: StartRunInput, models: Map<string, ModelDefinition>): boolean {
    if (input.mode === "durable") return true;
    if (input.mode === "inline" || input.provider) return false;
    return [...models.values()].some(
      (m) => m.category === "video" || m.capabilities.includes("async-job"),
    );
  }

  /**
   * Caps how many runs one workspace can have in flight (§108). Without this a
   * loop of API calls could start unbounded parallel work and unbounded spend.
   */
  private async assertRunSlotAvailable(auth: AuthContext): Promise<void> {
    const row = await this.env.DB
      .prepare(`SELECT COUNT(*) AS n FROM workflow_runs WHERE org_id = ? AND status IN ('queued','running')`)
      .bind(auth.orgId)
      .first<{ n: number }>();
    if ((row?.n ?? 0) >= MAX_CONCURRENT_RUNS) {
      throw new AppError("workflow_limit_exceeded", `You already have ${MAX_CONCURRENT_RUNS} runs in progress.`, {
        action: "Wait for one to finish, then try again.",
      });
    }
  }

  /**
   * Notifies subscribers, then warns if the balance has fallen low. Both are
   * best-effort: a failure here must not undo a run that already happened.
   */
  private async notify(
    auth: AuthContext,
    workflowRunId: string,
    status: RunResult["status"],
    outputs: Record<string, PortValue>,
    chargedSen: Sen,
  ): Promise<void> {
    try {
      const hooks = new WebhookService(this.env);
      if (status === "completed" || status === "failed") {
        await hooks.emit(auth.orgId, {
          event: status === "completed" ? "workflow.completed" : "workflow.failed",
          resource: { type: "workflow_run", id: workflowRunId },
          status,
          outputs,
          cost: { chargedSen, currency: "MYR" },
        });
      }
      await this.warnIfBalanceLow(auth, hooks);
    } catch {
      // Notification is not part of the run's outcome.
    }
  }

  /** Fires balance.low at most once a day, so a busy workspace is not spammed. */
  private async warnIfBalanceLow(auth: AuthContext, hooks: WebhookService): Promise<void> {
    const row = await this.env.DB
      .prepare(
        `SELECT b.available_sen, o.low_balance_threshold_sen FROM balances b
           JOIN organizations o ON o.id = b.org_id WHERE b.org_id = ?`,
      )
      .bind(auth.orgId)
      .first<{ available_sen: number; low_balance_threshold_sen: number }>();
    if (!row || row.available_sen >= row.low_balance_threshold_sen) return;

    const today = new Date().toISOString().slice(0, 10);
    const alreadyWarned = await this.env.DB
      .prepare(`SELECT id FROM audit_log WHERE org_id = ? AND event = 'balance.low' AND created_at >= ? LIMIT 1`)
      .bind(auth.orgId, `${today}T00:00:00.000Z`)
      .first<{ id: string }>();
    if (alreadyWarned) return;

    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: "system",
      event: "balance.low", targetType: "balance", targetId: auth.orgId,
      meta: { availableSen: row.available_sen, thresholdSen: row.low_balance_threshold_sen },
      requestId: auth.requestId,
    });
    await hooks.emit(auth.orgId, {
      event: "balance.low",
      resource: { type: "balance", id: auth.orgId },
      status: "low",
      cost: { chargedSen: 0, currency: "MYR" },
    });
  }

  async get(auth: AuthContext, runId: string): Promise<RunSummary> {
    const run = await this.env.DB
      .prepare(`SELECT * FROM workflow_runs WHERE id = ? AND org_id = ?`)
      .bind(runId, auth.orgId)
      .first<{
        id: string; status: RunResult["status"]; estimated_cost_sen: number; actual_cost_sen: number | null;
        outputs_json: string | null; error_json: string | null;
      }>();
    if (!run) throw new AppError("not_found", "Run not found.");

    const { results } = await this.env.DB
      .prepare(`SELECT * FROM node_runs WHERE workflow_run_id = ?`)
      .bind(runId)
      .all<{
        node_id: string; id: string; node_type: string; status: NodeRunState["status"]; attempt: number;
        output_json: string | null; actual_cost_sen: number | null; error_json: string | null; duration_ms: number | null;
      }>();

    return {
      id: run.id,
      status: run.status,
      estimatedCostSen: run.estimated_cost_sen,
      actualCostSen: run.actual_cost_sen ?? 0,
      outputs: run.outputs_json ? (JSON.parse(run.outputs_json) as Record<string, PortValue>) : {},
      nodes: results.map((r) => ({
        nodeId: r.node_id,
        nodeRunId: r.id,
        nodeType: r.node_type,
        status: r.status,
        attempt: r.attempt,
        outputs: r.output_json ? (JSON.parse(r.output_json) as Record<string, PortValue>) : undefined,
        actualCostSen: r.actual_cost_sen ?? undefined,
        error: r.error_json ? (JSON.parse(r.error_json) as NodeRunState["error"]) : undefined,
        durationMs: r.duration_ms ?? undefined,
      })),
      ...(run.error_json ? { error: JSON.parse(run.error_json) as RunResult["error"] } : {}),
    };
  }

  /** Node results from an earlier run, so a partial rerun can skip upstream work. */
  private async outputsFromRun(auth: AuthContext, runId: string): Promise<Record<string, Record<string, PortValue>>> {
    const { results } = await this.env.DB
      .prepare(
        `SELECT nr.node_id, nr.output_json FROM node_runs nr
         JOIN workflow_runs wr ON wr.id = nr.workflow_run_id
         WHERE nr.workflow_run_id = ? AND wr.org_id = ? AND nr.output_json IS NOT NULL`,
      )
      .bind(runId, auth.orgId)
      .all<{ node_id: string; output_json: string }>();
    const outputs: Record<string, Record<string, PortValue>> = {};
    for (const row of results) outputs[row.node_id] = JSON.parse(row.output_json) as Record<string, PortValue>;
    return outputs;
  }

  private cacheStore(auth: AuthContext): CacheStore {
    const db = this.env.DB;
    return {
      async get(cacheKey) {
        const row = await db
          .prepare(`SELECT output_json FROM node_cache WHERE org_id = ? AND cache_key = ?`)
          .bind(auth.orgId, cacheKey)
          .first<{ output_json: string }>();
        return row ? (JSON.parse(row.output_json) as Record<string, PortValue>) : null;
      },
      async set(cacheKey, outputs) {
        await db
          .prepare(
            `INSERT INTO node_cache (org_id, cache_key, output_json, created_at) VALUES (?,?,?,?)
             ON CONFLICT(org_id, cache_key) DO UPDATE SET output_json = excluded.output_json`,
          )
          .bind(auth.orgId, cacheKey, JSON.stringify(outputs), nowIso())
          .run();
      },
    };
  }

  private async persistNodeRuns(runId: string, nodes: NodeRunState[]): Promise<void> {
    for (const node of nodes) {
      await this.env.DB
        .prepare(
          `INSERT INTO node_runs (id, workflow_run_id, node_id, node_type, status, attempt,
              output_json, cache_key, estimated_cost_sen, actual_cost_sen, provider_request_id,
              generation_id, error_json, started_at, completed_at, duration_ms, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          node.nodeRunId, runId, node.nodeId, node.nodeType, node.status, node.attempt,
          node.outputs ? JSON.stringify(node.outputs) : null, node.cacheKey ?? null,
          node.estimatedCostSen ?? 0, node.actualCostSen ?? null, node.providerRequestId ?? null,
          node.generationId ?? null, node.error ? JSON.stringify(node.error) : null,
          node.startedAt ?? null, node.completedAt ?? null, node.durationMs ?? null, nowIso(),
        )
        .run();
    }
  }

  private async modelsFor(doc: WorkflowDocument): Promise<Map<string, ModelDefinition>> {
    const service = new ModelService(this.env);
    const ids = doc.nodes
      .map((n) => (typeof n.config.modelId === "string" ? n.config.modelId : null))
      .filter((id): id is string => id !== null);
    const map = new Map<string, ModelDefinition>();
    for (const id of new Set(ids)) {
      const model = await service.getAny(id);
      if (model && model.status === "enabled") map.set(id, model);
    }
    return map;
  }

  async hashOf(doc: WorkflowDocument): Promise<string> {
    return hashDocument(doc);
  }
}
