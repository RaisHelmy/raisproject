import type { Capability, ModelDefinition, ModelLimits, ParameterDef, PricingUnit } from "@raisai/shared";

/** A binary produced or consumed by a model, referenced by R2 key or inline bytes. */
export interface BinaryRef {
  /** R2 object key once stored; absent while still inline. */
  key?: string;
  mime: string;
  bytes?: ArrayBuffer;
  /** Provider-hosted URL (third-party video models); must be copied to R2 promptly. */
  url?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

/** Canonical input shape. The provider maps these onto each model's own schema. */
export interface CanonicalInput {
  prompt?: string;
  negativePrompt?: string;
  images?: BinaryRef[];
  audio?: BinaryRef;
  /** Inpainting mask: white = repaint, black = keep. Only for models with a `mask` input. */
  mask?: BinaryRef;
  /** Source or reference clip for video-to-video and reference-video models. */
  video?: BinaryRef;
  text?: string;
  messages?: { role: "system" | "user" | "assistant"; content: string }[];
  width?: number;
  height?: number;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  seed?: number;
  steps?: number;
  guidance?: number;
  maxTokens?: number;
  /** Anything model-specific that survived validation against parameterSchema. */
  parameters?: Record<string, unknown>;
}

export interface CanonicalOutput {
  image?: BinaryRef;
  images?: BinaryRef[];
  video?: BinaryRef;
  audio?: BinaryRef;
  text?: string;
  json?: unknown;
  embedding?: number[];
}

/** What the provider actually consumed, used to compute the charged amount. */
export interface ProviderUsage {
  unit: PricingUnit;
  /** Unit-specific measures: tokensIn/tokensOut, tiles, steps, megapixels, seconds, characters. */
  measures: Record<string, number>;
  /** Provider's own cost in micro-USD when known. Admin-only downstream. */
  providerCostMicroUsd?: number;
}

export type ProviderJobStatus = "queued" | "running" | "completed" | "failed";

export interface ProviderJob {
  /** Provider-side identifier; admin-only downstream. */
  providerRequestId: string;
  status: ProviderJobStatus;
  output?: CanonicalOutput;
  usage?: ProviderUsage;
  error?: { code: string; message: string; retryable: boolean };
  /** Opaque handle for polling an async job. */
  handle?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
  action?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface ProviderCostEstimate {
  unit: PricingUnit;
  measures: Record<string, number>;
  providerCostMicroUsd: number;
  /** True when a measure had to be guessed (e.g. output tokens before generating). */
  approximate: boolean;
}

/** Raw catalog entry before an admin configures it into a ModelDefinition (§125). */
export interface DiscoveredModel {
  id: string;
  hosting: "workers-ai" | "third-party";
  displayName: string;
  description: string;
  task: string;
  inputSchema: unknown;
  outputSchema: unknown;
  docUrl?: string;
  suggestedCapabilities?: Capability[];
  suggestedParameters?: ParameterDef[];
  suggestedLimits?: ModelLimits;
}

export interface ExecuteContext {
  requestId: string;
  /** Aborts a long-running provider call. */
  signal?: AbortSignal;
  idempotencyKey?: string;
}

/**
 * Provider abstraction (CLAUDE.md §6). Cloudflare is the first implementation;
 * nothing above this interface knows about Workers AI or AI Gateway.
 */
export interface AIProvider {
  readonly id: string;
  listModels(): Promise<DiscoveredModel[]>;
  getModel(id: string): Promise<DiscoveredModel | null>;
  validateInput(model: ModelDefinition, input: CanonicalInput): ValidationResult;
  estimateCost(model: ModelDefinition, input: CanonicalInput): ProviderCostEstimate;
  execute(model: ModelDefinition, input: CanonicalInput, ctx: ExecuteContext): Promise<ProviderJob>;
  /** `model` lets an implementation report errors in the model's own words. */
  getJob(handle: string, model?: ModelDefinition): Promise<ProviderJob>;
  cancelJob(handle: string): Promise<void>;
}
