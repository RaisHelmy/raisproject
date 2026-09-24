import { z } from "zod";
import { AppError } from "@raisai/shared";
import { registerNode, type NodeDefinition } from "../registry";
import { asAssetHandles, asText, type PortValue } from "../values";

/** Replaces {{variable}} placeholders using workflow variables (§21). */
export function interpolate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (whole, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null) return whole;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

const inputText: NodeDefinition = {
  type: "input.text",
  version: 1,
  category: "input",
  label: "Text",
  description: "A piece of text, typed here or supplied when the workflow runs.",
  beginner: true,
  inputs: [],
  outputs: [{ name: "text", type: "text", label: "Text" }],
  configSchema: z.object({ value: z.string().default(""), variable: z.string().optional() }),
  async execute(ctx) {
    const config = ctx.config as { value?: string; variable?: string };
    const fromVariable = config.variable ? ctx.variables[config.variable] : undefined;
    const text = fromVariable !== undefined ? String(fromVariable) : interpolate(config.value ?? "", ctx.variables);
    return { outputs: { text } };
  },
};

const inputImage: NodeDefinition = {
  type: "input.image",
  version: 1,
  category: "input",
  label: "Image",
  description: "An image from your assets, or supplied when the workflow runs.",
  beginner: true,
  inputs: [],
  outputs: [{ name: "image", type: "image", label: "Image" }],
  configSchema: z.object({
    assetId: z.string().optional(),
    mime: z.string().default("image/png"),
    variable: z.string().optional(),
  }),
  async execute(ctx) {
    const config = ctx.config as { assetId?: string; mime?: string; variable?: string };
    const fromVariable = config.variable ? ctx.variables[config.variable] : undefined;
    const handle = fromVariable ?? (config.assetId ? { assetId: config.assetId, mime: config.mime ?? "image/png" } : undefined);
    if (!handle) {
      throw new AppError("invalid_input", "This image input has no picture yet.", { action: "Choose an image." });
    }
    return { outputs: { image: handle as PortValue } };
  },
};

/**
 * Video and audio inputs mirror the image input: an asset from the library,
 * or a typed workflow variable. They exist so the video and audio studios
 * (upscale, motion transfer, transcribe) can be run from a form and saved as
 * templates without a canvas.
 */
function assetInput(kind: "video" | "audio", defaultMime: string, label: string, description: string): NodeDefinition {
  return {
    type: `input.${kind}`,
    version: 1,
    category: "input",
    label,
    description,
    inputs: [],
    outputs: [{ name: kind, type: kind, label }],
    configSchema: z.object({
      assetId: z.string().optional(),
      mime: z.string().default(defaultMime),
      variable: z.string().optional(),
    }),
    async execute(ctx) {
      const config = ctx.config as { assetId?: string; mime?: string; variable?: string };
      const fromVariable = config.variable ? ctx.variables[config.variable] : undefined;
      const handle = fromVariable ?? (config.assetId ? { assetId: config.assetId, mime: config.mime ?? defaultMime } : undefined);
      if (!handle) {
        throw new AppError("invalid_input", `This ${kind} input has no file yet.`, { action: `Choose a ${kind}.` });
      }
      return { outputs: { [kind]: handle as PortValue } };
    },
  };
}

const inputVideo = assetInput("video", "video/mp4", "Video", "A clip from your assets, or supplied when the workflow runs.");
const inputAudio = assetInput("audio", "audio/mpeg", "Audio", "An audio file from your assets, or supplied when the workflow runs.");

const inputVariable: NodeDefinition = {
  type: "input.variable",
  version: 1,
  category: "input",
  label: "Workflow input",
  description: "A typed value asked for when someone runs this workflow or template.",
  inputs: [],
  outputs: [{ name: "value", type: "any", label: "Value" }],
  configSchema: z.object({ variable: z.string().min(1) }),
  async execute(ctx) {
    const config = ctx.config as { variable: string };
    const value = ctx.variables[config.variable];
    if (value === undefined) {
      throw new AppError("invalid_input", `Missing value for "${config.variable}".`, {
        action: "Fill in every required input before running.",
      });
    }
    return { outputs: { value: value as PortValue } };
  },
};

const promptNode: NodeDefinition = {
  type: "prompt",
  version: 1,
  category: "input",
  label: "Prompt",
  description: "Builds a prompt from text and workflow variables.",
  beginner: true,
  inputs: [
    { name: "text", type: "text", label: "Text" },
    { name: "images", type: "image[]", label: "Reference images", multiple: true },
  ],
  outputs: [
    { name: "prompt", type: "prompt", label: "Prompt" },
    { name: "images", type: "image[]", label: "Reference images" },
  ],
  configSchema: z.object({ template: z.string().default("") }),
  async execute(ctx) {
    const config = ctx.config as { template?: string };
    const incoming = asText(ctx.inputs.text);
    // A connected text input fills {{input}}; the template wins otherwise.
    const merged = interpolate(config.template ?? "", { ...ctx.variables, input: incoming ?? "" });
    const prompt = (merged.trim().length > 0 ? merged : (incoming ?? "")).trim();
    if (!prompt) {
      throw new AppError("invalid_input", "The prompt is empty.", { action: "Write a prompt or connect some text." });
    }
    return { outputs: { prompt, images: asAssetHandles(ctx.inputs.images) } };
  },
};

const outputNode: NodeDefinition = {
  type: "output",
  version: 1,
  category: "output",
  label: "Output",
  description: "Marks a result as an output of this workflow.",
  beginner: true,
  inputs: [{ name: "value", type: "any", label: "Value", required: true }],
  outputs: [],
  configSchema: z.object({ name: z.string().default("output") }),
  async execute(ctx) {
    return { outputs: { value: (ctx.inputs.value ?? null) as PortValue } };
  },
};

const mergeNode: NodeDefinition = {
  type: "merge",
  version: 1,
  category: "data",
  label: "Merge",
  description: "Combines several inputs into one list or object.",
  inputs: [{ name: "values", type: "any", label: "Values", multiple: true }],
  outputs: [{ name: "result", type: "array", label: "Result" }],
  configSchema: z.object({ strategy: z.enum(["array", "concatText"]).default("array") }),
  async execute(ctx) {
    const config = ctx.config as { strategy?: "array" | "concatText" };
    const raw = ctx.inputs.values;
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    if (config.strategy === "concatText") {
      return { outputs: { result: values.map((v) => asText(v as PortValue) ?? "").join("\n\n") } };
    }
    return { outputs: { result: values as PortValue } };
  },
};

/**
 * A workflow that starts when something calls its address (§135).
 *
 * The request body arrives as workflow variables, so the graph downstream is
 * ordinary: nothing special happens because the trigger was external.
 */
const webhookTriggerNode: NodeDefinition = {
  type: "trigger.webhook",
  version: 1,
  category: "automation",
  label: "Webhook trigger",
  description: "Starts this workflow when something posts to its address.",
  inputs: [],
  outputs: [
    { name: "body", type: "json", label: "Body" },
    { name: "text", type: "text", label: "Body as text" },
  ],
  configSchema: z.object({}),
  async execute(ctx) {
    // Whatever was posted is placed in `trigger` before the run starts.
    const body = (ctx.variables.trigger ?? {}) as PortValue;
    return { outputs: { body, text: typeof body === "string" ? body : JSON.stringify(body) } };
  },
};

export const BASIC_NODES = [inputText, inputImage, inputVideo, inputAudio, inputVariable, promptNode, outputNode, mergeNode, webhookTriggerNode];

export function registerBasicNodes(): void {
  for (const node of BASIC_NODES) registerNode(node);
}
