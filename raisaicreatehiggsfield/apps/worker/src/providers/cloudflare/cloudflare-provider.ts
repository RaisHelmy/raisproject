import { AppError, type ModelDefinition } from "@raisai/shared";
import type { Env } from "../../env";
import type {
  AIProvider,
  BinaryRef,
  CanonicalInput,
  CanonicalOutput,
  DiscoveredModel,
  ExecuteContext,
  ProviderCostEstimate,
  ProviderJob,
  ProviderUsage,
  ValidationResult,
} from "../types";
import { measuresForInput, providerUsdFor } from "../../billing/pricing";
import { base64ToArrayBuffer, buildProviderInput } from "./mapping";
import { validateCanonicalInput } from "../validate-input";

interface CloudflareRunResult {
  image?: string;
  video?: string | { url?: string };
  audio?: string;
  response?: string | Record<string, unknown>;
  text?: string;
  request_id?: string;
  status?: string;
  result?: Record<string, unknown>;
  state?: string;
  data?: number[][];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  [key: string]: unknown;
}

/**
 * Cloudflare implementation of AIProvider, covering both catalogs through the
 * same call surface (ADR-002):
 *  - Workers AI models (`@cf/...`) via the AI binding
 *  - Third-party models (`author/model`) via the same binding, routed through
 *    AI Gateway with Unified Billing
 *
 * Provider-hosted result URLs are downloaded here, because they expire and the
 * asset must live in R2 (docs/knowledge/CLOUDFLARE-AI.md).
 */
export class CloudflareAIProvider implements AIProvider {
  readonly id = "cloudflare";

  constructor(private readonly env: Pick<Env, "AI" | "AI_GATEWAY_ID">) {}

  async listModels(): Promise<DiscoveredModel[]> {
    // Catalog sync lands in task 2.2.1; the curated seed catalog covers MVP.
    return [];
  }

  async getModel(): Promise<DiscoveredModel | null> {
    return null;
  }

  validateInput(model: ModelDefinition, input: CanonicalInput): ValidationResult {
    return validateCanonicalInput(model, input);
  }

  estimateCost(model: ModelDefinition, input: CanonicalInput): ProviderCostEstimate {
    // Rates live in model_pricing; PricingService owns the customer-facing
    // number. This returns provider-side measures only.
    const unit = unitForCategory(model.category);
    const { measures, approximate } = measuresForInput(model, unit, input);
    return { unit, measures, providerCostMicroUsd: Math.round(providerUsdFor(unit, {}, measures) * 1_000_000), approximate };
  }

  async execute(model: ModelDefinition, input: CanonicalInput, ctx: ExecuteContext): Promise<ProviderJob> {
    const providerRequestId = ctx.requestId;
    const body = buildProviderInput(model, input);

    try {
      const options: Record<string, unknown> = { ...this.gatewayOptions() };
      // Models that declare async-job go through Cloudflare's queue, which
      // avoids capacity errors on long work and returns a request_id to poll.
      if (model.capabilities.includes("async-job")) options.queueRequest = true;

      let raw: unknown;
      try {
        raw = await this.env.AI.run(model.id as never, body as never, options as never);
      } catch (error) {
        // Some newer Workers AI models (FLUX.2 Klein, for one) declare their
        // input as a `multipart` object rather than top-level fields. The
        // schema check rejects the request before any inference runs, so
        // sending the same fields once more, nested, costs nothing extra and
        // saves hand-maintaining a list of which models want which shape.
        if (!wantsMultipart(error)) throw error;
        raw = await this.env.AI.run(model.id as never, { multipart: body } as never, options as never);
      }
      const result = await this.normalize(model, raw);

      if (result.pending) {
        // "queued" means Cloudflare accepted it into the async queue and has
        // not started; "running" means a third-party model is already working.
        // Keeping them apart lets the UI say something truthful.
        return {
          providerRequestId: result.requestId ?? providerRequestId,
          status: result.startedRemotely ? "running" : "queued",
          handle: encodeHandle(model.id, result.requestId ?? providerRequestId),
        };
      }
      return { providerRequestId, status: "completed", output: result.output, usage: result.usage };
    } catch (error) {
      return { providerRequestId, status: "failed", error: classifyProviderError(error, model) };
    }
  }

