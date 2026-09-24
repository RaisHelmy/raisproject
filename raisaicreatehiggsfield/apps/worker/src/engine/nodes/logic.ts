import { z } from "zod";
import { AppError } from "@raisai/shared";
import { registerNode, type NodeDefinition } from "../registry";
import type { PortValue } from "../values";
import { asText } from "../values";

/** Reads a dotted path out of a value: "result.items.0.name". */
export function readPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

const transformNode: NodeDefinition = {
  type: "transform",
  version: 1,
  category: "data",
  label: "Transform",
  description: "Pulls a value out of a result, or reshapes it.",
  inputs: [{ name: "value", type: "any", label: "Value", required: true }],
  outputs: [{ name: "result", type: "any", label: "Result" }],
  configSchema: z.object({
    path: z.string().default(""),
    mode: z.enum(["path", "stringify", "parse", "length"]).default("path"),
  }),
  async execute(ctx) {
    const config = ctx.config as { path?: string; mode?: "path" | "stringify" | "parse" | "length" };
    const input = ctx.inputs.value;

    switch (config.mode ?? "path") {
      case "stringify":
        return { outputs: { result: JSON.stringify(input ?? null) } };
      case "parse": {
        const text = asText(input);
        if (text === undefined) throw new AppError("invalid_input", "Only text can be parsed as JSON.");
        try {
          return { outputs: { result: JSON.parse(text) as PortValue } };
        } catch {
          throw new AppError("invalid_input", "That text is not valid JSON.", { action: "Check the upstream output." });
        }
      }
      case "length": {
        if (Array.isArray(input)) return { outputs: { result: input.length } };
        const text = asText(input);
        return { outputs: { result: text?.length ?? 0 } };
      }
      default:
        return { outputs: { result: (readPath(input, config.path ?? "") ?? null) as PortValue } };
    }
  },
};

/** Comparison shared by the condition and router nodes. */
export function evaluate(left: unknown, operator: string, right: string): boolean {
  const leftText = asText(left as PortValue) ?? "";
  const leftNumber = typeof left === "number" ? left : Number(leftText);
  const rightNumber = Number(right);

  switch (operator) {
    case "equals": return leftText === right;
    case "not_equals": return leftText !== right;
    case "contains": return leftText.includes(right);
    case "is_empty": return leftText.trim().length === 0;
    case "is_not_empty": return leftText.trim().length > 0;
    case "greater_than": return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber > rightNumber;
    case "less_than": return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber < rightNumber;
    case "is_true": return left === true || leftText === "true";
    default: return false;
  }
}

const OPERATORS = ["equals", "not_equals", "contains", "is_empty", "is_not_empty", "greater_than", "less_than", "is_true"] as const;

const conditionNode: NodeDefinition = {
  type: "condition",
  version: 1,
  category: "logic",
  label: "Condition",
  description: "Sends the value one way when a test passes, another when it fails.",
  inputs: [{ name: "value", type: "any", label: "Value", required: true }],
  outputs: [
    { name: "true", type: "any", label: "Yes" },
    { name: "false", type: "any", label: "No" },
  ],
  configSchema: z.object({
    operator: z.enum(OPERATORS).default("is_not_empty"),
    compareTo: z.string().default(""),
  }),
  async execute(ctx) {
    const config = ctx.config as { operator?: (typeof OPERATORS)[number]; compareTo?: string };
    const passed = evaluate(ctx.inputs.value, config.operator ?? "is_not_empty", config.compareTo ?? "");
    const value = (ctx.inputs.value ?? null) as PortValue;
    // Only the branch taken emits a value. The other stays unfed, so nodes on
    // it are reported as skipped rather than run with an empty input.
    const outputs: Record<string, PortValue> = {};
    outputs[passed ? "true" : "false"] = value;
    return { outputs };
  },
};

const routerNode: NodeDefinition = {
  type: "router",
  version: 1,
  category: "logic",
  label: "Router",
  description: "Sends the value down one of several named routes.",
  inputs: [{ name: "value", type: "any", label: "Value", required: true }],
  outputs: [
    { name: "a", type: "any", label: "A" },
    { name: "b", type: "any", label: "B" },
    { name: "c", type: "any", label: "C" },
    { name: "default", type: "any", label: "Otherwise" },
  ],
  configSchema: z.object({
    routes: z
      .array(z.object({ port: z.enum(["a", "b", "c"]), operator: z.enum(OPERATORS), compareTo: z.string().default("") }))
      .default([]),
  }),
  async execute(ctx) {
    const config = ctx.config as { routes?: { port: "a" | "b" | "c"; operator: (typeof OPERATORS)[number]; compareTo: string }[] };
    const value = (ctx.inputs.value ?? null) as PortValue;
    for (const route of config.routes ?? []) {
      if (evaluate(ctx.inputs.value, route.operator, route.compareTo)) {
        return { outputs: { [route.port]: value } };
      }
    }
    return { outputs: { default: value } };
  },
};

const delayNode: NodeDefinition = {
  type: "delay",
  version: 1,
  category: "utility",
  label: "Wait",
  description: "Pauses before continuing.",
  inputs: [{ name: "value", type: "any", label: "Value" }],
  outputs: [{ name: "value", type: "any", label: "Value" }],
  configSchema: z.object({ seconds: z.number().min(0).max(300).default(1) }),
  async execute(ctx) {
    const config = ctx.config as { seconds?: number };
    // Capped so a workflow cannot park a run indefinitely (§108).
    const seconds = Math.min(Math.max(config.seconds ?? 1, 0), 300);
    if (seconds > 0) await scheduler.wait(seconds * 1000);
    return { outputs: { value: (ctx.inputs.value ?? null) as PortValue } };
  },
};

const splitNode: NodeDefinition = {
  type: "split",
  version: 1,
  category: "data",
  label: "Split text",
  description: "Breaks text into a list, by line or by a separator.",
  inputs: [{ name: "text", type: "text", label: "Text", required: true }],
  outputs: [{ name: "items", type: "array", label: "Items" }],
  configSchema: z.object({ separator: z.string().default("\n"), trim: z.boolean().default(true) }),
  async execute(ctx) {
    const config = ctx.config as { separator?: string; trim?: boolean };
    const text = asText(ctx.inputs.text) ?? "";
    const parts = text.split(config.separator ?? "\n");
    const items = (config.trim ?? true) ? parts.map((p) => p.trim()).filter((p) => p.length > 0) : parts;
    return { outputs: { items } };
  },
};

export const LOGIC_NODES = [transformNode, conditionNode, routerNode, delayNode, splitNode];

export function registerLogicNodes(): void {
  for (const node of LOGIC_NODES) registerNode(node);
}
