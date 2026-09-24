import { z } from "zod";
import { AppError, type ModelDefinition } from "@raisai/shared";
import { registerNode, type EngineServices, type NodeDefinition, type PortDef } from "../registry";
import { aiModelNode, inputPortsForModel, outputPortsForModel } from "./ai-model";

/**
 * Studio presets: one palette entry per creative job (upscale, inpaint,
 * motion, speech...), the way a creator thinks about the work, rather than
 * one generic "AI" box. Each is a thin skin over `ai.model` — same executor,
 * same billing, same history — that pre-selects the capabilities a model
 * must have and picks the best enabled one when the user has not chosen.
 * Adding a model with the right capabilities lights these up with no code.
 */

const configSchema = z.object({
  modelId: z.string().default(""),
  parameters: z.record(z.unknown()).default({}),
});

interface Preset {
  type: string;
  label: string;
  description: string;
  task: string;
  capabilities: string[];
  beginner?: boolean;
  /** Ports shown before a model is chosen; a chosen model's real ports replace them. */
  inputs: PortDef[];
  outputs: PortDef[];
}

const P = {
  prompt: { name: "prompt", type: "prompt", label: "Prompt" } as PortDef,
  text: { name: "prompt", type: "text", label: "Text" } as PortDef,
  image: { name: "images", type: "image", label: "Image" } as PortDef,
  mask: { name: "mask", type: "image", label: "Mask" } as PortDef,
  video: { name: "video", type: "video", label: "Video" } as PortDef,
  referenceVideo: { name: "video", type: "video", label: "Reference video" } as PortDef,
  audio: { name: "audio", type: "audio", label: "Audio" } as PortDef,
  outImage: { name: "image", type: "image", label: "Image" } as PortDef,
  outVideo: { name: "video", type: "video", label: "Video" } as PortDef,
  outAudio: { name: "audio", type: "audio", label: "Audio" } as PortDef,
  outText: { name: "text", type: "text", label: "Text" } as PortDef,
  outJson: { name: "json", type: "json", label: "Transcript" } as PortDef,
};

export const STUDIO_PRESETS: Preset[] = [
  { type: "ai.image", label: "Image", description: "Create an image from a prompt.", task: "text-to-image", capabilities: ["text-to-image"], beginner: true, inputs: [P.prompt], outputs: [P.outImage] },
  { type: "ai.image.edit", label: "Edit image", description: "Change an image with a prompt, keeping what you like.", task: "image-to-image", capabilities: ["image-to-image", "image-input"], beginner: true, inputs: [P.prompt, P.image], outputs: [P.outImage] },
  { type: "ai.inpaint", label: "Inpaint", description: "Repaint only the masked part of an image (white = repaint).", task: "inpainting", capabilities: ["inpainting", "image-input", "mask-input"], inputs: [P.prompt, P.image, P.mask], outputs: [P.outImage] },
  { type: "ai.upscale", label: "Upscale image", description: "Increase an image's resolution and sharpen detail.", task: "upscale", capabilities: ["upscale", "image-input"], beginner: true, inputs: [P.image], outputs: [P.outImage] },
  { type: "ai.video", label: "Video", description: "Create a video from a prompt.", task: "text-to-video", capabilities: ["text-to-video"], beginner: true, inputs: [P.prompt], outputs: [P.outVideo] },
  { type: "ai.video.from-image", label: "Animate image", description: "Turn a still image into a video shot.", task: "image-to-video", capabilities: ["image-to-video", "image-input"], inputs: [P.prompt, P.image], outputs: [P.outVideo] },
  { type: "ai.video.upscale", label: "Upscale video", description: "Increase a clip's resolution; audio is kept.", task: "video-to-video", capabilities: ["video-to-video", "upscale", "video-input"], inputs: [P.video], outputs: [P.outVideo] },
  { type: "ai.motion", label: "Motion transfer", description: "Drive an image with the movement from a reference clip.", task: "reference-to-video", capabilities: ["reference-video", "video-input", "image-input"], inputs: [P.prompt, P.image, P.referenceVideo], outputs: [P.outVideo] },
  { type: "ai.speech", label: "Speech", description: "Turn text into a spoken voice.", task: "text-to-speech", capabilities: ["text-to-speech"], beginner: true, inputs: [P.text], outputs: [P.outAudio] },
  { type: "ai.transcribe", label: "Transcribe", description: "Turn speech into text with timings.", task: "speech-to-text", capabilities: ["speech-to-text"], inputs: [P.audio], outputs: [P.outText, P.outJson] },
  { type: "ai.describe", label: "Describe image", description: "Ask a question about an image.", task: "vision", capabilities: ["vision", "image-input"], inputs: [P.prompt, P.image], outputs: [P.outText] },
  { type: "ai.music", label: "Music", description: "Compose music from a description.", task: "music", capabilities: ["music"], inputs: [P.prompt], outputs: [P.outAudio] },
  { type: "ai.text", label: "Write", description: "Write or rewrite text from a prompt.", task: "text-generation", capabilities: ["text-generation"], beginner: true, inputs: [P.prompt], outputs: [P.outText] },
];

/** The best enabled model for a preset, or a clear reason there is none. */
async function pickModel(
  services: Pick<EngineServices, "getModel"> & Partial<Pick<EngineServices, "findModels">>,
  preset: Preset,
  modelId: string,
): Promise<ModelDefinition> {
  if (modelId) return services.getModel(modelId);
  if (!services.findModels) {
    throw new AppError("invalid_input", `Pick a model for "${preset.label}".`, { action: "Choose a model on this node." });
  }
  const [best] = await services.findModels(preset.capabilities);
  if (!best) {
    throw new AppError("invalid_input", `No enabled model can do "${preset.label}" yet.`, {
      action: "Enable a model with these capabilities under Admin → Models, or pick one on this node.",
      details: { capabilities: preset.capabilities },
    });
  }
  return best;
}

function presetNode(preset: Preset): NodeDefinition {
  return {
    type: preset.type,
    version: 1,
    category: "ai",
    label: preset.label,
    description: preset.description,
    beginner: preset.beginner ?? false,
    requiredCapabilities: preset.capabilities,
    task: preset.task,
    inputs: preset.inputs,
    outputs: preset.outputs,
    configSchema,

    dynamicPorts(_config, model) {
      if (!model) return { inputs: preset.inputs, outputs: preset.outputs };
      return { inputs: inputPortsForModel(model), outputs: outputPortsForModel(model) };
    },

    async estimate(ctx) {
      const config = configSchema.parse(ctx.config);
      let model: ModelDefinition;
      try {
        model = await pickModel(ctx.services, preset, config.modelId);
      } catch {
        // Nothing enabled yet: contributes nothing but marks the total approximate.
        return { estimatedSen: 0, approximate: true };
      }
      return aiModelNode.estimate!({ ...ctx, config: { modelId: model.id, parameters: config.parameters } });
    },

    async execute(ctx) {
      const config = configSchema.parse(ctx.config);
      const model = await pickModel(ctx.services, preset, config.modelId);
      return aiModelNode.execute({ ...ctx, config: { modelId: model.id, parameters: config.parameters } });
    },
  };
}

export const STUDIO_NODES = STUDIO_PRESETS.map(presetNode);

export function registerStudioNodes(): void {
  for (const node of STUDIO_NODES) registerNode(node);
}
