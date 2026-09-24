import type { ModelDefinition } from "@raisai/shared";
import type { CanonicalInput, ValidationIssue, ValidationResult } from "./types";

/**
 * Input validation shared by every provider implementation, so the fake used in
 * tests rejects exactly what the real one rejects. Rules come from the model's
 * declared schema, never from its id.
 */
export function validateCanonicalInput(model: ModelDefinition, input: CanonicalInput): ValidationResult {
  const issues: ValidationIssue[] = [];

  const needsPrompt = model.inputs.prompt !== undefined || model.inputs.text !== undefined;
  const hasPrompt = Boolean(input.prompt || input.text || input.messages?.length);
  if (needsPrompt && !hasPrompt) {
    issues.push({ field: "prompt", message: "This model needs a prompt.", action: "Describe what you want to create." });
  }

  const promptLength = (input.prompt ?? input.text ?? "").length;
  const maxChars = model.limits.maxPromptChars;
  if (maxChars !== undefined && promptLength > maxChars) {
    issues.push({
      field: "prompt",
      message: `${model.displayName} accepts at most ${maxChars} characters. Yours is ${promptLength}.`,
      action: "Shorten the prompt.",
    });
  }

  const imageCount = input.images?.length ?? 0;
  if (imageCount > 0 && !model.capabilities.includes("image-input")) {
    issues.push({
      field: "images",
      message: `${model.displayName} does not support image references.`,
      action: "Choose a model that supports image input.",
    });
  }
  const maxRefs = model.limits.maxReferenceImages;
  if (maxRefs !== undefined && imageCount > maxRefs) {
    issues.push({
      field: "images",
      message: `${model.displayName} accepts at most ${maxRefs} reference image${maxRefs === 1 ? "" : "s"}.`,
      action: "Remove the extra images.",
    });
  }
  if (imageCount > 1 && !model.capabilities.includes("multiple-images") && !model.capabilities.includes("start-end-frame")) {
    issues.push({
      field: "images",
      message: `${model.displayName} uses one reference image at a time.`,
      action: "Keep a single reference image.",
    });
  }

  if (input.mask && !model.capabilities.includes("mask-input")) {
    issues.push({
      field: "mask",
      message: `${model.displayName} does not take a mask.`,
      action: "Choose an inpainting model, or disconnect the mask.",
    });
  }
  if (input.mask && (input.images?.length ?? 0) === 0) {
    issues.push({
      field: "images",
      message: "A mask needs an image to paint into.",
      action: "Connect the image you want to edit.",
    });
  }

  const wantsVideo = Object.values(model.inputs).includes("video");
  if (input.video && !model.capabilities.includes("video-input")) {
    issues.push({
      field: "video",
      message: `${model.displayName} does not take a video.`,
      action: "Choose a video-to-video or motion model.",
    });
  }
  if (wantsVideo && !input.video && !model.capabilities.includes("text-to-video")) {
    // A pure video-to-video model (an upscaler, say) has nothing to work on
    // without a clip; text-to-video models that also accept a reference clip
    // are fine without one.
    issues.push({ field: "video", message: `${model.displayName} needs a video.`, action: "Connect a video." });
  }

  // Numeric ranges and enum options come from the model's own parameter list.
  for (const param of model.parameters) {
    const value = (input.parameters ?? {})[param.name] ?? (input as Record<string, unknown>)[param.name];
    if (value === undefined) continue;
    if ((param.type === "number" || param.type === "range") && typeof value === "number") {
      if (param.min !== undefined && value < param.min) {
        issues.push({ field: param.name, message: `${param.label} must be at least ${param.min}.` });
      }
      if (param.max !== undefined && value > param.max) {
        issues.push({ field: param.name, message: `${param.label} must be at most ${param.max}.` });
      }
    }
    if (param.type === "enum" && param.options && !param.options.some((o) => o.value === value)) {
      issues.push({
        field: param.name,
        message: `${param.label} must be one of: ${param.options.map((o) => o.label).join(", ")}.`,
      });
    }
  }

  const durations = model.limits.durations;
  if (input.durationSeconds !== undefined && durations?.length && !durations.includes(input.durationSeconds)) {
    issues.push({
      field: "durationSeconds",
      message: `${model.displayName} supports these durations: ${durations.join(", ")} seconds.`,
      action: "Pick a supported duration.",
    });
  }

  return { ok: issues.length === 0, issues };
}
