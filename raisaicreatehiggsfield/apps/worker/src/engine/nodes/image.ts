import { z } from "zod";
import { AppError } from "@raisai/shared";
import { registerNode, type ImageTransformOptions, type NodeDefinition } from "../registry";
import { asAssetHandles } from "../values";

/**
 * Reframe / resize / re-encode without a model, via Cloudflare Images. This
 * is the "change aspect ratio, crop to 9:16, export as WebP" step that sits
 * between generations in a real pipeline, and it costs no model spend.
 */

const FORMATS = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
} as const;

const configSchema = z.object({
  width: z.number().int().min(1).max(12_000).optional(),
  height: z.number().int().min(1).max(12_000).optional(),
  /** "16:9", "9:16", "1:1"... Derives the missing dimension from the source. */
  aspectRatio: z.string().regex(/^\d+:\d+$/, "Use the form 16:9.").optional(),
  fit: z.enum(["scale-down", "contain", "cover", "crop", "pad"]).default("cover"),
  gravity: z.enum(["auto", "center", "left", "right", "top", "bottom"]).default("auto"),
  background: z.string().max(32).optional(),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  blur: z.number().min(0).max(250).optional(),
  sharpen: z.number().min(0).max(10).optional(),
  format: z.enum(["png", "jpeg", "webp", "avif"]).default("png"),
  quality: z.number().int().min(1).max(100).optional(),
});

type Config = z.infer<typeof configSchema>;

/** Target size from config plus whatever is known about the source. */
export function resolveSize(config: Config, source: { width?: number; height?: number }): { width?: number; height?: number } {
  let { width, height } = config;
  if (config.aspectRatio) {
    const [w, h] = config.aspectRatio.split(":").map(Number) as [number, number];
    const ratio = w / h;
    if (width && !height) height = Math.round(width / ratio);
    else if (height && !width) width = Math.round(height * ratio);
    else if (!width && !height && source.width && source.height) {
      // Keep the larger side, so a reframe never upsamples on its own.
      if (source.width / source.height >= ratio) {
        height = source.height;
        width = Math.round(height * ratio);
      } else {
        width = source.width;
        height = Math.round(width / ratio);
      }
    }
  }
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

const transformNode: NodeDefinition = {
  type: "image.transform",
  version: 1,
  category: "media",
  label: "Reframe / resize",
  description: "Resize, crop to an aspect ratio, rotate or re-encode an image. No model, no cost.",
  beginner: true,
  inputs: [{ name: "image", type: "image", label: "Image", required: true }],
  outputs: [
    { name: "image", type: "image", label: "Image" },
    { name: "width", type: "number", label: "Width" },
    { name: "height", type: "number", label: "Height" },
  ],
  configSchema,

  async execute(ctx) {
    const config = configSchema.parse(ctx.config);
    const handle = asAssetHandles(ctx.inputs.image)[0];
    if (!handle) {
      throw new AppError("invalid_input", "There is no image to transform.", { action: "Connect an image." });
    }
    if (!ctx.services.transformImage) {
      throw new AppError("provider_error", "Image transforms are not available on this deployment.", {
        action: "Ask an administrator to enable the Cloudflare Images binding.",
      });
    }

    const source = await ctx.services.readAsset(handle);
    const size = resolveSize(config, handle);
    const options: ImageTransformOptions = {
      ...size,
      fit: config.fit,
      gravity: config.gravity,
      ...(config.background ? { background: config.background } : {}),
      ...(config.rotate ? { rotate: config.rotate } : {}),
      ...(config.blur !== undefined ? { blur: config.blur } : {}),
      ...(config.sharpen !== undefined ? { sharpen: config.sharpen } : {}),
      format: FORMATS[config.format],
      ...(config.quality !== undefined ? { quality: config.quality } : {}),
    };

    const result = await ctx.services.transformImage({ bytes: source.bytes, mime: source.mime }, options);
    const image = await ctx.services.storeAsset({
      name: `${ctx.nodeId}.${config.format === "jpeg" ? "jpg" : config.format}`,
      mime: result.mime,
      bytes: result.bytes,
      width: result.width ?? size.width,
      height: result.height ?? size.height,
    });
    return {
      outputs: {
        image,
        width: image.width ?? null,
        height: image.height ?? null,
      },
    };
  },
};

export const IMAGE_NODES = [transformNode];

export function registerImageNodes(): void {
  for (const node of IMAGE_NODES) registerNode(node);
}
