import type { ModelDefinition } from "@raisai/shared";
import type { BinaryRef, CanonicalInput } from "../types";

/**
 * Maps canonical input onto a specific model's own field names.
 *
 * Everything here is driven by the model's `parameters[].mapsTo` and its
 * declared capabilities, so adding a model is a data change, not a code change
 * (§9, §155). There is deliberately no `if (model.id === ...)` anywhere.
 */

const CANONICAL_TO_COMMON: Record<string, string> = {
  negativePrompt: "negative_prompt",
  maxTokens: "max_tokens",
  aspectRatio: "aspect_ratio",
  durationSeconds: "duration",
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function imageToField(model: ModelDefinition, ref: BinaryRef): string | number[] {
  // Third-party models take a URL or data URI; Workers AI image models take
  // either a byte array or a base64 string depending on the model's schema.
  if (ref.url) return ref.url;
  if (!ref.bytes) return "";
  const b64 = arrayBufferToBase64(ref.bytes);
  if (model.hosting === "third-party") return `data:${ref.mime};base64,${b64}`;
  return model.inputs.image === "image[]" || model.inputs.image_b64 === undefined
    ? [...new Uint8Array(ref.bytes)]
    : b64;
}

/** URL when the provider already hosts it, otherwise an inline data URI (video/audio for third-party models). */
function binaryToField(ref: BinaryRef): string {
  if (ref.url) return ref.url;
  if (!ref.bytes) return "";
  return `data:${ref.mime};base64,${arrayBufferToBase64(ref.bytes)}`;
}

/** Builds the provider request body for a model from canonical input. */
export function buildProviderInput(model: ModelDefinition, input: CanonicalInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const declared = new Set(Object.keys(model.inputs));

  // Text-shaped inputs
  const promptText = input.prompt ?? input.text;
  if (promptText !== undefined) {
    if (declared.has("prompt")) out.prompt = promptText;
    else if (declared.has("text")) out.text = promptText;
    else out.prompt = promptText;
  }
  if (input.messages && model.capabilities.includes("text-generation")) {
    out.messages = input.messages;
    delete out.prompt;
  }

  // Images: the first goes to the model's primary image field, extras only when
  // the model says it accepts several.
  const images = input.images ?? [];
  if (images.length > 0 && model.capabilities.includes("image-input")) {
    const [first, ...rest] = images;
    const singleField = declared.has("image") ? "image" : declared.has("start_image") ? "start_image" : undefined;
    if (singleField === undefined && declared.has("images")) {
      // Models that only take a list (GPT Image's `images[]`) get every
      // reference there and no stray single-image field.
      out.images = images.map((r) => imageToField(model, r));
    } else {
      out[singleField ?? "image"] = imageToField(model, first!);
      if (rest.length > 0 && model.capabilities.includes("start-end-frame")) {
        const endField = declared.has("end_image") ? "end_image" : declared.has("last_frame_image") ? "last_frame_image" : undefined;
        if (endField) out[endField] = imageToField(model, rest[rest.length - 1]!);
      } else if (rest.length > 0 && model.capabilities.includes("multiple-images")) {
        const listField = declared.has("reference_images") ? "reference_images" : "images";
        out[listField] = images.map((r) => imageToField(model, r));
      }
    }
  }

  if (input.mask && declared.has("mask")) {
    // Workers AI inpainting takes the mask as raw bytes; third-party models
    // take it like any other image.
    out.mask = model.hosting === "third-party"
      ? imageToField(model, input.mask)
      : input.mask.bytes ? [...new Uint8Array(input.mask.bytes)] : "";
  }

  if (input.video) {
    // The model names its own video field (`input_video`, `reference_video`,
    // `video`): the first declared input of type video is it.
    const videoField = Object.entries(model.inputs).find(([, type]) => type === "video")?.[0];
    if (videoField) out[videoField] = binaryToField(input.video);
  }

  if (input.audio) {
    const audioField = declared.has("audio") ? "audio" : declared.has("reference_audio") ? "reference_audio" : undefined;
    if (audioField) {
      out[audioField] = model.hosting === "third-party"
        ? binaryToField(input.audio)
        : input.audio.bytes ? [...new Uint8Array(input.audio.bytes)] : input.audio.url;
    }
  }

  // Capability-gated scalars: never send a field the model does not advertise.
  const gated: [keyof CanonicalInput, string, string][] = [
    ["negativePrompt", "negative-prompt", "negativePrompt"],
    ["seed", "seed", "seed"],
    ["steps", "steps", "steps"],
    ["guidance", "guidance", "guidance"],
    ["durationSeconds", "duration", "durationSeconds"],
    ["resolution", "resolution", "resolution"],
    ["aspectRatio", "aspect-ratio", "aspectRatio"],
  ];
  for (const [key, capability, canonicalName] of gated) {
    const value = input[key];
    if (value === undefined) continue;
    if (!model.capabilities.includes(capability as never)) continue;
    out[fieldNameFor(model, canonicalName)] = value;
  }

  if (input.width !== undefined && model.parameters.some((p) => p.name === "width")) out.width = input.width;
  if (input.height !== undefined && model.parameters.some((p) => p.name === "height")) out.height = input.height;
  if (input.maxTokens !== undefined && model.capabilities.includes("text-generation")) {
    out[fieldNameFor(model, "maxTokens")] = input.maxTokens;
  }

  // Model-specific extras that already passed parameter validation.
  for (const [name, value] of Object.entries(input.parameters ?? {})) {
    if (value === undefined) continue;
    out[fieldNameFor(model, name)] = value;
  }
  return out;
}

/** Provider field name for a canonical parameter, honouring `mapsTo`. */
export function fieldNameFor(model: ModelDefinition, canonicalName: string): string {
  const param = model.parameters.find((p) => p.name === canonicalName);
  if (param?.mapsTo) return param.mapsTo;
  return CANONICAL_TO_COMMON[canonicalName] ?? canonicalName;
}
