import { AppError, roundUpSen, type PricingUnit, type Sen } from "@raisai/shared";
import type { CanonicalInput, ProviderUsage } from "../providers/types";
import type { ModelDefinition } from "@raisai/shared";

/**
 * Pure pricing math (no D1, no bindings) so it is cheap to test exhaustively.
 * Rates are USD, transcribed from Cloudflare's pricing page into model_pricing.
 * See docs/knowledge/CLOUDFLARE-AI.md for the shape of each unit.
 */

export interface PricingPolicy {
  markupPercent: number;
  fxRateUsdMyr: number;
  roundingSen: number;
  minimumChargeSen: number;
}

export const DEFAULT_POLICY: PricingPolicy = {
  markupPercent: 20,
  fxRateUsdMyr: 4.7,
  roundingSen: 1,
  minimumChargeSen: 1,
};

export type Measures = Record<string, number>;

const TILE_PX = 512;

/** Number of 512x512 tiles needed to cover an image. */
export function tilesFor(width: number, height: number): number {
  return Math.ceil(width / TILE_PX) * Math.ceil(height / TILE_PX);
}

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000;
}

/**
 * Provider cost in USD for a set of measures. Returns 0 when a rate is absent
 * rather than inventing one; callers surface that as "no pricing configured".
 */
export function providerUsdFor(unit: PricingUnit, rates: Record<string, number>, m: Measures): number {
  const r = (key: string): number => rates[key] ?? 0;
  switch (unit) {
    case "tile_step":
      return r("per512Tile") * (m.tiles ?? 0) + r("perStep") * (m.steps ?? 0);

    case "megapixel_tiered": {
      const mp = m.megapixels ?? 0;
      const first = mp > 0 ? r("firstMegapixel") : 0;
      const additional = Math.max(0, mp - 1) * r("perAdditionalMegapixel");
      const inputs = (m.inputMegapixels ?? 0) * r("perInputImageMegapixel");
      return first + additional + inputs;
    }

    case "tokens":
      return (
        (r("perMInputTokens") * (m.tokensIn ?? 0)) / 1_000_000 +
        (r("perMOutputTokens") * (m.tokensOut ?? 0)) / 1_000_000 +
        (r("perMCachedInputTokens") * (m.tokensCached ?? 0)) / 1_000_000
      );

    case "audio_minute":
      return r("perAudioMinute") * (m.audioMinutes ?? 0);

    case "characters":
      return (r("per1kCharacters") * (m.characters ?? 0)) / 1000;

    case "video_seconds":
      return r("perSecond") * (m.seconds ?? 0) * (m.resolutionMultiplier ?? 1);

    case "flat":
      return r("flat");

    default: {
      const exhaustive: never = unit;
      throw new AppError("internal", `Unhandled pricing unit: ${String(exhaustive)}`);
    }
  }
}

/**
 * Provider USD to the amount the customer is charged, in sen.
 * customerSen = max(roundUp(usd x fx x (1 + markup) x 100), minimum)
 */
export function toCustomerSen(providerUsd: number, policy: PricingPolicy): Sen {
  if (providerUsd <= 0) return 0;
  const withMarkup = providerUsd * policy.fxRateUsdMyr * (1 + policy.markupPercent / 100);
  const rawSen = Math.ceil(withMarkup * 100);
  return Math.max(roundUpSen(rawSen, policy.roundingSen), policy.minimumChargeSen);
}

export interface MeasureResult {
  measures: Measures;
  /** True when a measure had to be assumed (e.g. output tokens before generating). */
  approximate: boolean;
}

/**
 * Derives billable measures from a request. Defaults come from the model's own
 * parameter definitions, never from hard-coded per-model rules (§155).
 */
export function measuresForInput(model: ModelDefinition, unit: PricingUnit, input: CanonicalInput): MeasureResult {
  const paramDefault = (name: string): number | undefined => {
    const p = model.parameters.find((x) => x.name === name);
    return typeof p?.default === "number" ? p.default : undefined;
  };

  switch (unit) {
    case "tile_step": {
      const width = input.width ?? paramDefault("width") ?? 1024;
      const height = input.height ?? paramDefault("height") ?? 1024;
      const steps = input.steps ?? paramDefault("steps") ?? 4;
      return { measures: { tiles: tilesFor(width, height), steps, width, height }, approximate: false };
    }

    case "megapixel_tiered": {
      const width = input.width ?? paramDefault("width") ?? 1024;
      const height = input.height ?? paramDefault("height") ?? 1024;
      const inputImages = input.images ?? [];
      const inputMegapixels = inputImages.reduce(
        (acc, img) => acc + megapixels(img.width ?? 1024, img.height ?? 1024),
        0,
      );
      return {
        measures: { megapixels: megapixels(width, height), inputMegapixels },
        // Reference image dimensions are unknown until upload metadata exists.
        approximate: inputImages.some((i) => i.width === undefined),
      };
    }

    case "tokens": {
      const promptText = input.prompt ?? input.text ?? (input.messages ?? []).map((m) => m.content).join(" ");
      const tokensIn = Math.ceil(promptText.length / 4);
      const tokensOut = input.maxTokens ?? paramDefault("maxTokens") ?? 512;
      // Output length is a ceiling, not a prediction: the estimate is an upper bound.
      return { measures: { tokensIn, tokensOut }, approximate: true };
    }

    case "audio_minute": {
      if (input.audio?.durationMs !== undefined) {
        return { measures: { audioMinutes: input.audio.durationMs / 60_000 }, approximate: false };
      }
      const text = input.text ?? input.prompt ?? "";
      // ~150 spoken words per minute, ~5.5 characters per word.
      const minutes = text.length > 0 ? text.length / (150 * 5.5) : 1;
      return { measures: { audioMinutes: minutes }, approximate: true };
    }

    case "characters": {
      const text = input.text ?? input.prompt ?? "";
      return { measures: { characters: text.length }, approximate: false };
    }

    case "video_seconds": {
      const seconds = input.durationSeconds ?? paramDefault("duration") ?? 5;
      const resolution = input.resolution ?? String(model.parameters.find((p) => p.name === "resolution")?.default ?? "720p");
      return { measures: { seconds, resolutionMultiplier: resolutionMultiplier(resolution) }, approximate: false };
    }

    case "flat":
      return { measures: {}, approximate: false };

    default: {
      const exhaustive: never = unit;
      throw new AppError("internal", `Unhandled pricing unit: ${String(exhaustive)}`);
    }
  }
}

/** Higher resolutions cost proportionally more pixels per second of video. */
function resolutionMultiplier(resolution: string): number {
  switch (resolution) {
    case "540p": return 0.5;
    case "720p": return 1;
    case "1080p": return 2.25;
    case "4k": return 9;
    default: return 1;
  }
}

/** Measures reported by the provider after execution, used for the real charge. */
export function measuresFromUsage(usage: ProviderUsage): Measures {
  return usage.measures;
}
