import type { PricingUnit } from "@raisai/shared";

/** One rate as Cloudflare's catalog states it: "$0.15 per M input tokens". */
export interface CatalogRate {
  unit?: string;
  price?: number;
  currency?: string;
}

export interface TranslatedPricing {
  unit: PricingUnit;
  providerUsd: Record<string, number>;
}

export type Translation =
  | { ok: true; pricing: TranslatedPricing }
  | { ok: false; reason: string; unknownUnits: string[] };

/**
 * How each phrasing Cloudflare uses maps onto our pricing shapes.
 *
 * Matched on normalised text, so "per M input tokens" and "per 1M input
 * tokens" land on the same key. A phrasing not listed here fails the whole
 * model rather than pricing half of it: a rate the estimate cannot see is a
 * charge the customer was never shown (§5, §164).
 */
const UNIT_KEYS: { test: RegExp; unit: PricingUnit; key: string; scale?: number }[] = [
  { test: /^per\s*(1\s*)?m\s+cached\s+input\s+tokens?$/, unit: "tokens", key: "perMCachedInputTokens" },
  { test: /^per\s*(1\s*)?m\s+input\s+tokens?$/, unit: "tokens", key: "perMInputTokens" },
  { test: /^per\s*(1\s*)?m\s+output\s+tokens?$/, unit: "tokens", key: "perMOutputTokens" },
  { test: /^per\s*(1\s*)?m\s+tokens?$/, unit: "tokens", key: "perMInputTokens" },
  { test: /^per\s+512\s*(by|x)\s*512\s+tile$/, unit: "tile_step", key: "per512Tile" },
  { test: /^per\s+step$/, unit: "tile_step", key: "perStep" },
  { test: /^per\s+(first\s+)?megapixel$/, unit: "megapixel_tiered", key: "firstMegapixel" },
  { test: /^per\s+additional\s+megapixel$/, unit: "megapixel_tiered", key: "perAdditionalMegapixel" },
  { test: /^per\s+input\s+(image\s+)?megapixel$/, unit: "megapixel_tiered", key: "perInputImageMegapixel" },
  // "(websocket)" marks the realtime variant of a speech model; same rate shape.
  { test: /^per\s+(audio\s+)?minute(\s+of\s+audio)?(\s+\(websocket\))?$/, unit: "audio_minute", key: "perAudioMinute" },
  // Cloudflare quotes audio by the second for some speech models.
  { test: /^per\s+(audio\s+)?second(\s+of\s+audio)?$/, unit: "audio_minute", key: "perAudioMinute", scale: 60 },
  { test: /^per\s*1\s*k\s+characters?$/, unit: "characters", key: "per1kCharacters" },
  { test: /^per\s*(1\s*)?m\s+characters?$/, unit: "characters", key: "per1kCharacters", scale: 1 / 1000 },
  { test: /^per\s+second(\s+of\s+video)?$/, unit: "video_seconds", key: "perSecond" },
  { test: /^per\s+video\s+second$/, unit: "video_seconds", key: "perSecond" },
  { test: /^per\s+(image|request|call|generation|inference\s+request)$/, unit: "flat", key: "flat" },
];

/** A model whose only "per second" rate is on a video model means video, not audio. */
function disambiguate(unit: PricingUnit, category: string | undefined, key: string): PricingUnit {
  if (key === "perAudioMinute" && category === "video") return "video_seconds";
  return unit;
}

export function translateCatalogPricing(rates: CatalogRate[], category?: string): Translation {
  const providerUsd: Record<string, number> = {};
  const units = new Set<PricingUnit>();
  const unknown: string[] = [];

  for (const rate of rates) {
    const text = (rate.unit ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const price = typeof rate.price === "number" ? rate.price : Number(rate.price);
    if (!text || !Number.isFinite(price)) {
      unknown.push(rate.unit ?? "(empty)");
      continue;
    }
    if (rate.currency && rate.currency.toUpperCase() !== "USD") {
      unknown.push(`${rate.unit} in ${rate.currency}`);
      continue;
    }
    const match = UNIT_KEYS.find((u) => u.test.test(text));
    if (!match) {
      unknown.push(rate.unit!);
      continue;
    }
    const unit = disambiguate(match.unit, category, match.key);
    const key = unit === "video_seconds" && match.key === "perAudioMinute" ? "perSecond" : match.key;
    const scale = unit === "video_seconds" && match.key === "perAudioMinute" ? 1 : (match.scale ?? 1);
    units.add(unit);
    providerUsd[key] = price * scale;
  }

  if (unknown.length > 0) {
    return { ok: false, reason: `Rate not understood: ${unknown.join(", ")}`, unknownUnits: unknown };
  }
  if (units.size === 0) return { ok: false, reason: "No rate published.", unknownUnits: [] };
  if (units.size > 1) {
    return { ok: false, reason: `Mixed pricing shapes: ${[...units].join(", ")}`, unknownUnits: [] };
  }
  return { ok: true, pricing: { unit: [...units][0]!, providerUsd } };
}
