import { z } from "zod";
import { AppError, type ModelDefinition } from "@raisai/shared";
import { registerNode, type NodeDefinition, type PortDef } from "../registry";
import { asAssetHandles, asText, type AssetHandle, type PortValue } from "../values";
import type { CanonicalInput, CanonicalOutput } from "../../providers/types";

/**
 * One AI node for every model (§19). Ports and parameters come from the
 * selected model's capabilities, so adding a model never adds a node type and
 * changing the model updates the UI without any per-model code (§9).
 */

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** Waits for a queued inference, giving up with an actionable message. */
async function pollUntilSettled(
  ctx: { services: { provider: { getJob(handle: string, model?: ModelDefinition): Promise<import("../../providers/types").ProviderJob> } }; signal?: AbortSignal },
  model: ModelDefinition,
  handle: string,
): Promise<import("../../providers/types").ProviderJob> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let job = await ctx.services.provider.getJob(handle, model);

  while ((job.status === "queued" || job.status === "running") && Date.now() < deadline) {
    if (ctx.signal?.aborted) {
      throw new AppError("cancelled", "This generation was cancelled.");
    }
    await scheduler.wait(POLL_INTERVAL_MS);
    job = await ctx.services.provider.getJob(handle, model);
  }

  if (job.status === "queued" || job.status === "running") {
    throw new AppError("provider_timeout", `${model.displayName} did not finish in time.`, {
      action: "Try again, or choose a faster model.",
    });
  }
  return job;
}

/** Provider failure codes that map straight onto our error vocabulary. */
const KNOWN_PROVIDER_CODES = new Set(["provider_timeout", "rate_limited", "provider_error", "invalid_input"]);

const configSchema = z.object({
  // Message written for a person, not a schema dump: it is shown in the editor.
  modelId: z.string({ required_error: "Choose a model." }).min(1, "Choose a model."),
  parameters: z.record(z.unknown()).default({}),
});

/** Input ports implied by a model's declared capabilities. */
export function inputPortsForModel(model: ModelDefinition | undefined): PortDef[] {
  if (!model) return [{ name: "prompt", type: "prompt", label: "Prompt" }];
  const ports: PortDef[] = [];

  if (model.inputs.prompt !== undefined) ports.push({ name: "prompt", type: "prompt", label: "Prompt" });
  else if (model.inputs.text !== undefined) ports.push({ name: "prompt", type: "text", label: "Text" });

  if (model.capabilities.includes("image-input")) {
    const many = model.capabilities.includes("multiple-images") || model.capabilities.includes("start-end-frame");
    ports.push({ name: "images", type: many ? "image[]" : "image", label: many ? "Reference images" : "Reference image" });
  }
  if (Object.values(model.inputs).includes("video")) {
    // A model that also generates from text treats the clip as a reference
    // (motion, style); a pure video-to-video model works on it directly.
    const reference = model.capabilities.includes("text-to-video") || model.capabilities.includes("reference-video");
    ports.push({ name: "video", type: "video", label: reference ? "Reference video" : "Video" });
  }
  if (model.inputs.mask !== undefined) ports.push({ name: "mask", type: "image", label: "Mask" });
  const audioInput = Object.entries(model.inputs).find(([, type]) => type === "audio");
  if (audioInput) ports.push({ name: "audio", type: "audio", label: audioInput[0] === "reference_audio" ? "Reference audio" : "Audio" });
  if (model.capabilities.includes("negative-prompt")) {
    ports.push({ name: "negativePrompt", type: "text", label: "Negative prompt" });
  }
  return ports;
}

/** Output ports implied by a model's declared outputs. */
export function outputPortsForModel(model: ModelDefinition | undefined): PortDef[] {
  if (!model) return [{ name: "result", type: "any", label: "Result" }];
  const ports: PortDef[] = [];
  for (const [name, type] of Object.entries(model.outputs)) {
    ports.push({ name: name === "json" ? "json" : name, type, label: name.charAt(0).toUpperCase() + name.slice(1) });
  }
  return ports.length > 0 ? ports : [{ name: "result", type: "any", label: "Result" }];
}

