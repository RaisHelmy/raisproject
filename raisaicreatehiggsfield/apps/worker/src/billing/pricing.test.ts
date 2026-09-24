import { describe, expect, it } from "vitest";
import type { ModelDefinition } from "@raisai/shared";
import { DEFAULT_POLICY, measuresForInput, providerUsdFor, tilesFor, toCustomerSen } from "./pricing";

const imageModel = {
  id: "m", provider: "cloudflare", hosting: "workers-ai", displayName: "M", description: "",
  category: "image", task: "text-to-image", capabilities: [], inputs: {}, outputs: {},
  parameters: [{ name: "steps", type: "range", label: "Steps", default: 4, advanced: true }],
  limits: {}, status: "enabled", tags: [], version: "1", sortOrder: 0,
} as unknown as ModelDefinition;

describe("tiles", () => {
  it("counts 512px tiles needed to cover the image", () => {
    expect(tilesFor(512, 512)).toBe(1);
    expect(tilesFor(1024, 1024)).toBe(4);
    expect(tilesFor(1120, 1120)).toBe(9); // partial tiles still count
  });
});

describe("providerUsdFor", () => {
  it("prices tile_step (flux-1-schnell rates)", () => {
    const usd = providerUsdFor("tile_step", { per512Tile: 0.0000528, perStep: 0.0001056 }, { tiles: 4, steps: 4 });
    expect(usd).toBeCloseTo(0.0002112 + 0.0004224, 10);
  });

  it("prices megapixel_tiered with a first-megapixel rate and input images", () => {
    const rates = { firstMegapixel: 0.015, perAdditionalMegapixel: 0.002, perInputImageMegapixel: 0.002 };
    expect(providerUsdFor("megapixel_tiered", rates, { megapixels: 1 })).toBeCloseTo(0.015, 10);
    expect(providerUsdFor("megapixel_tiered", rates, { megapixels: 3 })).toBeCloseTo(0.015 + 0.004, 10);
    expect(providerUsdFor("megapixel_tiered", rates, { megapixels: 1, inputMegapixels: 2 })).toBeCloseTo(0.019, 10);
  });

  it("prices tokens per million", () => {
    const usd = providerUsdFor("tokens", { perMInputTokens: 0.293, perMOutputTokens: 2.253 }, { tokensIn: 1_000_000, tokensOut: 1_000_000 });
    expect(usd).toBeCloseTo(2.546, 10);
  });

  it("prices audio per minute and text per 1k characters", () => {
    expect(providerUsdFor("audio_minute", { perAudioMinute: 0.0005 }, { audioMinutes: 2 })).toBeCloseTo(0.001, 10);
    expect(providerUsdFor("characters", { per1kCharacters: 0.015 }, { characters: 2000 })).toBeCloseTo(0.03, 10);
  });

  it("scales video by duration and resolution", () => {
    const rates = { perSecond: 0.05 };
    expect(providerUsdFor("video_seconds", rates, { seconds: 5, resolutionMultiplier: 1 })).toBeCloseTo(0.25, 10);
    expect(providerUsdFor("video_seconds", rates, { seconds: 5, resolutionMultiplier: 2.25 })).toBeCloseTo(0.5625, 10);
  });

  it("returns zero when a rate is missing instead of inventing one", () => {
    expect(providerUsdFor("tile_step", {}, { tiles: 4, steps: 4 })).toBe(0);
  });
});

describe("toCustomerSen", () => {
  it("applies fx and markup then rounds up", () => {
    // 0.05 USD x 4.7 x 1.20 = 0.282 MYR -> 28.2 sen -> 29 sen
    expect(toCustomerSen(0.05, DEFAULT_POLICY)).toBe(29);
  });

  it("enforces a minimum charge", () => {
    expect(toCustomerSen(0.000001, { ...DEFAULT_POLICY, minimumChargeSen: 5 })).toBe(5);
  });

  it("rounds up to the configured step", () => {
    expect(toCustomerSen(0.05, { ...DEFAULT_POLICY, roundingSen: 5 })).toBe(30);
  });

  it("never charges for a zero-cost request", () => {
    expect(toCustomerSen(0, DEFAULT_POLICY)).toBe(0);
  });

  it("respects a changed markup", () => {
    const noMarkup = toCustomerSen(0.05, { ...DEFAULT_POLICY, markupPercent: 0 });
    const withMarkup = toCustomerSen(0.05, DEFAULT_POLICY);
    expect(noMarkup).toBeLessThan(withMarkup);
  });
});

describe("measuresForInput", () => {
  it("uses model parameter defaults when the request omits them", () => {
    const { measures, approximate } = measuresForInput(imageModel, "tile_step", { prompt: "x" });
    expect(measures).toMatchObject({ tiles: 4, steps: 4 });
    expect(approximate).toBe(false);
  });

  it("honours explicit request values over defaults", () => {
    const { measures } = measuresForInput(imageModel, "tile_step", { prompt: "x", width: 512, height: 512, steps: 8 });
    expect(measures).toMatchObject({ tiles: 1, steps: 8 });
  });

  it("marks token estimates approximate because output length is a ceiling", () => {
    const { approximate, measures } = measuresForInput(imageModel, "tokens", { prompt: "hello world", maxTokens: 100 });
    expect(approximate).toBe(true);
    expect(measures.tokensOut).toBe(100);
  });

  it("marks reference images approximate until their dimensions are known", () => {
    const known = measuresForInput(imageModel, "megapixel_tiered", { images: [{ mime: "image/png", width: 1024, height: 1024 }] });
    const unknown = measuresForInput(imageModel, "megapixel_tiered", { images: [{ mime: "image/png" }] });
    expect(known.approximate).toBe(false);
    expect(unknown.approximate).toBe(true);
  });

  it("estimates speech duration from text length when no audio is given", () => {
    const { measures, approximate } = measuresForInput(imageModel, "audio_minute", { text: "a".repeat(825) });
    expect(measures.audioMinutes).toBeCloseTo(1, 5);
    expect(approximate).toBe(true);
  });

  it("uses real audio duration when it is known", () => {
    const { measures, approximate } = measuresForInput(imageModel, "audio_minute", {
      audio: { mime: "audio/wav", durationMs: 90_000 },
    });
    expect(measures.audioMinutes).toBe(1.5);
    expect(approximate).toBe(false);
  });
});
