import { beforeAll, describe, expect, it } from "vitest";
import { workflowDocumentSchema } from "../src/engine/document";
import { estimateWorkflow, runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { makeHarness, testContext } from "./helpers/engine-harness";
import type { FakeAIProvider } from "../src/providers/fake/fake-provider";

const PLANNER = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PLAN = {
  reasoning: "Three images will cover the brief.",
  steps: [
    { kind: "image", prompt: "a neon alley", why: "establishing shot" },
    { kind: "image", prompt: "a rain-slicked street", why: "second angle" },
    { kind: "image", prompt: "a close-up of a face", why: "detail" },
  ],
};

beforeAll(() => registerBuiltinNodes());

/** Makes the planner model answer with a plan; everything else stays normal. */
function withPlan(provider: FakeAIProvider, plan: unknown = PLAN) {
  const original = provider.execute.bind(provider);
  provider.execute = async (model, input, ctx) => {
    if (model.id === PLANNER) {
      return {
        providerRequestId: "plan",
        status: "completed",
        output: { text: typeof plan === "string" ? plan : JSON.stringify(plan) },
        usage: { unit: "tokens", measures: { tokensIn: 50, tokensOut: 200 } },
      };
    }
    return original(model, input, ctx);
  };
  return provider;
}

function agentDoc(config: Record<string, unknown>) {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "agent", type: "agent", version: 1, config: { plannerModelId: PLANNER, ...config }, position: { x: 0, y: 0 } },
      { id: "out", type: "output", version: 1, config: { name: "results" }, position: { x: 1, y: 0 } },
      { id: "log", type: "output", version: 1, config: { name: "summary" }, position: { x: 1, y: 1 } },
    ],
    edges: [
      { id: "e1", from: { node: "agent", port: "results" }, to: { node: "out", port: "value" } },
      { id: "e2", from: { node: "agent", port: "summary" }, to: { node: "log", port: "value" } },
    ],
  });
}

describe("agent node", () => {
  it("plans, then carries the plan out", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    withPlan(harness.provider);

    const result = await runWorkflow({
      doc: agentDoc({ goal: "Make three images for a night scene", maxCostSen: 200, maxSteps: 4 }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect((result.outputs.results as unknown[]).length).toBe(3);
    // One provider call per executed step. The planning call is answered by the
    // stub above and so is not recorded here.
    expect(harness.provider.calls).toHaveLength(3);
    expect(String(result.outputs.summary)).toContain("establishing shot");
  });

  it("stops at the budget instead of finishing the plan", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    withPlan(harness.provider);

    // Each draft image costs 1 sen, so two is all this budget allows.
    const result = await runWorkflow({
      doc: agentDoc({ goal: "Make three images", maxCostSen: 2, maxSteps: 4 }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect((result.outputs.results as unknown[]).length).toBeLessThan(3);
    expect(result.actualCostSen).toBeLessThanOrEqual(2);
    // It says why it stopped rather than quietly doing less than asked.
    expect(String(result.outputs.summary)).toContain("over the budget");
  });

  it("estimates the budget, because an agent decides its own work", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const estimate = await estimateWorkflow({
      doc: agentDoc({ goal: "anything", maxCostSen: 250 }),
      variables: {}, auth, projectId: "p",
      services: { getModel: harness.services.getModel, estimateCost: harness.services.estimateCost },
    });

    // The ceiling is the only number that can honestly be promised in advance.
    expect(estimate.totalSen).toBe(250);
    expect(estimate.approximate).toBe(true);
  });

  it("never runs more steps than it was allowed", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    withPlan(harness.provider);

    const result = await runWorkflow({
      doc: agentDoc({ goal: "Make three images", maxCostSen: 500, maxSteps: 1 }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect((result.outputs.results as unknown[]).length).toBe(1);
  });

  it("refuses a plan it cannot read rather than guessing", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    withPlan(harness.provider, "I'd love to help! What sort of images?");

    const result = await runWorkflow({
      doc: agentDoc({ goal: "anything", maxCostSen: 200 }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("plan could not be read");
  });

  it("asks for a planning model rather than picking one silently", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "agent", type: "agent", version: 1, config: { goal: "do something" }, position: { x: 0, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "r" }, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: "e1", from: { node: "agent", port: "results" }, to: { node: "out", port: "value" } }],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("no planning model");
  });

  it("records each step as its own generation, so the spend is itemised", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    withPlan(harness.provider);

    await runWorkflow({
      doc: agentDoc({ goal: "Make three images", maxCostSen: 200 }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(harness.generations).toHaveLength(3);
  });
});
