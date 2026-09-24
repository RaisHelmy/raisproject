import { beforeAll, describe, expect, it } from "vitest";
import type { ModelDefinition } from "@raisai/shared";
import { workflowDocumentSchema } from "../src/engine/document";
import { runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { inputPortsForModel } from "../src/engine/nodes/ai-model";
import { STUDIO_PRESETS } from "../src/engine/nodes/ai-presets";
import { resolveSize } from "../src/engine/nodes/image";
import { buildProviderInput } from "../src/providers/cloudflare/mapping";
import { validateCanonicalInput } from "../src/providers/validate-input";
import { makeHarness, testContext } from "./helpers/engine-harness";

const INPAINT = "@cf/runwayml/stable-diffusion-v1-5-inpainting";

beforeAll(() => registerBuiltinNodes());

function model(overrides: Partial<ModelDefinition>): ModelDefinition {
  return {
    id: "test/model", provider: "cloudflare", hosting: "third-party", displayName: "Test", description: "",
    category: "video", task: "video-to-video", capabilities: [], inputs: {}, outputs: { video: "video" },
    parameters: [], limits: {}, status: "enabled", tags: [], version: "1", sortOrder: 0,
    ...overrides,
  };
}

describe("ports follow the model's declared inputs", () => {
  it("adds a mask port for inpainting models and a video port for video-input models", () => {
    const inpaint = model({ category: "image", capabilities: ["inpainting", "image-input", "mask-input"], inputs: { prompt: "prompt", image: "image", mask: "image" } });
    expect(inputPortsForModel(inpaint).map((p) => p.name)).toEqual(["prompt", "images", "mask"]);

    const upscaler = model({ capabilities: ["video-to-video", "video-input"], inputs: { input_video: "video" } });
    const ports = inputPortsForModel(upscaler);
    expect(ports).toEqual([{ name: "video", type: "video", label: "Video" }]);

    const motion = model({ capabilities: ["text-to-video", "reference-video", "video-input", "image-input"], inputs: { prompt: "prompt", image: "image", reference_video: "video", reference_audio: "audio" } });
    expect(inputPortsForModel(motion).map((p) => `${p.name}:${p.label}`)).toEqual([
      "prompt:Prompt", "images:Reference image", "video:Reference video", "audio:Reference audio",
    ]);
  });
});

describe("provider mapping names the field the model expects", () => {
  const bytes = new Uint8Array([1, 2, 3]).buffer;

  it("sends a video under the model's own field name as a data URI", () => {
    const upscaler = model({ capabilities: ["video-to-video", "video-input"], inputs: { input_video: "video" } });
    const body = buildProviderInput(upscaler, { video: { mime: "video/mp4", bytes } });
    expect(body.input_video).toMatch(/^data:video\/mp4;base64,/);
    expect(body.video).toBeUndefined();

    const seedance = model({ capabilities: ["text-to-video", "reference-video", "video-input"], inputs: { prompt: "prompt", reference_video: "video" } });
    expect(buildProviderInput(seedance, { prompt: "walk", video: { mime: "video/mp4", url: "https://x/clip.mp4" } }).reference_video).toBe("https://x/clip.mp4");
  });

  it("sends a Workers AI mask as raw bytes and a list-only image model everything under images", () => {
    const inpaint = model({ hosting: "workers-ai", category: "image", capabilities: ["inpainting", "image-input", "mask-input"], inputs: { prompt: "prompt", image: "image", mask: "image" } });
    const body = buildProviderInput(inpaint, { prompt: "hat", images: [{ mime: "image/png", bytes }], mask: { mime: "image/png", bytes } });
    expect(body.mask).toEqual([1, 2, 3]);
    expect(body.image).toEqual([1, 2, 3]);

    const gpt = model({ category: "image", capabilities: ["text-to-image", "image-input", "multiple-images"], inputs: { prompt: "prompt", images: "image[]" } });
    const multi = buildProviderInput(gpt, { prompt: "same character", images: [{ mime: "image/png", bytes }, { mime: "image/png", bytes }] });
    expect(Array.isArray(multi.images)).toBe(true);
    expect((multi.images as unknown[]).length).toBe(2);
    expect(multi.image).toBeUndefined();
  });
});

describe("input validation for the new ports", () => {
  it("refuses a mask on a model without mask-input, and a mask without an image", () => {
    const plain = model({ category: "image", capabilities: ["text-to-image", "image-input"], inputs: { prompt: "prompt", image: "image" } });
    const issues = validateCanonicalInput(plain, { prompt: "x", mask: { mime: "image/png" } }).issues.map((i) => i.field);
    expect(issues).toContain("mask");
    expect(issues).toContain("images");
  });

  it("requires a clip for a pure video-to-video model but not for text-to-video with a reference slot", () => {
    const upscaler = model({ capabilities: ["video-to-video", "video-input"], inputs: { input_video: "video" } });
    expect(validateCanonicalInput(upscaler, {}).issues.some((i) => i.field === "video")).toBe(true);

    const seedance = model({ capabilities: ["text-to-video", "reference-video", "video-input"], inputs: { prompt: "prompt", reference_video: "video" } });
    expect(validateCanonicalInput(seedance, { prompt: "a cat" }).ok).toBe(true);
  });
});

describe("studio presets", () => {
  it("every preset is registered with the capabilities the editor filters on", () => {
    expect(STUDIO_PRESETS.map((p) => p.type)).toContain("ai.inpaint");
    for (const preset of STUDIO_PRESETS) expect(preset.capabilities.length).toBeGreaterThan(0);
  });

  it("inpaint picks the enabled inpainting model and passes image plus mask through", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "text", type: "input.text", version: 1, config: { value: "a red hat" }, position: { x: 0, y: 0 } },
        { id: "img", type: "input.image", version: 1, config: { assetId: "img-1" }, position: { x: 0, y: 1 } },
        { id: "mask", type: "input.image", version: 1, config: { assetId: "mask-1" }, position: { x: 0, y: 2 } },
        { id: "paint", type: "ai.inpaint", version: 1, config: {}, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "text", port: "text" }, to: { node: "paint", port: "prompt" } },
        { id: "e2", from: { node: "img", port: "image" }, to: { node: "paint", port: "images" } },
        { id: "e3", from: { node: "mask", port: "image" }, to: { node: "paint", port: "mask" } },
        { id: "e4", from: { node: "paint", port: "image" }, to: { node: "out", port: "value" } },
      ],
    });

    const result = await runWorkflow({ doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services });
    expect(result.status).toBe("completed");

    const call = harness.provider.calls[0]!;
    expect(call.modelId).toBe(INPAINT);
    expect(call.input.mask).toBeDefined();
    expect(call.input.images).toHaveLength(1);
    expect(harness.generations[0]?.modelId).toBe(INPAINT);
  });

  it("explains itself when nothing enabled can do the job", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "clip", type: "input.image", version: 1, config: { assetId: "v-1", mime: "video/mp4" }, position: { x: 0, y: 0 } },
        { id: "up", type: "ai.video.upscale", version: 1, config: {}, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "video" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "clip", port: "image" }, to: { node: "up", port: "video" } },
        { id: "e2", from: { node: "up", port: "video" }, to: { node: "out", port: "value" } },
      ],
    });
    const result = await runWorkflow({ doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services });
    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).toMatch(/No enabled model can do "Upscale video"/);
  });
});