/** Builds canonical provider input from resolved ports plus node config. */
async function canonicalInputFor(
  model: ModelDefinition,
  inputs: Record<string, PortValue | undefined>,
  parameters: Record<string, unknown>,
  readAsset: (h: AssetHandle) => Promise<{ bytes: ArrayBuffer; mime: string }>,
): Promise<CanonicalInput> {
  const prompt = asText(inputs.prompt);
  const negativePrompt = asText(inputs.negativePrompt);
  const handles = asAssetHandles(inputs.images);

  const images = await Promise.all(
    handles.map(async (handle) => {
      const { bytes, mime } = await readAsset(handle);
      return { mime, bytes, width: handle.width, height: handle.height };
    }),
  );

  const audioHandle = asAssetHandles(inputs.audio)[0];
  const audio = audioHandle
    ? { ...(await readAsset(audioHandle)), durationMs: audioHandle.durationMs }
    : undefined;

  const maskHandle = asAssetHandles(inputs.mask)[0];
  const mask = maskHandle
    ? { ...(await readAsset(maskHandle)), width: maskHandle.width, height: maskHandle.height }
    : undefined;

  const videoHandle = asAssetHandles(inputs.video)[0];
  const video = videoHandle
    ? { ...(await readAsset(videoHandle)), durationMs: videoHandle.durationMs, width: videoHandle.width, height: videoHandle.height }
    : undefined;
  // A clip's own length is what a video-to-video model is priced on, so it
  // stands in for a duration parameter when the user set none.
  const videoSeconds = video?.durationMs !== undefined ? Math.max(1, Math.ceil(video.durationMs / 1000)) : undefined;

  // Only parameters the model declares are forwarded; anything else is dropped
  // rather than sent to a provider that would reject the whole request.
  const declared = new Set(model.parameters.map((p) => p.name));
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (declared.has(key)) extras[key] = value;
  }

  const numeric = (name: string): number | undefined => {
    const v = parameters[name];
    return typeof v === "number" ? v : undefined;
  };
  const text = (name: string): string | undefined => {
    const v = parameters[name];
    return typeof v === "string" ? v : undefined;
  };

  return {
    ...(prompt !== undefined ? { prompt } : {}),
    ...(model.category === "audio" && prompt !== undefined ? { text: prompt } : {}),
    ...(negativePrompt !== undefined ? { negativePrompt } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(audio ? { audio } : {}),
    ...(mask ? { mask } : {}),
    ...(video ? { video } : {}),
    ...(numeric("width") !== undefined ? { width: numeric("width") } : {}),
    ...(numeric("height") !== undefined ? { height: numeric("height") } : {}),
    ...(numeric("steps") !== undefined ? { steps: numeric("steps") } : {}),
    ...(numeric("seed") !== undefined ? { seed: numeric("seed") } : {}),
    ...(numeric("guidance") !== undefined ? { guidance: numeric("guidance") } : {}),
    ...(numeric("duration") !== undefined
      ? { durationSeconds: numeric("duration") }
      : videoSeconds !== undefined ? { durationSeconds: videoSeconds } : {}),
    ...(numeric("maxTokens") !== undefined ? { maxTokens: numeric("maxTokens") } : {}),
    ...(text("resolution") !== undefined ? { resolution: text("resolution") } : {}),
    ...(text("aspectRatio") !== undefined ? { aspectRatio: text("aspectRatio") } : {}),
    parameters: extras,
  };
}

/** Stores whatever the provider returned and shapes it into port values. */
async function outputsFrom(
  output: CanonicalOutput | undefined,
  store: (input: { name: string; mime: string; bytes: ArrayBuffer; width?: number; height?: number; durationMs?: number }) => Promise<AssetHandle>,
  name: string,
): Promise<Record<string, PortValue>> {
  if (!output) return {};
  const outputs: Record<string, PortValue> = {};

  if (output.image?.bytes) {
    outputs.image = await store({
      name: `${name}.png`, mime: output.image.mime, bytes: output.image.bytes,
      width: output.image.width, height: output.image.height,
    });
  }
  if (output.video?.bytes) {
    outputs.video = await store({
      name: `${name}.mp4`, mime: output.video.mime, bytes: output.video.bytes, durationMs: output.video.durationMs,
    });
  }
  if (output.audio?.bytes) {
    outputs.audio = await store({
      name: `${name}.mp3`, mime: output.audio.mime, bytes: output.audio.bytes, durationMs: output.audio.durationMs,
    });
  }
  if (output.text !== undefined) outputs.text = output.text;
  if (output.json !== undefined) outputs.json = output.json as PortValue;
  if (output.embedding !== undefined) outputs.embedding = output.embedding;
  return outputs;
}

