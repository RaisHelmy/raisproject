import { z } from "zod";
import { PORT_TYPES } from "./ports";

/**
 * Models are data (CLAUDE.md §7-9, §154-155). Nothing in the UI or engine
 * branches on a model id — behaviour is driven by `capabilities`,
 * `parameters` and `limits`.
 */

export const CAPABILITIES = [
  // task capabilities
  "text-to-image", "image-to-image", "inpainting", "upscale",
  "text-to-video", "image-to-video", "reference-to-video", "start-end-frame",
  "video-to-video", "reference-video",
  "text-generation", "vision", "tool-calling", "json-mode",
  "text-to-speech", "speech-to-text", "music", "embedding",
  // input/control capabilities
  "image-input", "multiple-images", "video-input", "mask-input",
  "negative-prompt", "seed", "steps",
  "guidance", "aspect-ratio", "resolution", "duration", "audio-output",
  // execution capabilities
  "streaming", "async-job",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const MODEL_CATEGORIES = ["image", "video", "audio", "text", "vision", "embedding", "utility"] as const;
export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

export const MODEL_TAGS = ["recommended", "fast", "quality", "cheap", "cinematic", "experimental"] as const;
export type ModelTag = (typeof MODEL_TAGS)[number];

export const MODEL_STATUSES = ["discovered", "configured", "enabled", "deprecated"] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

/** How a model's price is computed. See docs/knowledge/CLOUDFLARE-AI.md. */
export const PRICING_UNITS = [
  "tile_step", "megapixel_tiered", "tokens", "audio_minute", "characters", "video_seconds", "flat",
] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const parameterDefSchema = z.object({
  name: z.string(),
  type: z.enum(["number", "enum", "boolean", "string", "range"]),
  label: z.string(),
  help: z.string().optional(),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.object({ value: z.union([z.string(), z.number()]), label: z.string() })).optional(),
  /** Advanced parameters are hidden behind the Basic/Advanced toggle (§13). */
  advanced: z.boolean().default(false),
  /** Provider field this maps to, when it differs from `name`. */
  mapsTo: z.string().optional(),
});
export type ParameterDef = z.infer<typeof parameterDefSchema>;

export const modelLimitsSchema = z.object({
  maxReferenceImages: z.number().int().positive().optional(),
  maxPromptChars: z.number().int().positive().optional(),
  durations: z.array(z.number()).optional(),
  resolutions: z.array(z.string()).optional(),
  aspectRatios: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional(),
});
export type ModelLimits = z.infer<typeof modelLimitsSchema>;

const portTypeSchema = z.enum(PORT_TYPES);

export const modelDefinitionSchema = z.object({
  id: z.string(),
  provider: z.literal("cloudflare"),
  hosting: z.enum(["workers-ai", "third-party"]),
  displayName: z.string(),
  description: z.string().default(""),
  category: z.enum(MODEL_CATEGORIES),
  task: z.string(),
  capabilities: z.array(z.enum(CAPABILITIES)),
  inputs: z.record(portTypeSchema),
  outputs: z.record(portTypeSchema),
  parameters: z.array(parameterDefSchema).default([]),
  limits: modelLimitsSchema.default({}),
  status: z.enum(MODEL_STATUSES).default("discovered"),
  tags: z.array(z.enum(MODEL_TAGS)).default([]),
  docUrl: z.string().optional(),
  version: z.string().default("1"),
  sortOrder: z.number().int().default(0),
});
export type ModelDefinition = z.infer<typeof modelDefinitionSchema>;

export function hasCapability(model: Pick<ModelDefinition, "capabilities">, capability: Capability): boolean {
  return model.capabilities.includes(capability);
}

/** Models that can accept the given input port type, used for compatibility warnings (§91). */
export function acceptsInput(model: Pick<ModelDefinition, "inputs">, portType: string): boolean {
  return Object.values(model.inputs).includes(portType as never);
}