describe("image.transform", () => {
  it("derives the missing side from an aspect ratio", () => {
    expect(resolveSize({ width: 1280, aspectRatio: "16:9", fit: "cover", gravity: "auto", rotate: 0, format: "png" }, {})).toEqual({ width: 1280, height: 720 });
    expect(resolveSize({ aspectRatio: "9:16", fit: "cover", gravity: "auto", rotate: 0, format: "png" }, { width: 1920, height: 1080 })).toEqual({ width: 608, height: 1080 });
    expect(resolveSize({ fit: "cover", gravity: "auto", rotate: 0, format: "png" }, { width: 10, height: 10 })).toEqual({});
  });

  it("reframes through the injected transformer and stores the result", async () => {
    const auth = await testContext();
    const harness = await makeHarness({
      async transformImage(_input, options) {
        return { bytes: new Uint8Array([9, 9]).buffer, mime: options.format, width: options.width, height: options.height };
      },
    });
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "img", type: "input.image", version: 1, config: { assetId: "img-1" }, position: { x: 0, y: 0 } },
        { id: "tr", type: "image.transform", version: 1, config: { width: 1280, aspectRatio: "16:9", format: "webp" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "img", port: "image" }, to: { node: "tr", port: "image" } },
        { id: "e2", from: { node: "tr", port: "image" }, to: { node: "out", port: "value" } },
      ],
    });
    const result = await runWorkflow({ doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services });
    expect(result.status).toBe("completed");
    expect(harness.storedAssets[0]?.mime).toBe("image/webp");
    expect(harness.storedAssets[0]?.name).toBe("tr.webp");
    const stored = result.outputs.image as { width?: number; height?: number };
    expect(stored.width).toBe(1280);
    expect(stored.height).toBe(720);
  });

  it("says why when the Images binding is absent", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    delete (harness.services as { transformImage?: unknown }).transformImage;
    const doc = workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "img", type: "input.image", version: 1, config: { assetId: "img-1" }, position: { x: 0, y: 0 } },
        { id: "tr", type: "image.transform", version: 1, config: { format: "png" }, position: { x: 1, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: "e1", from: { node: "img", port: "image" }, to: { node: "tr", port: "image" } },
        { id: "e2", from: { node: "tr", port: "image" }, to: { node: "out", port: "value" } },
      ],
    });
    const result = await runWorkflow({ doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services });
    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).toMatch(/Cloudflare Images binding/);
  });
});