  /**
   * Polls a queued inference. Cloudflare returns the finished result from the
   * same endpoint when given the request_id, and reports `queued` or `running`
   * until then.
   */
  async getJob(handle: string, model?: ModelDefinition): Promise<ProviderJob> {
    const { modelId, requestId } = decodeHandle(handle);
    try {
      const raw = (await this.env.AI.run(
        modelId as never,
        { request_id: requestId } as never,
        this.gatewayOptions() as never,
      )) as unknown;

      const status = (raw as { status?: string } | null)?.status;
      if (status === "queued" || status === "running") {
        return { providerRequestId: requestId, status: status === "queued" ? "queued" : "running", handle };
      }
      const result = await this.normalize(model ?? placeholderModel(modelId), raw);
      if (result.pending) return { providerRequestId: requestId, status: "running", handle };
      return { providerRequestId: requestId, status: "completed", output: result.output, usage: result.usage };
    } catch (error) {
      return {
        providerRequestId: requestId,
        status: "failed",
        error: classifyProviderError(error, model ?? placeholderModel(modelId)),
      };
    }
  }

  /**
   * AI Gateway is optional. Workers AI models run fine without one; naming a
   * gateway that does not exist in the account makes every call fail with
   * Cloudflare error 2001. Third-party models billed through AI Gateway do
   * need it, so set AI_GATEWAY_ID once the gateway exists in the dashboard.
   */
  private gatewayOptions(): { gateway?: { id: string } } {
    const id = this.env.AI_GATEWAY_ID?.trim();
    return id ? { gateway: { id } } : {};
  }

  async cancelJob(): Promise<void> {
    // Cloudflare exposes no cancellation for queued inference. The engine marks
    // the node cancelled and stops scheduling downstream work; any result that
    // still arrives is discarded rather than charged.
  }

  /** Turns whatever the model returned into canonical output plus usage. */
  private async normalize(
    model: ModelDefinition,
    raw: unknown,
  ): Promise<{ output?: CanonicalOutput; usage?: ProviderUsage; pending?: boolean; requestId?: string; startedRemotely?: boolean }> {
    // Binary streams (some image models return a ReadableStream).
    if (raw instanceof ReadableStream) {
      const bytes = await new Response(raw).arrayBuffer();
      return { output: { image: { mime: "image/png", bytes } }, usage: this.usageFor(model, {}) };
    }
    if (raw instanceof ArrayBuffer) {
      return { output: { image: { mime: "image/png", bytes: raw } }, usage: this.usageFor(model, {}) };
    }

    const res = (raw ?? {}) as CloudflareRunResult;
    const payload = (res.result ?? res) as CloudflareRunResult;

    // Two shapes mean "not finished": Workers AI's queue returns a request_id
    // with a queued/running status, third-party models report a `state`.
    const requestId = typeof res.request_id === "string" ? res.request_id : undefined;
    const queueStatus = typeof res.status === "string" ? res.status : undefined;
    if (requestId && (queueStatus === "queued" || queueStatus === "running" || queueStatus === undefined)) {
      if (!payload.image && !payload.video && !payload.audio && payload.response === undefined && payload.text === undefined) {
        return { pending: true, requestId };
      }
    }
    if (typeof res.state === "string" && res.state.toLowerCase() !== "completed") {
      return { pending: true, startedRemotely: true, ...(requestId ? { requestId } : {}) };
    }

    if (typeof payload.image === "string") {
      // Some third-party image models (GPT Image) hand back a signed URL
      // rather than base64; it expires, so the bytes are pulled in now.
      const image = /^https?:\/\//.test(payload.image)
        ? await downloadToRef(payload.image, "image/png")
        : { mime: "image/png", bytes: base64ToArrayBuffer(payload.image) };
      return { output: { image }, usage: this.usageFor(model, {}) };
    }

    const videoUrl = typeof payload.video === "string" ? payload.video : payload.video?.url;
    if (videoUrl) {
      // Provider URLs expire, so the bytes are pulled in immediately.
      const ref = await downloadToRef(videoUrl, "video/mp4");
      return { output: { video: ref }, usage: this.usageFor(model, {}) };
    }

    if (typeof payload.audio === "string") {
      return {
        output: { audio: { mime: "audio/mpeg", bytes: base64ToArrayBuffer(payload.audio) } },
        usage: this.usageFor(model, {}),
      };
    }

    if (Array.isArray(payload.data)) {
      return { output: { embedding: payload.data[0] ?? [] }, usage: this.usageFor(model, {}) };
    }

    const text =
      typeof payload.response === "string"
        ? payload.response
        : typeof payload.text === "string"
          ? payload.text
          : undefined;
    if (text !== undefined) {
      const usage = this.usageFor(model, {
        tokensIn: payload.usage?.prompt_tokens ?? 0,
        tokensOut: payload.usage?.completion_tokens ?? 0,
      });
      const json = typeof payload.response === "object" ? payload.response : undefined;
      return { output: { text, ...(json ? { json } : {}) }, usage };
    }

    if (typeof payload.response === "object" && payload.response !== null) {
      return { output: { json: payload.response }, usage: this.usageFor(model, {}) };
    }

    throw new AppError("provider_error", `${model.displayName} returned a response RaisAI could not read.`, {
      action: "Try again or pick another model.",
    });
  }

