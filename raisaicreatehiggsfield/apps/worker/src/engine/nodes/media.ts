import { z } from "zod";
import { AppError, type ModelDefinition } from "@raisai/shared";
import { registerNode, type NodeDefinition } from "../registry";
import { asAssetHandles, asText, type PortValue } from "../values";

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** Seconds to a WebVTT/SRT timestamp. */
export function formatTimestamp(seconds: number, separator: "." | "," = "."): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${pad(millis, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${formatTimestamp(cue.start, ",")} --> ${formatTimestamp(cue.end, ",")}\n${cue.text.trim()}\n`)
    .join("\n");
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map((cue) => `${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text.trim()}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/**
 * Splits plain text into readable cues when a transcript carries no timings.
 * Paced at roughly natural reading speed rather than guessing at the audio.
 */
export function cuesFromText(text: string, wordsPerMinute = 150): Cue[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const cues: Cue[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    const duration = Math.max(1.2, (words / wordsPerMinute) * 60);
    cues.push({ start: cursor, end: cursor + duration, text: sentence });
    cursor += duration;
  }
  return cues;
}

/** Reads cues out of whatever shape a transcription model returned. */
export function cuesFromTranscript(value: unknown): Cue[] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const segments = record.segments ?? record.words;
  if (Array.isArray(segments)) {
    const cues = segments
      .map((segment) => {
        const s = segment as Record<string, unknown>;
        const start = Number(s.start ?? s.offset);
        const end = Number(s.end ?? (typeof s.start === "number" && typeof s.duration === "number" ? s.start + s.duration : NaN));
        const text = typeof s.text === "string" ? s.text : typeof s.word === "string" ? s.word : "";
        if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null;
        return { start, end, text };
      })
      .filter((c): c is Cue => c !== null);
    if (cues.length > 0) return cues;
  }
  return null;
}

const subtitlesNode: NodeDefinition = {
  type: "subtitles",
  version: 1,
  category: "media",
  label: "Subtitles",
  description: "Turns a transcript or script into SRT or WebVTT subtitles.",
  inputs: [
    { name: "text", type: "text", label: "Text" },
    { name: "transcript", type: "json", label: "Transcript" },
  ],
  outputs: [
    { name: "subtitles", type: "text", label: "Subtitles" },
    { name: "format", type: "string", label: "Format" },
  ],
  configSchema: z.object({
    format: z.enum(["srt", "vtt"]).default("srt"),
    wordsPerMinute: z.number().min(60).max(300).default(150),
  }),
  async execute(ctx) {
    const config = ctx.config as { format?: "srt" | "vtt"; wordsPerMinute?: number };

    // Real timings when the model gave them; paced text only as a fallback (§45).
    const cues =
      cuesFromTranscript(ctx.inputs.transcript) ??
      cuesFromText(asText(ctx.inputs.text) ?? "", config.wordsPerMinute ?? 150);

    if (cues.length === 0) {
      throw new AppError("invalid_input", "There is no text to make subtitles from.", {
        action: "Connect a transcript or some text.",
      });
    }
    const format = config.format ?? "srt";
    return { outputs: { subtitles: format === "vtt" ? toVtt(cues) : toSrt(cues), format } };
  },
};

const MAX_BATCH = 20;

const batchNode: NodeDefinition = {
  type: "ai.batch",
  version: 1,
  category: "ai",
  label: "AI batch",
  description: "Runs one model over a list of prompts and returns every result.",
  inputs: [{ name: "prompts", type: "array", label: "Prompts", required: true }],
  outputs: [
    { name: "results", type: "array", label: "Results" },
    { name: "count", type: "number", label: "Count" },
  ],
  configSchema: z.object({
    modelId: z.string({ required_error: "Choose a model." }).min(1, "Choose a model."),
    parameters: z.record(z.unknown()).default({}),
    maxItems: z.number().int().min(1).max(MAX_BATCH).default(5),
    maxCostSen: z.number().int().positive().optional(),
  }),

  async estimate(ctx) {
    const config = ctx.config as { modelId?: string; maxItems?: number; parameters?: Record<string, unknown> };
    if (!config.modelId) return { estimatedSen: 0, approximate: true };
    const model = await ctx.services.getModel(config.modelId);
    const one = await ctx.services.estimateCost(model, { prompt: "sample" });
    // The ceiling, not a guess: the run may do fewer, never more.
    return { estimatedSen: one.estimatedSen * (config.maxItems ?? 5), approximate: true };
  },

  async execute(ctx) {
    const config = ctx.config as { modelId: string; parameters?: Record<string, unknown>; maxItems?: number; maxCostSen?: number };
    const model: ModelDefinition = await ctx.services.getModel(config.modelId);

    const raw = ctx.inputs.prompts;
    const prompts = (Array.isArray(raw) ? raw : [raw])
      .map((item) => asText(item as PortValue))
      .filter((item): item is string => Boolean(item && item.trim()));

    if (prompts.length === 0) {
      throw new AppError("invalid_input", "The list of prompts is empty.", {
        action: "Connect a list of prompts, one per item.",
      });
    }

    // Two ceilings, both enforced before each call rather than after: a list
    // arriving from an LLM must not be able to spend without bound (§108, §139).
    const limit = Math.min(config.maxItems ?? 5, MAX_BATCH, prompts.length);
    const results: PortValue[] = [];
    let spentSen = 0;

    for (let index = 0; index < limit; index++) {
      const prompt = prompts[index]!;
      const estimate = await ctx.services.estimateCost(model, { prompt });
      if (config.maxCostSen !== undefined && spentSen + estimate.estimatedSen > config.maxCostSen) break;

      const job = await ctx.services.provider.execute(model, { prompt }, { requestId: ctx.auth.requestId, signal: ctx.signal });
      if (job.status === "failed" || !job.output) {
        throw new AppError("provider_error", job.error?.message ?? `${model.displayName} failed on item ${index + 1}.`, {
          action: "Try again, or shorten the list.",
        });
      }

      const cost = await ctx.services.actualCost(model, job.usage, estimate);
      spentSen += cost.actualSen;

      if (job.output.image?.bytes) {
        results.push(
          await ctx.services.storeAsset({
            name: `${ctx.nodeId}-${index + 1}.png`,
            mime: job.output.image.mime,
            bytes: job.output.image.bytes,
            width: job.output.image.width,
            height: job.output.image.height,
          }),
        );
      } else if (job.output.text !== undefined) {
        results.push(job.output.text);
      }

      await ctx.services.recordGeneration({
        modelId: model.id, task: model.task, input: { prompt }, parameters: config.parameters ?? {},
        status: "completed", estimatedCostSen: estimate.estimatedSen, actualCostSen: cost.actualSen,
        costBasis: cost.basis, providerCostMicroUsd: cost.providerCostMicroUsd,
        providerRequestId: job.providerRequestId, durationMs: 0, nodeRunId: ctx.nodeRunId,
      });
    }

    return { outputs: { results, count: results.length }, actualCostSen: spentSen };
  },
};

export const MEDIA_NODES = [subtitlesNode, batchNode];

export function registerMediaNodes(): void {
  for (const node of MEDIA_NODES) registerNode(node);
}
