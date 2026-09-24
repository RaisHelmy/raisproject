import { beforeAll, describe, expect, it } from "vitest";
import { workflowDocumentSchema } from "../src/engine/document";
import { runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { evaluate, readPath } from "../src/engine/nodes/logic";
import { validateWorkflow } from "../src/engine/validate";
import { makeHarness, testContext } from "./helpers/engine-harness";

beforeAll(() => registerBuiltinNodes());

describe("path reading", () => {
  it("walks objects and arrays", () => {
    const value = { result: { items: [{ name: "first" }, { name: "second" }] } };
    expect(readPath(value, "result.items.1.name")).toBe("second");
    expect(readPath(value, "")).toBe(value);
    expect(readPath(value, "result.missing.deep")).toBeUndefined();
  });
});

describe("comparisons", () => {
  it("compares text and numbers", () => {
    expect(evaluate("hello", "contains", "ell")).toBe(true);
    expect(evaluate("", "is_empty", "")).toBe(true);
    expect(evaluate(10, "greater_than", "5")).toBe(true);
    expect(evaluate(3, "greater_than", "5")).toBe(false);
    expect(evaluate(true, "is_true", "")).toBe(true);
  });
});

describe("logic nodes in a workflow", () => {
  it("routes down only the branch whose test passes", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "urgent: fix this" }, position: { x: 0, y: 0 } },
        { id: "check", type: "condition", version: 1, config: { operator: "contains", compareTo: "urgent" }, position: { x: 1, y: 0 } },
        { id: "yes", type: "output", version: 1, config: { name: "urgent" }, position: { x: 2, y: 0 } },
        { id: "no", type: "output", version: 1, config: { name: "normal" }, position: { x: 2, y: 1 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "check", port: "value" } },
        { id: "e2", from: { node: "check", port: "true" }, to: { node: "yes", port: "value" } },
        { id: "e3", from: { node: "check", port: "false" }, to: { node: "no", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.urgent).toBe("urgent: fix this");
    // The branch not taken produced nothing at all.
    expect(result.outputs.normal).toBeUndefined();
  });

  it("pulls a field out of an upstream result", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: '{"movie":{"title":"Neon Rain"}}' }, position: { x: 0, y: 0 } },
        { id: "parse", type: "transform", version: 1, config: { mode: "parse" }, position: { x: 1, y: 0 } },
        { id: "pick", type: "transform", version: 1, config: { mode: "path", path: "movie.title" }, position: { x: 2, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "title" }, position: { x: 3, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "parse", port: "value" } },
        { id: "e2", from: { node: "parse", port: "result" }, to: { node: "pick", port: "value" } },
        { id: "e3", from: { node: "pick", port: "result" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.outputs.title).toBe("Neon Rain");
  });

  it("splits a list and validates as a real graph", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "one\ntwo\nthree" }, position: { x: 0, y: 0 } },
        { id: "split", type: "split", version: 1, config: { separator: "\n" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "lines" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "split", port: "text" } },
        { id: "e2", from: { node: "split", port: "items" }, to: { node: "out", port: "value" } },
      ],
    });

    expect(validateWorkflow(doc)).toEqual([]);
    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.outputs.lines).toEqual(["one", "two", "three"]);
  });

  it("reports unparseable text in words the user can act on", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "not json at all" }, position: { x: 0, y: 0 } },
        { id: "parse", type: "transform", version: 1, config: { mode: "parse" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "x" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "parse", port: "value" } },
        { id: "e2", from: { node: "parse", port: "result" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("not valid JSON");
  });
});
