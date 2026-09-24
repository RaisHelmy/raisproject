import { beforeAll, describe, expect, it } from "vitest";
import { workflowDocumentSchema, type WorkflowDocument } from "../src/engine/document";
import { topologicalOrder, downstreamClosure } from "../src/engine/graph";
import { validateWorkflow } from "../src/engine/validate";
import { runWorkflow, estimateWorkflow, computeCacheKey } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { assertPublicUrl } from "../src/engine/nodes/http";
import { interpolate } from "../src/engine/nodes/basic";
import { makeHarness, testContext } from "./helpers/engine-harness";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";
import { env } from "cloudflare:test";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const LLAMA = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function doc(partial: Partial<WorkflowDocument>): WorkflowDocument {
  return workflowDocumentSchema.parse({ version: 1, ...partial });
}

/** [Prompt] -> [AI Image] -> [Output], the MVP workflow from CLAUDE.md §149. */
type RetryOn = "provider_timeout" | "provider_error" | "rate_limited";

function imageWorkflow(overrides: { cache?: boolean; retry?: { count: number; delayMs: number; on: RetryOn[] } } = {}): WorkflowDocument {
  return doc({
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: "a rainy cyberpunk street" }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 }, ...(overrides.retry ? { retry: overrides.retry } : {}) },
      { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "out", port: "value" } },
    ],
    settings: { cache: overrides.cache ?? false, maxParallel: 3 },
  });
}

async function modelMap() {
  await new ModelSeedService(env).seed();
  const service = new ModelService(env);
  const list = await service.list();
  return new Map(list.map((m) => [m.id, m]));
}

beforeAll(() => registerBuiltinNodes());

describe("graph utilities", () => {
  it("orders nodes by dependency", () => {
    const { order } = topologicalOrder(imageWorkflow());
    expect(order).toEqual(["p", "ai", "out"]);
  });

  it("detects a cycle and names the nodes involved", () => {
    const cyclic = doc({
      nodes: [
        { id: "a", type: "prompt", version: 1, config: {}, position: { x: 0, y: 0 } },
        { id: "b", type: "prompt", version: 1, config: {}, position: { x: 1, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "a", port: "prompt" }, to: { node: "b", port: "text" } },
        { id: "e2", from: { node: "b", port: "prompt" }, to: { node: "a", port: "text" } },
      ],
    });
    const { order, cycleNodes } = topologicalOrder(cyclic);
    expect(order).toBeNull();
    expect(cycleNodes.sort()).toEqual(["a", "b"]);
  });

  it("finds everything downstream of a node", () => {
    expect([...downstreamClosure(imageWorkflow(), ["ai"])].sort()).toEqual(["ai", "out"]);
  });
});

describe("validation", () => {
  it("accepts a valid workflow", async () => {
    expect(validateWorkflow(imageWorkflow(), { models: await modelMap() })).toEqual([]);
  });

  it("reports every problem at once rather than one at a time", () => {
    const broken = doc({
      nodes: [
        { id: "ai", type: "ai.model", version: 1, config: {}, position: { x: 0, y: 0 } },
        { id: "ghost", type: "does.not.exist", version: 1, config: {}, position: { x: 1, y: 0 } },
      ],
      edges: [],
    });
    const errors = validateWorkflow(broken);
    const codes = errors.map((e) => e.code);
    // Unknown type, missing model and missing output all surface together (§127).
    expect(codes).toContain("unknown_node_type");
    expect(codes).toContain("model_missing");
    expect(codes).toContain("no_output");
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a connection between incompatible port types", async () => {
    const bad = doc({
      nodes: [
        { id: "img", type: "input.image", version: 1, config: { assetId: "a1" }, position: { x: 0, y: 0 } },
        { id: "p", type: "prompt", version: 1, config: { template: "x" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: {}, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "img", port: "image" }, to: { node: "p", port: "text" } },
        { id: "e2", from: { node: "p", port: "prompt" }, to: { node: "out", port: "value" } },
      ],
    });
    const errors = validateWorkflow(bad, { models: await modelMap() });
    expect(errors.some((e) => e.code === "invalid_connection" && e.message.includes("cannot connect"))).toBe(true);
  });

  it("rejects two connections into a single-value input", async () => {
    const wf = imageWorkflow();
    wf.nodes.push({ id: "p2", type: "prompt", version: 1, config: { template: "other" }, position: { x: 0, y: 1 } });
    wf.edges.push({ id: "e3", from: { node: "p2", port: "prompt" }, to: { node: "ai", port: "prompt" } });
    const errors = validateWorkflow(wf, { models: await modelMap() });
    expect(errors.some((e) => e.code === "duplicate_connection")).toBe(true);
  });

  it("reports an unknown model on an AI node", async () => {
    const wf = imageWorkflow();
    wf.nodes[1]!.config = { modelId: "not/a-real-model", parameters: {} };
    const errors = validateWorkflow(wf, { models: await modelMap() });
    expect(errors.some((e) => e.code === "model_missing")).toBe(true);
  });

  it("reports a disconnected output", async () => {
    const wf = imageWorkflow();
    wf.edges = wf.edges.filter((e) => e.id !== "e2");
    const errors = validateWorkflow(wf, { models: await modelMap() });
    expect(errors.some((e) => e.code === "unreachable_output")).toBe(true);
  });

  it("reports a missing required variable before spending anything", async () => {
    const wf = imageWorkflow();
    wf.variables = [{ name: "style", type: "string", required: true, label: "Style" }];
    const errors = validateWorkflow(wf, { models: await modelMap(), variables: {} });
    expect(errors.some((e) => e.code === "missing_variable")).toBe(true);
  });

  it("enforces node and connection limits", async () => {
    const wf = imageWorkflow();
    const errors = validateWorkflow(wf, { models: await modelMap(), limits: { maxNodes: 1, maxEdges: 1, maxFanOut: 1 } });
    expect(errors.filter((e) => e.code === "limit_exceeded").length).toBeGreaterThan(0);
  });
});

