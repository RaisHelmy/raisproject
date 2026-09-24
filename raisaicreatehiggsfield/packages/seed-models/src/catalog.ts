import type { SeedModel } from "./types";

const PRICING_PAGE = "https://developers.cloudflare.com/workers-ai/platform/pricing/";
const VERIFIED = "2026-09-05";

/**
 * Curated starting catalog (task 0.5.3).
 *
 * Rule applied here: a model is only `enabled` when BOTH its input schema and
 * its provider rate are published and verified. Anything missing either one is
 * seeded as `discovered`, so an admin configures and test-runs it before a
 * customer can spend money on it (CLAUDE.md §125, §154).
 *
 * Capabilities are transcribed from each model's documented schema, not
 * assumed. Note that flux-1-schnell has no negative prompt and no width/height
 * controls while lucid-origin does: this is exactly why the UI reads
 * capabilities instead of branching on model ids (§155).
 */
export const SEED_MODELS: SeedModel[] = [
  {
    definition: {
      id: "@cf/black-forest-labs/flux-1-schnell",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "FLUX.1 Schnell",
      description: "Very fast image generation. Great default for drafts and iteration.",
      category: "image",
      task: "text-to-image",
      capabilities: ["text-to-image", "seed", "steps"],
      inputs: { prompt: "prompt" },
      outputs: { image: "image" },
      parameters: [
        { name: "steps", type: "range", label: "Steps", help: "More steps can improve quality and take longer.", default: 4, min: 1, max: 8, step: 1, advanced: true },
        { name: "seed", type: "number", label: "Seed", help: "Reuse a seed to get a repeatable result.", min: 0, advanced: true },
      ],
      limits: { maxPromptChars: 2048 },
      status: "enabled",
      tags: ["recommended", "fast", "cheap"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/",
      version: "1",
      sortOrder: 10,
    },
    pricing: {
      unit: "tile_step",
      providerUsd: { per512Tile: 0.0000528, perStep: 0.0001056 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "@cf/leonardo/lucid-origin",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "Lucid Origin",
      description: "Higher quality image generation with size and prompt-adherence control.",
      category: "image",
      task: "text-to-image",
      capabilities: ["text-to-image", "seed", "steps", "guidance", "resolution", "aspect-ratio"],
      inputs: { prompt: "prompt" },
      outputs: { image: "image" },
      parameters: [
        { name: "width", type: "number", label: "Width", default: 1120, min: 256, max: 2500, step: 8, advanced: true },
        { name: "height", type: "number", label: "Height", default: 1120, min: 256, max: 2500, step: 8, advanced: true },
        { name: "guidance", type: "range", label: "Prompt adherence", help: "Higher values follow the prompt more literally.", default: 4.5, min: 0, max: 10, step: 0.1, advanced: true },
        { name: "steps", type: "range", label: "Steps", default: 20, min: 1, max: 40, step: 1, advanced: true, mapsTo: "num_steps" },
        { name: "seed", type: "number", label: "Seed", min: 0, advanced: true },
      ],
      limits: {
        aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        resolutions: ["1120x1120", "1280x720", "720x1280", "1024x768", "768x1024"],
      },
      status: "enabled",
      tags: ["quality", "cinematic"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/lucid-origin/",
      version: "1",
      sortOrder: 20,
    },
    pricing: {
      unit: "tile_step",
      providerUsd: { per512Tile: 0.006996, perStep: 0.000132 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "Llama 3.3 70B",
      description: "Strong general text model for scripts, ideas and structured output.",
      category: "text",
      task: "text-generation",
      capabilities: ["text-generation", "tool-calling", "json-mode", "streaming"],
      inputs: { prompt: "prompt" },
      outputs: { text: "text" },
      parameters: [
        { name: "maxTokens", type: "number", label: "Maximum length", default: 1024, min: 1, max: 8192, step: 1, advanced: true, mapsTo: "max_tokens" },
        { name: "temperature", type: "range", label: "Creativity", default: 0.7, min: 0, max: 2, step: 0.1, advanced: true },
      ],
      limits: { maxTokens: 8192 },
      status: "enabled",
      tags: ["recommended", "quality"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/",
      version: "1",
      sortOrder: 30,
    },
    pricing: {
      unit: "tokens",
      providerUsd: { perMInputTokens: 0.293, perMOutputTokens: 2.253 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "@cf/meta/llama-3.2-11b-vision-instruct",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "Llama 3.2 11B Vision",
      description: "Reads images and answers questions about them. Cheap for text too.",
      category: "vision",
      task: "image-to-text",
      capabilities: ["text-generation", "vision", "image-input", "streaming"],
      inputs: { prompt: "prompt", image: "image" },
      outputs: { text: "text" },
      parameters: [
        { name: "maxTokens", type: "number", label: "Maximum length", default: 512, min: 1, max: 4096, step: 1, advanced: true, mapsTo: "max_tokens" },
        { name: "temperature", type: "range", label: "Creativity", default: 0.6, min: 0, max: 2, step: 0.1, advanced: true },
      ],
      limits: { maxReferenceImages: 1 },
      status: "enabled",
      tags: ["cheap", "fast"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/",
      version: "1",
      sortOrder: 40,
    },
    pricing: {
      unit: "tokens",
      providerUsd: { perMInputTokens: 0.049, perMOutputTokens: 0.676 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "@cf/myshell-ai/melotts",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "MeloTTS",
      description: "Turns text into spoken audio.",
      category: "audio",
      task: "text-to-speech",
      capabilities: ["text-to-speech", "audio-output"],
      inputs: { text: "text" },
      outputs: { audio: "audio" },
      parameters: [
        {
          name: "lang",
          type: "enum",
          label: "Language",
          default: "en",
          options: [
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "zh", label: "Chinese" },
            { value: "jp", label: "Japanese" },
            { value: "kr", label: "Korean" },
          ],
          advanced: false,
        },
      ],
      limits: {},
      status: "enabled",
      tags: ["recommended", "cheap"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/melotts/",
      version: "1",
      sortOrder: 50,
    },
    pricing: {
      unit: "audio_minute",
      providerUsd: { perAudioMinute: 0.0002 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "@cf/openai/whisper-large-v3-turbo",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "Whisper Large v3 Turbo",
      description: "Transcribes speech to text, with timings for subtitles.",
      category: "audio",
      task: "speech-to-text",
      capabilities: ["speech-to-text"],
      inputs: { audio: "audio" },
      outputs: { text: "text", json: "json" },
      parameters: [
        {
          name: "task",
          type: "enum",
          label: "Mode",
          default: "transcribe",
          options: [
            { value: "transcribe", label: "Transcribe" },
            { value: "translate", label: "Translate to English" },
          ],
          advanced: false,
        },
        { name: "language", type: "string", label: "Language", help: "Leave blank to detect automatically.", advanced: true },
        { name: "vad_filter", type: "boolean", label: "Skip silence", default: false, advanced: true },
      ],
      limits: {},
      status: "enabled",
      tags: ["recommended"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/",
      version: "1",
      sortOrder: 60,
    },
    pricing: {
      unit: "audio_minute",
      providerUsd: { perAudioMinute: 0.0005 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
  },
  {
    definition: {
      id: "vidu/q3-turbo",
      provider: "cloudflare",
      hosting: "third-party",
      displayName: "Vidu Q3 Turbo",
      description: "Generates video from a prompt, a start image, or start and end frames.",
      category: "video",
      task: "text-to-video",
      capabilities: [
        "text-to-video", "image-to-video", "start-end-frame", "image-input",
        "duration", "resolution", "aspect-ratio", "audio-output", "async-job",
      ],
      inputs: { prompt: "prompt", start_image: "image", end_image: "image" },
      outputs: { video: "video" },
      parameters: [
        { name: "duration", type: "number", label: "Duration (seconds)", default: 5, min: 1, max: 16, step: 1, advanced: false },
        {
          name: "resolution", type: "enum", label: "Resolution", default: "720p", advanced: false,
          options: [
            { value: "540p", label: "540p" },
            { value: "720p", label: "720p" },
            { value: "1080p", label: "1080p" },
          ],
        },
        {
          name: "aspectRatio", type: "enum", label: "Aspect ratio", default: "16:9", advanced: false, mapsTo: "aspect_ratio",
          options: [
            { value: "16:9", label: "16:9" },
            { value: "9:16", label: "9:16" },
            { value: "4:3", label: "4:3" },
            { value: "3:4", label: "3:4" },
            { value: "1:1", label: "1:1" },
          ],
        },
        { name: "audio", type: "boolean", label: "Generate audio", default: true, advanced: true },
      ],
      limits: {
        maxPromptChars: 5000,
        maxReferenceImages: 2,
        durations: [1, 2, 3, 4, 5, 6, 8, 10, 12, 16],
        resolutions: ["540p", "720p", "1080p"],
        aspectRatios: ["16:9", "9:16", "4:3", "3:4", "1:1"],
      },
      status: "discovered",
      tags: ["cinematic", "experimental"],
      docUrl: "https://developers.cloudflare.com/ai/models/vidu/q3-turbo/",
      version: "1",
      sortOrder: 70,
    },
    notEnabledReason:
      "Schema verified, but Cloudflare publishes this model's rate only in the dashboard. Set provider pricing in admin and run a test generation before enabling.",
  },
  {
    definition: {
      id: "@cf/bytedance/stable-diffusion-xl-lightning",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "SDXL Lightning",
      description: "Fast image generation with negative prompts, image-to-image and inpainting.",
      category: "image",
      task: "text-to-image",
      capabilities: [
        "text-to-image", "image-to-image", "inpainting", "image-input",
        "negative-prompt", "seed", "steps", "guidance", "resolution",
      ],
      inputs: { prompt: "prompt", image: "image", mask: "image" },
      outputs: { image: "image" },
      parameters: [
        { name: "negativePrompt", type: "string", label: "Negative prompt", help: "What to keep out of the image.", advanced: false, mapsTo: "negative_prompt" },
        { name: "width", type: "number", label: "Width", default: 1024, min: 256, max: 2048, step: 8, advanced: true },
        { name: "height", type: "number", label: "Height", default: 1024, min: 256, max: 2048, step: 8, advanced: true },
        { name: "steps", type: "range", label: "Steps", default: 20, min: 1, max: 20, step: 1, advanced: true, mapsTo: "num_steps" },
        { name: "guidance", type: "range", label: "Prompt adherence", default: 7.5, min: 0, max: 20, step: 0.5, advanced: true },
        { name: "strength", type: "range", label: "Transformation strength", help: "How far to move from the reference image.", default: 1, min: 0, max: 1, step: 0.05, advanced: true },
        { name: "seed", type: "number", label: "Seed", advanced: true },
      ],
      limits: { maxReferenceImages: 1 },
      status: "discovered",
      tags: ["fast"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/stable-diffusion-xl-lightning/",
      version: "1",
      sortOrder: 80,
    },
    notEnabledReason: "Cloudflare publishes no unit rate for this model. Set provider pricing in admin before enabling.",
  },
  {
    definition: {
      id: "@cf/black-forest-labs/flux-2-klein-9b",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "FLUX.2 Klein 9B",
      description: "Unified image generation and editing.",
      category: "image",
      task: "text-to-image",
      capabilities: ["text-to-image", "image-to-image", "image-input"],
      inputs: { prompt: "prompt", image: "image[]" },
      outputs: { image: "image" },
      parameters: [],
      limits: {},
      status: "discovered",
      tags: ["quality", "experimental"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/flux-2-klein-9b/",
      version: "1",
      sortOrder: 90,
    },
    pricing: {
      unit: "megapixel_tiered",
      providerUsd: { firstMegapixel: 0.015, perAdditionalMegapixel: 0.002, perInputImageMegapixel: 0.002 },
      source: PRICING_PAGE,
      verifiedOn: VERIFIED,
    },
    notEnabledReason:
      "Rate is published but the input schema is documented only as a multipart object. Confirm parameter names against a live call before enabling.",
  },

  // ---------------------------------------------------------------------
  // Studio capabilities (inpaint, upscale, video upscale, motion, multi-ref
  // edit). Schemas transcribed from each model's Cloudflare doc page on
  // 2026-09-07. Third-party rates are published only in the dashboard, so
  // those stay `discovered` until an admin enters the rate and test-runs.
  // ---------------------------------------------------------------------
  {
    definition: {
      id: "@cf/runwayml/stable-diffusion-v1-5-inpainting",
      provider: "cloudflare",
      hosting: "workers-ai",
      displayName: "Stable Diffusion 1.5 Inpainting",
      description: "Repaints the masked region of an image from a prompt (white = repaint, black = keep). Also works as plain image-to-image.",
      category: "image",
      task: "inpainting",
      capabilities: [
        "text-to-image", "image-to-image", "inpainting", "image-input", "mask-input",
        "negative-prompt", "seed", "steps", "guidance", "resolution",
      ],
      inputs: { prompt: "prompt", image: "image", mask: "image" },
      outputs: { image: "image" },
      parameters: [
        { name: "negativePrompt", type: "string", label: "Negative prompt", help: "What to keep out of the result.", advanced: false, mapsTo: "negative_prompt" },
        { name: "strength", type: "range", label: "Transformation strength", help: "Lower keeps more of the original inside the mask.", default: 1, min: 0, max: 1, step: 0.05, advanced: false },
        { name: "width", type: "number", label: "Width", default: 512, min: 256, max: 2048, step: 8, advanced: true },
        { name: "height", type: "number", label: "Height", default: 512, min: 256, max: 2048, step: 8, advanced: true },
        { name: "steps", type: "range", label: "Steps", default: 20, min: 1, max: 20, step: 1, advanced: true, mapsTo: "num_steps" },
        { name: "guidance", type: "range", label: "Prompt adherence", default: 7.5, min: 0, max: 20, step: 0.5, advanced: true },
        { name: "seed", type: "number", label: "Seed", advanced: true },
      ],
      limits: { maxReferenceImages: 1 },
      status: "enabled",
      tags: ["experimental"],
      docUrl: "https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/",
      version: "1",
      sortOrder: 100,
    },
    // Cloudflare lists this beta model at $0.00 per step; the platform's
    // minimum charge still applies, and an admin can set a rate any time.
    pricing: {
      unit: "tile_step",
      providerUsd: { per512Tile: 0, perStep: 0 },
      source: "https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/",
      verifiedOn: "2026-09-07",
    },
  },
  {
    definition: {
      id: "pruna/p-image-upscale",
      provider: "cloudflare",
      hosting: "third-party",
      displayName: "P-Image Upscale (Pruna)",
      description: "Upscales an image to a target size from 1 to 128 megapixels, with optional detail enhancement.",
      category: "image",
      task: "upscale",
      capabilities: ["upscale", "image-to-image", "image-input"],
      inputs: { image: "image" },
      outputs: { image: "image" },
      parameters: [
        { name: "target", type: "number", label: "Target size (megapixels)", help: "1 to 128. 4 MP is roughly 2K.", default: 4, min: 1, max: 128, step: 1, advanced: false, mapsTo: "target" },
        { name: "enhance_details", type: "boolean", label: "Enhance details", help: "Adds realism and sharpness; may invent fine texture.", default: false, advanced: false },
      ],
      limits: { maxReferenceImages: 1 },
      status: "discovered",
      tags: ["quality"],
      docUrl: "https://developers.cloudflare.com/ai/models/pruna/p-image-upscale/",
      version: "1",
      sortOrder: 110,
    },
    notEnabledReason:
      "Schema verified, but Cloudflare publishes this model's rate only in the dashboard. Set provider pricing in admin and run a test generation before enabling.",
  },
  {
    definition: {
      id: "black-forest-labs/flux-video-upscale",
      provider: "cloudflare",
      hosting: "third-party",
      displayName: "FLUX Video Upscale",
      description: "Upscales a clip up to 20 seconds / 50 MB by 1.5× to 3×, keeping its audio. Precise mode stays faithful; creative mode adds detail.",
      category: "video",
      task: "video-to-video",
      capabilities: ["video-to-video", "upscale", "video-input", "async-job"],
      inputs: { input_video: "video" },
      outputs: { video: "video" },
      parameters: [
        { name: "upscale_factor", type: "range", label: "Upscale factor", default: 2, min: 1.5, max: 3, step: 0.5, advanced: false },
        {
          name: "creativity", type: "enum", label: "Mode", default: 0, advanced: false,
          options: [{ value: 0, label: "Precise (faithful)" }, { value: 1, label: "Creative (more detail)" }],
        },
        { name: "prompt", type: "string", label: "Description", help: "Optional. Guides detail in creative mode.", advanced: true },
        { name: "safety_tolerance", type: "range", label: "Safety tolerance", help: "0 is strictest, 4 is least strict.", default: 2, min: 0, max: 4, step: 1, advanced: true },
      ],
      limits: {},
      status: "discovered",
      tags: ["quality"],
      docUrl: "https://developers.cloudflare.com/ai/models/black-forest-labs/flux-video-upscale/",
      version: "1",
      sortOrder: 120,
    },
    notEnabledReason:
      "Schema verified, but Cloudflare publishes this model's rate only in the dashboard. Set provider pricing in admin and run a test generation before enabling.",
  },
  {
    definition: {
      id: "bytedance/seedance-2.0-mini",
      provider: "cloudflare",
      hosting: "third-party",
      displayName: "Seedance 2.0 Mini",
      description: "Fast, low-cost video from a prompt, a start image, a reference clip for motion, and optional reference audio.",
      category: "video",
      task: "text-to-video",
      capabilities: [
        "text-to-video", "image-to-video", "image-input", "reference-video", "video-input",
        "duration", "resolution", "aspect-ratio", "seed", "audio-output", "async-job",
      ],
      inputs: { prompt: "prompt", image: "image", reference_video: "video", reference_audio: "audio" },
      outputs: { video: "video" },
      parameters: [
        { name: "duration", type: "number", label: "Duration (seconds)", default: 5, min: 4, max: 12, step: 1, advanced: false },
        { name: "resolution", type: "enum", label: "Resolution", default: "720p", advanced: false, options: [{ value: "480p", label: "480p" }, { value: "720p", label: "720p" }] },
        {
          name: "aspectRatio", type: "enum", label: "Aspect ratio", default: "16:9", advanced: false, mapsTo: "aspect_ratio",
          options: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"].map((v) => ({ value: v, label: v })),
        },
        { name: "generate_audio", type: "boolean", label: "Generate audio", default: false, advanced: false },
        { name: "camera_fixed", type: "boolean", label: "Fixed camera", default: false, advanced: true },
        { name: "seed", type: "number", label: "Seed", advanced: true },
        { name: "fps", type: "number", label: "Frames per second", default: 24, min: 24, max: 24, advanced: true },
        { name: "watermark", type: "boolean", label: "Watermark", default: false, advanced: true },
        { name: "use_virtual_avatar", type: "boolean", label: "Virtual avatar", help: "Routes image inputs through the trusted avatar library.", default: false, advanced: true },
      ],
      limits: { maxPromptChars: 2000, maxReferenceImages: 1 },
      status: "discovered",
      tags: ["fast", "cheap", "cinematic"],
      docUrl: "https://developers.cloudflare.com/ai/models/bytedance/seedance-2.0-mini/",
      version: "1",
      sortOrder: 130,
    },
    notEnabledReason:
      "Schema verified, but Cloudflare publishes this model's rate only in the dashboard. Set provider pricing in admin and run a test generation before enabling.",
  },
  {
    definition: {
      id: "openai/gpt-image-1.5",
      provider: "cloudflare",
      hosting: "third-party",
      displayName: "GPT Image 1.5",
      description: "Creates and edits images from a prompt, with up to 16 reference images for consistent characters and products.",
      category: "image",
      task: "text-to-image",
      capabilities: ["text-to-image", "image-to-image", "image-input", "multiple-images", "resolution"],
      inputs: { prompt: "prompt", images: "image[]" },
      outputs: { image: "image" },
      parameters: [
        {
          name: "quality", type: "enum", label: "Quality", default: "auto", advanced: false,
          options: [{ value: "auto", label: "Auto" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }],
        },
        {
          name: "resolution", type: "enum", label: "Size", default: "1024x1024", advanced: false, mapsTo: "size",
          options: ["1024x1024", "1792x1024", "1024x1792", "512x512", "256x256"].map((v) => ({ value: v, label: v })),
        },
        { name: "style", type: "enum", label: "Style", default: "vivid", advanced: true, options: [{ value: "vivid", label: "Vivid" }, { value: "natural", label: "Natural" }] },
      ],
      limits: { maxReferenceImages: 16 },
      status: "discovered",
      tags: ["quality"],
      docUrl: "https://developers.cloudflare.com/ai/models/openai/gpt-image-1.5/",
      version: "1",
      sortOrder: 140,
    },
    notEnabledReason:
      "Schema verified, but Cloudflare publishes this model's rate only in the dashboard. Set provider pricing in admin and run a test generation before enabling.",
  },
];

export const ENABLED_SEED_MODELS = SEED_MODELS.filter((m) => m.definition.status === "enabled");