  /**
   * Usage is only reported when the provider actually told us something.
   * Returning an empty measures object would price to zero and make the
   * generation free; omitting it makes PricingService fall back to the
   * estimate and record cost_basis 'estimated' (BILLING.md).
   */
  private usageFor(model: ModelDefinition, measures: Record<string, number>): ProviderUsage | undefined {
    const reported = Object.entries(measures).filter(([, v]) => typeof v === "number" && v > 0);
    if (reported.length === 0) return undefined;
    return { unit: unitForCategory(model.category), measures: Object.fromEntries(reported) };
  }
}

function unitForCategory(category: ModelDefinition["category"]): ProviderCostEstimate["unit"] {
  switch (category) {
    case "image": return "tile_step";
    case "video": return "video_seconds";
    case "audio": return "audio_minute";
    default: return "tokens";
  }
}

const HANDLE_SEPARATOR = "::";

function encodeHandle(modelId: string, requestId: string): string {
  return `${modelId}${HANDLE_SEPARATOR}${requestId}`;
}

export function decodeHandle(handle: string): { modelId: string; requestId: string } {
  const index = handle.lastIndexOf(HANDLE_SEPARATOR);
  if (index === -1) throw new AppError("internal", `Malformed job handle: ${handle}`);
  return { modelId: handle.slice(0, index), requestId: handle.slice(index + HANDLE_SEPARATOR.length) };
}

/** Minimal stand-in so polling can report errors before the model is reloaded. */
function placeholderModel(modelId: string): ModelDefinition {
  return {
    id: modelId, provider: "cloudflare", hosting: "workers-ai", displayName: modelId,
    description: "", category: "utility", task: "unknown", capabilities: [],
    inputs: {}, outputs: {}, parameters: [], limits: {}, status: "enabled",
    tags: [], version: "1", sortOrder: 0,
  };
}

async function downloadToRef(url: string, fallbackMime: string): Promise<BinaryRef> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError("provider_error", "The generated file could not be downloaded from the provider.", {
      action: "Try generating again.",
    });
  }
  return { mime: res.headers.get("content-type") ?? fallbackMime, bytes: await res.arrayBuffer(), url };
}

/** Maps a provider failure onto a retryable flag and a message a user can act on (§112). */
/** True when Cloudflare rejected the request shape for lacking a `multipart` root object. */
export function wantsMultipart(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /required properties at '\/' are 'multipart'|multipart/i.test(message) && !/multipart\/form-data/i.test(message);
}

export function classifyProviderError(error: unknown, model: ModelDefinition): { code: string; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return { code: "provider_timeout", message: `${model.displayName} took too long to respond.`, retryable: true };
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return { code: "rate_limited", message: `${model.displayName} is busy right now.`, retryable: true };
  }
  if (lower.includes("capacity") || lower.includes("503") || lower.includes("502") || lower.includes("unavailable")) {
    return { code: "provider_error", message: `${model.displayName} is temporarily unavailable.`, retryable: true };
  }
  if (lower.includes("invalid") || lower.includes("400") || lower.includes("schema")) {
    return {
      code: "invalid_input",
      message: `${model.displayName} rejected these settings: ${message}`,
      retryable: false,
    };
  }
  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("403")) {
    return { code: "provider_error", message: "RaisAI could not reach the model provider.", retryable: false };
  }
  return { code: "provider_error", message: `${model.displayName} failed: ${message}`, retryable: true };
}