describe("execution", () => {
  it("runs prompt to image to output and returns the result", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const result = await runWorkflow({
      doc: imageWorkflow(), variables: {}, auth, projectId: "proj1",
      workflowRunId: "run1", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect(result.nodes.every((n) => n.status === "completed")).toBe(true);
    expect(result.outputs.image).toMatchObject({ mime: "image/png" });
    expect(harness.storedAssets).toHaveLength(1);
    expect(harness.generations).toHaveLength(1);
    expect(result.actualCostSen).toBeGreaterThan(0);
  });

  it("passes the prompt through to the provider", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    await runWorkflow({
      doc: imageWorkflow(), variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(harness.provider.calls[0]!.input.prompt).toBe("a rainy cyberpunk street");
  });

  it("substitutes workflow variables into the prompt", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = imageWorkflow();
    wf.nodes[0]!.config = { template: "a {{style}} street" };
    wf.variables = [{ name: "style", type: "string", required: true }];

    await runWorkflow({
      doc: wf, variables: { style: "noir" }, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(harness.provider.calls[0]!.input.prompt).toBe("a noir street");
  });

  it("stops downstream work when a node fails and reports which one", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    harness.provider.failNext(FLUX, { code: "provider_error", message: "Model exploded.", retryable: false });

    const result = await runWorkflow({
      doc: imageWorkflow(), variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.nodeId).toBe("ai");
    expect(result.nodes.find((n) => n.nodeId === "out")!.status).toBe("skipped");
    // A failed generation is still recorded, so history explains what happened.
    expect(harness.generations[0]!.status).toBe("failed");
  });

  it("retries only the failures a node opted into", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    harness.provider.failNext(FLUX, { code: "provider_timeout", message: "Timed out.", retryable: true, times: 1 });

    const result = await runWorkflow({
      doc: imageWorkflow({ retry: { count: 2, delayMs: 1, on: ["provider_timeout"] } }),
      variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services, sleep: async () => {},
    });

    expect(result.status).toBe("completed");
    expect(result.nodes.find((n) => n.nodeId === "ai")!.attempt).toBe(2);
  });

  it("never retries invalid input, even when retries are configured", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    // An image sent to a model that takes none is a user error, not a blip.
    const wf = imageWorkflow({ retry: { count: 3, delayMs: 1, on: ["provider_timeout", "provider_error"] } });
    wf.nodes[1]!.config = { modelId: FLUX, parameters: { steps: 999 } };

    const result = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services, sleep: async () => {},
    });

    expect(result.status).toBe("failed");
    expect(result.nodes.find((n) => n.nodeId === "ai")!.attempt).toBe(1);
  });

  it("reuses a cached result instead of paying twice", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = imageWorkflow({ cache: true });

    const first = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r1",
      services: harness.services, cache: harness.cache,
    });
    const second = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r2",
      services: harness.services, cache: harness.cache,
    });

    expect(first.nodes.find((n) => n.nodeId === "ai")!.status).toBe("completed");
    expect(second.nodes.find((n) => n.nodeId === "ai")!.status).toBe("cached");
    expect(second.actualCostSen).toBe(0);
    // The provider was called once across both runs.
    expect(harness.provider.calls).toHaveLength(1);
  });

  it("reruns only a node and its downstream, reusing upstream output", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const result = await runWorkflow({
      doc: imageWorkflow(), variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services,
      fromNodeIds: ["ai"],
      seedOutputs: { p: { prompt: "a previously built prompt", images: [] } },
    });

    expect(result.status).toBe("completed");
    expect(result.nodes.find((n) => n.nodeId === "p")!.status).toBe("skipped");
    // The AI node still ran, using the seeded upstream value.
    expect(harness.provider.calls[0]!.input.prompt).toBe("a previously built prompt");
  });

  it("pauses instead of exceeding the workflow budget", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = imageWorkflow();
    wf.nodes[1]!.config = { modelId: "@cf/leonardo/lucid-origin", parameters: {} };

    const result = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r",
      services: harness.services,
      maxCostSen: 10, // the Lucid Origin image costs 38 sen
    });

    expect(result.status).toBe("paused");
    expect(result.pauseReason).toBe("budget");
    expect(harness.provider.calls).toHaveLength(0); // nothing was spent
  });

  it("runs independent branches in the same wave", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = doc({
      nodes: [
        { id: "p1", type: "prompt", version: 1, config: { template: "one" }, position: { x: 0, y: 0 } },
        { id: "p2", type: "prompt", version: 1, config: { template: "two" }, position: { x: 0, y: 1 } },
        { id: "a1", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 } },
        { id: "a2", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 1 } },
        { id: "m", type: "merge", version: 1, config: { strategy: "array" }, position: { x: 2, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "images" }, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "p1", port: "prompt" }, to: { node: "a1", port: "prompt" } },
        { id: "e2", from: { node: "p2", port: "prompt" }, to: { node: "a2", port: "prompt" } },
        { id: "e3", from: { node: "a1", port: "image" }, to: { node: "m", port: "values" } },
        { id: "e4", from: { node: "a2", port: "image" }, to: { node: "m", port: "values" } },
        { id: "e5", from: { node: "m", port: "result" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("completed");
    expect(Array.isArray(result.outputs.images)).toBe(true);
    expect((result.outputs.images as unknown[]).length).toBe(2);
  });

  it("chains an LLM into an image model", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = doc({
      nodes: [
        { id: "p", type: "prompt", version: 1, config: { template: "describe a scene" }, position: { x: 0, y: 0 } },
        { id: "llm", type: "ai.model", version: 1, config: { modelId: LLAMA, parameters: {} }, position: { x: 1, y: 0 } },
        { id: "img", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 2, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "llm", port: "prompt" } },
        { id: "e2", from: { node: "llm", port: "text" }, to: { node: "img", port: "prompt" } },
        { id: "e3", from: { node: "img", port: "image" }, to: { node: "out", port: "value" } },
      ],
    });

    expect(validateWorkflow(wf, { models: await modelMap() })).toEqual([]);
    const result = await runWorkflow({
      doc: wf, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    // The image model received the text the LLM produced.
    expect(harness.provider.calls[1]!.input.prompt).toContain("fake output for");
    expect(harness.generations).toHaveLength(2);
  });

  it("produces the same cache key for identical work and a different one otherwise", async () => {
    const node = { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX }, position: { x: 0, y: 0 } };
    const a = await computeCacheKey(node, { prompt: "cat" });
    const b = await computeCacheKey(node, { prompt: "cat" });
    const c = await computeCacheKey(node, { prompt: "dog" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("estimation", () => {
  it("sums node estimates for the whole workflow", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const wf = imageWorkflow();
    wf.nodes[1]!.config = { modelId: "@cf/leonardo/lucid-origin", parameters: {} };

    const estimate = await estimateWorkflow({
      doc: wf, variables: {}, auth, projectId: "p",
      services: { getModel: harness.services.getModel, estimateCost: harness.services.estimateCost },
    });
    expect(estimate.totalSen).toBe(38);
    expect(estimate.perNode).toHaveLength(1); // only the AI node costs anything
  });
});

describe("http node", () => {
  it("blocks addresses that would reach internal infrastructure", () => {
    for (const url of ["http://localhost/x", "http://127.0.0.1/x", "http://10.0.0.1/x", "http://192.168.1.1/x", "http://169.254.169.254/latest/meta-data"]) {
      expect(() => assertPublicUrl(url), url).toThrowError(/not reachable/);
    }
    expect(() => assertPublicUrl("https://api.example.com/v1")).not.toThrow();
  });
});

describe("prompt templating", () => {
  it("replaces known variables and leaves unknown ones visible", () => {
    expect(interpolate("a {{style}} {{thing}}", { style: "noir" })).toBe("a noir {{thing}}");
  });
});
