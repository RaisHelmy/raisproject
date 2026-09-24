import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { workflowDocumentSchema } from "../src/engine/document";
import { runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { WorkflowService } from "../src/services/workflow-service";
import { WorkflowExecutionService } from "../src/services/workflow-execution-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { makeHarness, testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

function doc() {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: "a street" }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 } },
      { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "out", port: "value" } },
    ],
  });
}

async function project(orgId: string, userId: string): Promise<string> {
  const id = newId();
  await env.DB.prepare(`INSERT INTO projects (id, org_id, name, kind, created_by) VALUES (?,?,?,'general',?)`)
    .bind(id, orgId, "P", userId).run();
  return id;
}

describe("durable execution seam", () => {
  it("routes every node through the supplied step wrapper", async () => {
    registerBuiltinNodes();
    const auth = await testContext();
    const harness = await makeHarness();
    const steps: string[] = [];

    const result = await runWorkflow({
      doc: doc(), variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services,
      // Cloudflare Workflows passes step.do here; the engine stays unaware of it.
      runStep: async (id, fn) => {
        steps.push(id);
        return fn();
      },
    });

    expect(result.status).toBe("completed");
    // Every executed node became a checkpoint, tagged with its attempt.
    expect(steps).toEqual(["p#1", "ai#1", "out#1"]);
  });

  it("records the attempt in the step name so retries are distinct checkpoints", async () => {
    registerBuiltinNodes();
    const auth = await testContext();
    const harness = await makeHarness();
    harness.provider.failNext(FLUX, { code: "provider_timeout", message: "slow", retryable: true, times: 1 });
    const steps: string[] = [];

    const wf = doc();
    wf.nodes[1]!.retry = { count: 2, delayMs: 1, on: ["provider_timeout"] };

    await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services, sleep: async () => {},
      runStep: async (id, fn) => {
        steps.push(id);
        return fn();
      },
    });

    // A replayed step must not reuse the failed attempt's checkpoint.
    expect(steps).toContain("ai#1");
    expect(steps).toContain("ai#2");
  });
});

describe("settlement", () => {
  it("settles once even when the durable step is replayed", async () => {
    await new ModelSeedService(env).seed();
    registerBuiltinNodes();
    const auth = await testContext();
    const ledger = new LedgerService(env);
    await ledger.deposit(auth.orgId, 5000);
    const projectId = await project(auth.orgId, auth.userId);

    const service = new WorkflowService(env);
    const created = await service.create(auth, { name: "Settle", projectId, document: doc() });
    const frozen = await service.freezeVersion(auth, created.workflow.id);

    const runId = newId();
    const { reservationId } = await ledger.reserve(auth.orgId, 100, { referenceType: "workflow_run", referenceId: runId });
    await env.DB
      .prepare(
        `INSERT INTO workflow_runs (id, org_id, project_id, user_id, workflow_id, workflow_version_id,
            trigger, status, variables_json, estimated_cost_sen, reservation_txn_id)
         VALUES (?,?,?,?,?,?,'api','running','{}',100,?)`,
      )
      .bind(runId, auth.orgId, projectId, auth.userId, created.workflow.id, frozen.versionId, reservationId)
      .run();

    const beforeSettle = await ledger.getBalance(auth.orgId);
    const execution = new WorkflowExecutionService(env);
    const payload = {
      workflowRunId: runId,
      reservationId,
      result: { status: "completed" as const, outputs: {}, actualCostSen: 40, nodes: [] },
    };

    const first = await execution.finish(auth, payload);
    const second = await execution.finish(auth, payload);

    expect(first.chargedSen).toBe(40);
    expect(second.chargedSen).toBe(40); // replay returns the same figure
    const balance = await ledger.getBalance(auth.orgId);
    expect(balance.reservedSen).toBe(0);
    // Charged exactly once: the 100 sen hold settles to 40, returning 60.
    expect(balance.availableSen).toBe(beforeSettle.availableSen + 60);
  });
});