const aiModelNode: NodeDefinition = {
  type: "ai.model",
  version: 1,
  category: "ai",
  label: "AI",
  description: "Runs an AI model. Pick a task and a model; the controls follow.",
  beginner: true,
  inputs: [{ name: "prompt", type: "prompt", label: "Prompt" }],
  outputs: [{ name: "result", type: "any", label: "Result" }],
  configSchema,

  dynamicPorts(_config, model) {
    return { inputs: inputPortsForModel(model), outputs: outputPortsForModel(model) };
  },

  async estimate(ctx) {
    const config = configSchema.parse(ctx.config);
    const model = await ctx.services.getModel(config.modelId);
    const input = await canonicalInputFor(model, ctx.inputs, config.parameters, async () => ({
      // Estimation must not download assets; sizes come from the handle.
      bytes: new ArrayBuffer(0),
      mime: "application/octet-stream",
    }));
    const handles = asAssetHandles(ctx.inputs.images);
    const withSizes = {
      ...input,
      images: handles.map((h) => ({ mime: h.mime, width: h.width, height: h.height })),
    };
    const estimate = await ctx.services.estimateCost(model, withSizes);
    return { estimatedSen: estimate.estimatedSen, approximate: estimate.approximate };
  },

  async execute(ctx) {
    const config = configSchema.parse(ctx.config);
    const started = Date.now();
    const model = await ctx.services.getModel(config.modelId);

    const input = await canonicalInputFor(model, ctx.inputs, config.parameters, (h) => ctx.services.readAsset(h));

    // Validation happens before any spend, and returns every problem at once.
    const validation = ctx.services.provider.validateInput(model, input);
    if (!validation.ok) {
      const first = validation.issues[0]!;
      throw new AppError("invalid_input", first.message, {
        action: first.action,
        details: { issues: validation.issues },
      });
    }

    const estimate = await ctx.services.estimateCost(model, input);
    let job = await ctx.services.provider.execute(model, input, {
      requestId: ctx.auth.requestId,
      signal: ctx.signal,
    });

    // A queued inference is polled until it settles. Cloudflare's async queue
    // usually finishes within about five minutes, so the ceiling sits above
    // that; the durable runner gives a node up to thirty (ADR-003).
    if ((job.status === "queued" || job.status === "running") && job.handle) {
      job = await pollUntilSettled(ctx, model, job.handle);
    }

    if (job.status === "failed" || !job.output) {
      const error = job.error ?? { code: "provider_error", message: `${model.displayName} returned no result.`, retryable: true };
      await ctx.services.recordGeneration({
        modelId: model.id, task: model.task, input: { prompt: input.prompt ?? input.text ?? "" },
        parameters: config.parameters, status: "failed", estimatedCostSen: estimate.estimatedSen,
        costBasis: "estimated", providerRequestId: job.providerRequestId,
        error: { code: error.code, message: error.message }, durationMs: Date.now() - started,
        nodeRunId: ctx.nodeRunId,
      });
      // The provider's own code is preserved, because a node's retry policy
      // names specific codes (provider_timeout, rate_limited) and collapsing
      // them into a generic one would silently disable retries.
      const code = KNOWN_PROVIDER_CODES.has(error.code)
        ? (error.code as "provider_timeout" | "rate_limited" | "provider_error" | "invalid_input")
        : error.retryable
          ? "provider_error"
          : "invalid_input";
      throw new AppError(code, error.message, {
        action: error.retryable ? "Try again, or pick another model." : "Change the settings and try again.",
      });
    }

    const cost = await ctx.services.actualCost(model, job.usage, estimate);
    const outputs = await outputsFrom(job.output, (a) => ctx.services.storeAsset({ ...a, generationId: undefined }), ctx.nodeId);

    const generationId = await ctx.services.recordGeneration({
      modelId: model.id,
      task: model.task,
      input: { prompt: input.prompt ?? input.text ?? "", imageCount: (input.images ?? []).length },
      parameters: config.parameters,
      status: "completed",
      estimatedCostSen: estimate.estimatedSen,
      actualCostSen: cost.actualSen,
      costBasis: cost.basis,
      providerCostMicroUsd: cost.providerCostMicroUsd,
      providerRequestId: job.providerRequestId,
      outputs,
      durationMs: Date.now() - started,
      nodeRunId: ctx.nodeRunId,
    });

    return { outputs, actualCostSen: cost.actualSen, providerRequestId: job.providerRequestId, generationId };
  },
};

export function registerAiNodes(): void {
  registerNode(aiModelNode);
}

export { aiModelNode };
