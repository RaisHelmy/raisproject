import { newId, type ModelDefinition } from "@raisai/shared";
import type {
  AIProvider,
  CanonicalInput,
  CanonicalOutput,
  DiscoveredModel,
  ExecuteContext,
  ProviderCostEstimate,
  ProviderJob,
  ProviderUsage,
  ValidationResult,
} from "../types";
import { validateCanonicalInput } from "../validate-input";

/** 1x1 transparent PNG. */
const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
/** Minimal silent WAV header + one sample. */
const TINY_WAV = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x26, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0, 0, 0, 1, 0, 1, 0, 0x44, 0xac, 0, 0, 0x88, 0x58, 1, 0, 2, 0, 0x10, 0,
  0x64, 0x61, 0x74, 0x61, 2, 0, 0, 0, 0, 0,
]);

export interface FakeFailure {
  code: string;
  message: string;
  retryable: boolean;
  /** Fail this many calls then succeed; omit to always fail. */
  times?: number;
}

export interface FakeProviderOptions {
  /** Artificial latency in ms. */
  latencyMs?: number;
  /** Return an async job handle instead of a completed result. */
  async?: boolean;
}

/**
 * Deterministic provider for tests (TESTING.md). Lets every engine, billing and
 * API test run without calling Cloudflare AI or spending real money.
 */
export class FakeAIProvider implements AIProvider {
  readonly id = "fake";
  private readonly models = new Map<string, DiscoveredModel>();
  private readonly failures = new Map<string, FakeFailure>();
  private readonly jobs = new Map<string, ProviderJob>();
  private readonly cancelled = new Set<string>();
  /** Every execute() call, for assertions about what the engine sent. */
  readonly calls: { modelId: string; input: CanonicalInput; requestId: string }[] = [];

  constructor(private readonly options: FakeProviderOptions = {}) {}

  registerModel(model: DiscoveredModel): void {
    this.models.set(model.id, model);
  }

  /** Make the next call(s) to `modelId` fail with the given error. */
  failNext(modelId: string, failure: FakeFailure): void {
    this.failures.set(modelId, failure);
  }

  clearFailures(): void {
    this.failures.clear();
  }

  async listModels(): Promise<DiscoveredModel[]> {
    return [...this.models.values()];
  }

  async getModel(id: string): Promise<DiscoveredModel | null> {
    return this.models.get(id) ?? null;
  }

  validateInput(model: ModelDefinition, input: CanonicalInput): ValidationResult {
    // Same rules as the real provider, so tests catch what production catches.
    return validateCanonicalInput(model, input);
  }

  estimateCost(model: ModelDefinition, input: CanonicalInput): ProviderCostEstimate {
    const { unit, measures, approximate } = this.measure(model, input, null);
    return { unit, measures, providerCostMicroUsd: this.priceOf(unit, measures), approximate };
  }

  async execute(model: ModelDefinition, input: CanonicalInput, ctx: ExecuteContext): Promise<ProviderJob> {
    this.calls.push({ modelId: model.id, input, requestId: ctx.requestId });
    if (this.options.latencyMs) await scheduler.wait(this.options.latencyMs);

    const failure = this.failures.get(model.id);
    if (failure) {
      if (failure.times !== undefined) {
        if (failure.times <= 1) this.failures.delete(model.id);
        else this.failures.set(model.id, { ...failure, times: failure.times - 1 });
      }
      return {
        providerRequestId: `fake_${newId()}`,
        status: "failed",
        error: { code: failure.code, message: failure.message, retryable: failure.retryable },
      };
    }

    const output = this.outputFor(model, input);
    const { unit, measures } = this.measure(model, input, output);
    const usage: ProviderUsage = { unit, measures, providerCostMicroUsd: this.priceOf(unit, measures) };
    const providerRequestId = `fake_${newId()}`;

    if (this.options.async) {
      const handle = `job_${newId()}`;
      // First poll reports running, the next reports completion.
      this.jobs.set(handle, { providerRequestId, status: "running", handle });
      this.jobs.set(`${handle}:final`, { providerRequestId, status: "completed", output, usage, handle });
      return { providerRequestId, status: "queued", handle };
    }
    return { providerRequestId, status: "completed", output, usage };
  }

