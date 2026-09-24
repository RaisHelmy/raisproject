import { beforeAll, describe, expect, it } from "vitest";
import { workflowDocumentSchema } from "../src/engine/document";
import { runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { cuesFromText, cuesFromTranscript, formatTimestamp, toSrt, toVtt } from "../src/engine/nodes/media";
import { makeHarness, testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

beforeAll(() => registerBuiltinNodes());

describe("subtitle formatting", () => {
  it("writes timestamps in each format's own convention", () => {
    expect(formatTimestamp(3661.5, ",")).toBe("01:01:01,500");
    expect(formatTimestamp(0)).toBe("00:00:00.000");
  });

  it("numbers SRT cues and heads VTT with its marker", () => {
    const cues = [{ start: 0, end: 2, text: "Hello" }, { start: 2, end: 4, text: "World" }];
    const srt = toSrt(cues);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\nHello");
    expect(srt).toContain("2\n");
    expect(toVtt(cues).startsWith("WEBVTT")).toBe(true);
  });

  it("prefers real timings from a transcript over paced text", () => {
    const cues = cuesFromTranscript({ segments: [{ start: 1.5, end: 3.25, text: "Real timing" }] });
    expect(cues).toEqual([{ start: 1.5, end: 3.25, text: "Real timing" }]);
    expect(cuesFromTranscript({ nothing: true })).toBeNull();
  });

  it("paces plain text into readable cues", () => {
    const cues = cuesFromText("One sentence here. And a second one follows.");
    expect(cues).toHaveLength(2);
    expect(cues[0]!.start).toBe(0);
    expect(cues[1]!.start).toBeGreaterThan(0);
    // Even a short line stays on screen long enough to read.
    expect(cues[0]!.end - cues[0]!.start).toBeGreaterThanOrEqual(1.2);
  });
});

describe("subtitles node", () => {
  it("turns a script into SRT inside a workflow", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "First line. Second line." }, position: { x: 0, y: 0 } },
        { id: "subs", type: "subtitles", version: 1, config: { format: "srt" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "subtitles" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "subs", port: "text" } },
        { id: "e2", from: { node: "subs", port: "subtitles" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("completed");
    expect(String(result.outputs.subtitles)).toContain("00:00:00,000 -->");
  });
});

describe("bounded batch node", () => {
  function batchDoc(config: Record<string, unknown>) {
    return workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "one\ntwo\nthree\nfour" }, position: { x: 0, y: 0 } },
        { id: "split", type: "split", version: 1, config: { separator: "\n" }, position: { x: 1, y: 0 } },
        { id: "batch", type: "ai.batch", version: 1, config: { modelId: FLUX, ...config }, position: { x: 2, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "images" }, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "split", port: "text" } },
        { id: "e2", from: { node: "split", port: "items" }, to: { node: "batch", port: "prompts" } },
        { id: "e3", from: { node: "batch", port: "results" }, to: { node: "out", port: "value" } },
      ],
    });
  }

  it("runs the model once per item", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const result = await runWorkflow({
      doc: batchDoc({ maxItems: 4 }), variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect(harness.provider.calls).toHaveLength(4);
    expect((result.outputs.images as unknown[]).length).toBe(4);
    // Each item is its own generation, so history and cost stay per-item.
    expect(harness.generations).toHaveLength(4);
  });

  it("stops at the iteration limit rather than running the whole list", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const result = await runWorkflow({
      doc: batchDoc({ maxItems: 2 }), variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(harness.provider.calls).toHaveLength(2);
    expect((result.outputs.images as unknown[]).length).toBe(2);
  });

  it("stops when the next item would break the cost cap", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    // Each draft image costs 1 sen, so a 2 sen cap allows exactly two.
    const result = await runWorkflow({
      doc: batchDoc({ maxItems: 10, maxCostSen: 2 }), variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(harness.provider.calls.length).toBeLessThanOrEqual(2);
    expect(result.actualCostSen).toBeLessThanOrEqual(2);
  });

  it("estimates the ceiling, so a preview never understates the cost", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const { estimateWorkflow } = await import("../src/engine/execute");

    const estimate = await estimateWorkflow({
      doc: batchDoc({ maxItems: 5 }), variables: {}, auth, projectId: "p",
      services: { getModel: harness.services.getModel, estimateCost: harness.services.estimateCost },
    });
    // Five times a single image, and flagged approximate because fewer may run.
    expect(estimate.totalSen).toBe(5);
    expect(estimate.approximate).toBe(true);
  });

  it("refuses an empty list with something the user can act on", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "" }, position: { x: 0, y: 0 } },
        { id: "split", type: "split", version: 1, config: {}, position: { x: 1, y: 0 } },
        { id: "batch", type: "ai.batch", version: 1, config: { modelId: FLUX }, position: { x: 2, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "x" }, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "split", port: "text" } },
        { id: "e2", from: { node: "split", port: "items" }, to: { node: "batch", port: "prompts" } },
        { id: "e3", from: { node: "batch", port: "results" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("empty");
  });
});
