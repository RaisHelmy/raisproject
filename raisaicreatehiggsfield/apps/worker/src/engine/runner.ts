import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { SCOPES, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { workflowDocumentSchema } from "./document";
import { runWorkflow } from "./execute";
import { registerBuiltinNodes } from "./nodes";
import type { PortValue } from "./values";
import { buildEngineServices } from "../services/engine-services";
import { WorkflowExecutionService } from "../services/workflow-execution-service";
import { attachDb } from "../db/client";

export interface RunParams {
  workflowRunId: string;
  userId: string;
  orgId: string;
  projectId: string;
  requestId: string;
  isAdmin: boolean;
}

/**
 * Durable host for a workflow run (ADR-003).
 *
 * Each node becomes a `step.do`, so a run survives isolate eviction, resumes
 * from the last completed node, and is not bound by a single request's
 * lifetime. That is what makes slow work — video especially — possible without
 * holding an HTTP connection open.
 *
 * The engine itself is unchanged: this class only supplies the step wrapper and
 * the persistence around it.
 */
export class RaisWorkflowRun extends WorkflowEntrypoint<Env, RunParams> {
  async run(event: WorkflowEvent<RunParams>, step: WorkflowStep): Promise<{ status: string; chargedSen: number }> {
    attachDb(this.env);
    registerBuiltinNodes();
    const { workflowRunId, userId, orgId, projectId, requestId, isAdmin } = event.payload;

    const auth: AuthContext = { userId, orgId, actorType: "user", scopes: SCOPES, requestId, isAdmin };

    const loaded = await step.do("load-run", async () => {
      const run = await this.env.DB
        .prepare(
          `SELECT wr.id, wr.variables_json, wr.max_cost_sen, wr.partial_from_node_ids_json,
                  wr.reservation_txn_id, wv.document_json
             FROM workflow_runs wr
             JOIN workflow_versions wv ON wv.id = wr.workflow_version_id
            WHERE wr.id = ? AND wr.org_id = ?`,
        )
        .bind(workflowRunId, orgId)
        .first<{
          id: string; variables_json: string; max_cost_sen: number | null;
          partial_from_node_ids_json: string | null; reservation_txn_id: string | null; document_json: string;
        }>();
      if (!run) throw new Error(`workflow run ${workflowRunId} not found`);
      return run;
    });

    const doc = workflowDocumentSchema.parse(JSON.parse(loaded.document_json));
    const variables = JSON.parse(loaded.variables_json) as Record<string, unknown>;
    const fromNodeIds = loaded.partial_from_node_ids_json
      ? (JSON.parse(loaded.partial_from_node_ids_json) as string[])
      : undefined;

    const services = buildEngineServices(this.env, { auth, projectId, workflowRunId });

    // Checked between nodes, outside step.do so a replay re-reads it. A node
    // already handed to a provider is left to finish: stopping it would spend
    // the money without keeping the result.
    const execution = new WorkflowExecutionService(this.env);
    const cancellation = new AbortController();
    const stopIfCancelled = async () => {
      if (!cancellation.signal.aborted && (await execution.isCancelRequested(workflowRunId))) {
        cancellation.abort();
      }
    };

    const result = await runWorkflow({
      doc,
      variables,
      auth,
      projectId,
      workflowRunId,
      services,
      fromNodeIds,
      maxCostSen: loaded.max_cost_sen ?? undefined,
      // Every node becomes a durable checkpoint.
      signal: cancellation.signal,
      runStep: async (nodeId, fn) => {
        await stopIfCancelled();
        return step.do(nodeId, fn as () => Promise<never>);
      },
      sleep: (ms) => step.sleep(`retry-${Date.now()}`, ms),
    });

    const settlement = await step.do("settle", async () =>
      execution.finish(auth, {
        workflowRunId,
        reservationId: loaded.reservation_txn_id,
        result: {
          status: result.status,
          outputs: result.outputs as Record<string, PortValue>,
          actualCostSen: result.actualCostSen,
          nodes: result.nodes,
          error: result.error,
          pauseReason: result.pauseReason,
        },
      }),
    );

    return { status: result.status, chargedSen: settlement.chargedSen };
  }
}