  async getJob(handle: string): Promise<ProviderJob> {
    if (this.cancelled.has(handle)) {
      return { providerRequestId: `fake_${handle}`, status: "failed", error: { code: "cancelled", message: "Cancelled.", retryable: false } };
    }
    const pending = this.jobs.get(handle);
    const final = this.jobs.get(`${handle}:final`);
    if (pending && final) {
      this.jobs.delete(handle); // next poll returns the final state
      return pending;
    }
    if (final) return final;
    throw new Error(`unknown fake job handle: ${handle}`);
  }

  async cancelJob(handle: string): Promise<void> {
    this.cancelled.add(handle);
    this.jobs.delete(handle);
    this.jobs.delete(`${handle}:final`);
  }

  private outputFor(model: ModelDefinition, input: CanonicalInput): CanonicalOutput {
    const outputs = Object.values(model.outputs);
    if (outputs.includes("image")) {
      return {
        image: {
          mime: "image/png",
          bytes: TINY_PNG.buffer.slice(0) as ArrayBuffer,
          width: input.width ?? 1024,
          height: input.height ?? 1024,
        },
      };
    }
    if (outputs.includes("video")) {
      return {
        video: {
          mime: "video/mp4",
          bytes: new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]).buffer as ArrayBuffer,
          durationMs: (input.durationSeconds ?? 5) * 1000,
        },
      };
    }
    if (outputs.includes("audio")) {
      return { audio: { mime: "audio/wav", bytes: TINY_WAV.buffer.slice(0) as ArrayBuffer, durationMs: 1000 } };
    }
    return { text: `fake output for: ${input.prompt ?? input.text ?? "(no prompt)"}` };
  }

  private measure(
    model: ModelDefinition,
    input: CanonicalInput,
    output: CanonicalOutput | null,
  ): { unit: ProviderCostEstimate["unit"]; measures: Record<string, number>; approximate: boolean } {
    switch (model.category) {
      case "image": {
        const width = input.width ?? 1024;
        const height = input.height ?? 1024;
        return {
          unit: "megapixel_tiered",
          measures: { megapixels: (width * height) / 1_000_000, inputImages: input.images?.length ?? 0 },
          approximate: false,
        };
      }
      case "video":
        return { unit: "video_seconds", measures: { seconds: input.durationSeconds ?? 5 }, approximate: false };
      case "audio":
        return {
          unit: "characters",
          measures: { characters: (input.text ?? input.prompt ?? "").length },
          approximate: false,
        };
      default: {
        const promptChars = (input.prompt ?? input.text ?? "").length;
        const tokensIn = Math.ceil(promptChars / 4);
        const tokensOut = output?.text ? Math.ceil(output.text.length / 4) : (input.maxTokens ?? 256);
        return { unit: "tokens", measures: { tokensIn, tokensOut }, approximate: output === null };
      }
    }
  }

  /** Flat synthetic rates; real rates live in model_pricing. */
  private priceOf(unit: ProviderCostEstimate["unit"], m: Record<string, number>): number {
    switch (unit) {
      case "megapixel_tiered":
        return Math.round(15_000 * (m.megapixels ?? 1) + 2_000 * (m.inputImages ?? 0));
      case "video_seconds":
        return Math.round(50_000 * (m.seconds ?? 5));
      case "characters":
        return Math.round(15 * (m.characters ?? 0));
      case "tokens":
        return Math.round(0.5 * (m.tokensIn ?? 0) + 1.5 * (m.tokensOut ?? 0));
      default:
        return 1_000;
    }
  }
}
