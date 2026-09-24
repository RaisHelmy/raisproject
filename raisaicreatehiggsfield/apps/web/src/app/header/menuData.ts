/**
 * Header navigation data. Sections and entries were extracted from the
 * reference site's dropdown panels (Image, Video, Audio, Plugins) and then
 * pointed at our own routes where a screen exists; everything else lands on
 * the generic placeholder page so every link resolves. UI only, no backend.
 */
export type BadgeColor = "primary" | "secondary" | "seedance";

export interface MenuEntry {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Key into MENU_ICONS. */
  icon: string;
  badge?: { label: string; color: BadgeColor } | null;
}

export interface MenuSection {
  id: string;
  heading: string;
  items: MenuEntry[];
}

export type MenuItem =
  | {
      kind: "link";
      id: string;
      label: string;
      href: string;
      activeOn: string[];
      accent?: boolean;
      external?: boolean;
      badge?: string;
    }
  | {
      kind: "dropdown";
      id: string;
      label: string;
      href: string;
      activeOn: string[];
      sections: MenuSection[];
      alignToTrigger?: boolean;
    }
  | { kind: "separator"; id: string };

export const IMAGE_SECTIONS: MenuSection[] = [
  {
    id: "image-features",
    heading: "Features",
    items: [
      {
        id: "image-create-image",
        title: "Create Image",
        subtitle: "Generate AI images",
        href: "/create/image",
        icon: "image/Create Image",
        badge: null,
      },
      {
        id: "image-cinematic-cameras",
        title: "Cinematic Cameras",
        subtitle: "Image generation with camera controls",
        href: "/generate?mode=image&imageModel=cinematic-v1",
        icon: "image/Cinematic Cameras",
        badge: { label: "TOP", color: "secondary" },
      },
      {
        id: "image-canvas",
        title: "Canvas",
        subtitle: "Visual ideation meets repeatable AI workflows.",
        href: "/canvas",
        icon: "image/Canvas",
        badge: null,
      },
      {
        id: "image-soul-moodboard",
        title: "Soul Moodboard",
        subtitle: "Turn your references into a focused moodboard",
        href: "/moodboard",
        icon: "image/Soul Moodboard",
        badge: null,
      },
      {
        id: "image-soul-id-character",
        title: "Soul ID Character",
        subtitle: "Create unique character",
        href: "/character",
        icon: "image/Soul ID Character",
        badge: null,
      },
      {
        id: "image-ai-influencer",
        title: "AI Influencer",
        subtitle: "Create and manage your AI influencer",
        href: "/ai-influencer-studio",
        icon: "image/AI Influencer",
        badge: null,
      },
      {
        id: "image-photodump",
        title: "Photodump",
        subtitle: "Generate Your Aesthetic",
        href: "/create/image?model=soul-v2&photodump=true",
        icon: "image/Photodump",
        badge: null,
      },
      {
        id: "image-relight",
        title: "Relight",
        subtitle: "Adjust lighting position, color, and brightness",
        href: "/apps/relight",
        icon: "image/Relight",
        badge: null,
      },
      {
        id: "image-inpaint",
        title: "Inpaint",
        subtitle: "Select an area, describe the change",
        href: "/create/studio/ai.inpaint",
        icon: "image/Inpaint",
        badge: null,
      },
      {
        id: "image-image-upscale",
        title: "Image Upscale",
        subtitle: "Enhance image quality",
        href: "/create/studio/ai.upscale",
        icon: "image/Image Upscale",
        badge: null,
      },
      {
        id: "image-face-swap",
        title: "Face Swap",
        subtitle: "Create Realistic Face Swaps",
        href: "/apps/face-swap",
        icon: "image/Face Swap",
        badge: null,
      },
      {
        id: "image-character-swap",
        title: "Character Swap",
        subtitle: "Create Realistic Character Swaps",
        href: "/apps/character-swap",
        icon: "image/Character Swap",
        badge: null,
      },
    ],
  },
  {
    id: "image-models",
    heading: "Models",
    items: [
      {
        id: "image-higgsfield-soul-2-0",
        title: "RaisAI Soul 2.0",
        subtitle: "Next generation ultra-realistic fashion visuals",
        href: "/create/image?model=soul-v2",
        icon: "image/Higgsfield Soul 2.0",
        badge: { label: "TOP", color: "secondary" },
      },
      {
        id: "image-higgsfield-soul-cinema",
        title: "RaisAI Soul Cinema",
        subtitle: "Cinematic Film-Grade Aesthetic",
        href: "/create/image?model=soul-cinematic",
        icon: "image/Higgsfield Soul Cinema",
        badge: null,
      },
      {
        id: "image-gpt-image-2",
        title: "GPT Image 2",
        subtitle: "4K images with near-perfect text rendering",
        href: "/create/image?model=gpt_image_2",
        icon: "image/GPT Image 2",
        badge: { label: "TOP", color: "secondary" },
      },
      {
        id: "image-seedream-5-0-pro",
        title: "Seedream 5.0 Pro",
        subtitle:
          "Logically consistent images with intelligent visual reasoning",
        href: "/create/image?model=seedream_v5_pro",
        icon: "image/Seedream 5.0 Pro",
        badge: null,
      },
      {
        id: "image-nano-banana-2-lite",
        title: "Nano Banana 2 Lite",
        subtitle: "Lightweight image generation at speed",
        href: "/create/image?model=nano-banana-2-lite",
        icon: "image/Nano Banana 2 Lite",
        badge: null,
      },
      {
        id: "image-nano-banana-pro",
        title: "Nano Banana Pro",
        subtitle: "Best 4K image model ever",
        href: "/create/image?model=nano-banana-pro",
        icon: "image/Nano Banana Pro",
        badge: { label: "TOP", color: "secondary" },
      },
      {
        id: "image-recraft-v4-styles",
        title: "Recraft V4 Styles",
        subtitle: "Style it once, every image matches",
        href: "/create/image?model=recraft-v4-styles",
        icon: "image/Recraft V4 Styles",
        badge: { label: "NEW", color: "primary" },
      },
      {
        id: "image-recraft-v4-1",
        title: "Recraft V4.1",
        subtitle: "Photorealistic and expressive image generation",
        href: "/create/image?model=recraft-v4-1",
        icon: "image/Recraft V4.1",
        badge: null,
      },
      {
        id: "image-grok-imagine-2-0",
        title: "Grok Imagine 2.0",
        subtitle: "High-resolution image generation by xAI",
        href: "/create/image?model=grok-image-2-0",
        icon: "image/Grok Imagine 2.0",
        badge: { label: "NEW", color: "primary" },
      },
      {
        id: "image-flux-2",
        title: "FLUX.2",
        subtitle: "Speed-optimized detail",
        href: "/create/image?model=flux_2",
        icon: "image/FLUX.2",
        badge: null,
      },
      {
        id: "image-z-image",
        title: "Z-Image",
        subtitle: "Instant lifelike portraits",
        href: "/create/image?model=z-image",
        icon: "image/Z-Image",
        badge: null,
      },
      {
        id: "image-topaz",
        title: "Topaz",
        subtitle: "High-resolution upscaler",
        href: "/create/studio/ai.upscale",
        icon: "image/Topaz",
        badge: null,
      },
    ],
  },
];

export const VIDEO_SECTIONS: MenuSection[] = [
  {
    id: "video-features",
    heading: "Features",
    items: [
      {
        id: "video-create-video",
        title: "Create Video",
        subtitle: "Generate AI videos",
        href: "/create/video",
        icon: "video/Create Video",
        badge: null,
      },
      {
        id: "video-cinema-studio-4-0",
        title: "Cinema Studio 4.0",
        subtitle: "Cinematic video with AI director",
        href: "/movies",
        icon: "video/Cinema Studio 4.0",
        badge: null,
      },
      {
        id: "video-faceless-studio",
        title: "Faceless Studio",
        subtitle: "Start a faceless channel in one click",
        href: "/faceless-studio",
        icon: "video/Faceless Studio",
        badge: null,
      },
      {
        id: "video-3d-jutsu",
        title: "3D Jutsu",
        subtitle: "Create 3D scenes and turn them into videos",
        href: "/3d-jutsu",
        icon: "video/3D Jutsu",
        badge: { label: "NEW", color: "primary" },
      },
      {
        id: "video-shorts-studio",
        title: "Shorts Studio",
        subtitle: "Turn your footage into ready-made shorts",
        href: "/shorts-studio",
        icon: "video/Shorts Studio",
        badge: null,
      },
      {
        id: "video-higgsfield-explainer",
        title: "RaisAI Explainer",
        subtitle: "Turn any topic into an explainer video",
        href: "/explainer",
        icon: "video/Higgsfield Explainer",
        badge: null,
      },
      {
        id: "video-canvas",
        title: "Canvas",
        subtitle: "Visual ideation meets repeatable AI workflows.",
        href: "/canvas",
        icon: "video/Canvas",
        badge: null,
      },
      {
        id: "video-mixed-media",
        title: "Mixed Media",
        subtitle: "Create mixed media projects",
        href: "/mixed-media",
        icon: "video/Mixed Media",
        badge: null,
      },
      {
        id: "video-edit-video",
        title: "Edit Video",
        subtitle: "Edit scenes, shots, elements",
        href: "/ai/video/edit",
        icon: "video/Edit Video",
        badge: null,
      },
      {
        id: "video-higgsfield-reframe",
        title: "RaisAI Reframe",
        subtitle: "Reframe and resize videos to any aspect ratio",
        href: "/ai/video/reframe",
        icon: "video/Higgsfield Reframe",
        badge: null,
      },
      {
        id: "video-click-to-ad",
        title: "Click to Ad",
        subtitle: "Turn product URLs into video ads",
        href: "/apps/link-to-video-ad",
        icon: "video/Click to Ad",
        badge: null,
      },
      {
        id: "video-change-color-palette",
        title: "Change Color Palette",
        subtitle: "Adjust color palette, tones, and overall mood",
        href: "/apps/video-rehex",
        icon: "video/Change Color Palette",
        badge: null,
      },
      {
        id: "video-relight",
        title: "Relight",
        subtitle: "Adjust lighting position, color, and brightness",
        href: "/apps/video-relight",
        icon: "video/Relight",
        badge: null,
      },
      {
        id: "video-lipsync-studio",
        title: "Lipsync Studio",
        subtitle: "Create Talking Clips",
        href: "/lipsync-studio",
        icon: "video/Lipsync Studio",
        badge: null,
      },
      {
        id: "video-draw-to-video",
        title: "Draw to Video",
        subtitle: "Sketch turns into a cinema",
        href: "/ai/video?video-inpaint=true&generationType=video",
        icon: "video/Draw to Video",
        badge: null,
      },
      {
        id: "video-draw-to-edit",
        title: "Draw to Edit",
        subtitle: "Sketch directly on video frames to guide edits",
        href: "/ai/video?image-inpaint=true",
        icon: "video/Draw to Edit",
        badge: null,
      },
      {
        id: "video-ugc-factory",
        title: "UGC Factory",
        subtitle: "Build UGC video with avatar",
        href: "/lipsync-studio?ugc-studio=true",
        icon: "video/UGC Factory",
        badge: null,
      },
      {
        id: "video-video-upscale",
        title: "Video Upscale",
        subtitle: "Enhance video quality",
        href: "/create/studio/ai.video.upscale",
        icon: "video/Video Upscale",
        badge: null,
      },
    ],
  },
  {
    id: "video-models",
    heading: "Models",
    items: [
      {
        id: "video-seedance-2-5",
        title: "Seedance 2.5",
        subtitle: "Create cinematic videos up to 30 seconds",
        href: "/create/video?model=seedance_2_5",
        icon: "video/Seedance 2.5",
        badge: { label: "TOP", color: "seedance" },
      },
      {
        id: "video-higgsfield-genjutsu",
        title: "RaisAI Genjutsu",
        subtitle: "Transfer motion or swap objects from a reference video",
        href: "/create/video?model=genjutsu",
        icon: "video/Higgsfield Genjutsu",
        badge: { label: "NEW", color: "primary" },
      },
      {
        id: "video-gemini-omni-flash-1-1",
        title: "Gemini Omni Flash 1.1",
        subtitle: "Generate and edit video from any input",
        href: "/create/video?model=gemini-omni-flash-1-1",
        icon: "video/Gemini Omni Flash 1.1",
        badge: null,
      },
      {
        id: "video-gemini-omni-flash",
        title: "Gemini Omni Flash",
        subtitle: "Generate and edit video from any input",
        href: "/create/video?model=gemini-omni",
        icon: "video/Gemini Omni Flash",
        badge: null,
      },
      {
        id: "video-kling-3-0",
        title: "Kling 3.0",
        subtitle: "Cinematic videos with audio",
        href: "/create/video?model=kling3_0",
        icon: "video/Kling 3.0",
        badge: null,
      },
      {
        id: "video-kling-motion-control",
        title: "Kling Motion Control",
        subtitle: "Transfer motion from video to image",
        href: "/create/studio/ai.motion",
        icon: "video/Kling Motion Control",
        badge: null,
      },
      {
        id: "video-flux-3-video",
        title: "FLUX.3 Video",
        subtitle: "Text, image, and video generation with synchronized audio",
        href: "/create/video?model=flux_3_video",
        icon: "video/FLUX.3 Video",
        badge: null,
      },
      {
        id: "video-minimax-h3",
        title: "MiniMax H3",
        subtitle:
          "Create 2K videos from text, keyframes, or multimodal references",
        href: "/create/video?model=minimax_h3",
        icon: "video/MiniMax H3",
        badge: null,
      },
      {
        id: "video-wan-3-0",
        title: "Wan 3.0",
        subtitle:
          "Create videos from text, keyframes, or multimodal references",
        href: "/create/video?model=wan3_0",
        icon: "video/Wan 3.0",
        badge: null,
      },
      {
        id: "video-kling-3-0-omni-edit",
        title: "Kling 3.0 Omni Edit",
        subtitle: "Edit videos with text prompts",
        href: "/ai/video/edit?model=kling-video-reference-o3",
        icon: "video/Kling 3.0 Omni Edit",
        badge: null,
      },
      {
        id: "video-sora-2",
        title: "Sora 2",
        subtitle: "OpenAI's most advanced video model",
        href: "/create/video?model=open_sora_video",
        icon: "video/Sora 2",
        badge: null,
      },
      {
        id: "video-google-veo-3-1",
        title: "Google Veo 3.1",
        subtitle: "Advanced AI video with sound",
        href: "/create/video?model=veo-3-1-preview",
        icon: "video/Google Veo 3.1",
        badge: null,
      },
      {
        id: "video-happyhorse",
        title: "HappyHorse",
        subtitle: "Alibaba's #1 ranked video and audio model",
        href: "/create/video?model=happy-horse",
        icon: "video/HappyHorse",
        badge: null,
      },
      {
        id: "video-grok-imagine-1-5",
        title: "Grok Imagine 1.5",
        subtitle: "Cinematic videos with synchronized audio",
        href: "/create/video?model=grok_video_v15",
        icon: "video/Grok Imagine 1.5",
        badge: null,
      },
      {
        id: "video-minimax-hailuo-2-3",
        title: "Minimax Hailuo 2.3",
        subtitle: "Fastest high-dynamic video",
        href: "/create/video?model=minimax-2.3",
        icon: "video/Minimax Hailuo 2.3",
        badge: null,
      },
      {
        id: "video-higgsfield-dop",
        title: "RaisAI DOP",
        subtitle: "VFX and camera control",
        href: "/create/video?model=standard",
        icon: "video/Higgsfield DOP",
        badge: null,
      },
    ],
  },
];

export const AUDIO_SECTIONS: MenuSection[] = [
  {
    id: "audio-features",
    heading: "Features",
    items: [
      {
        id: "audio-text-to-speech",
        title: "Text to Speech",
        subtitle: "Generate speech from text",
        href: "/create/audio",
        icon: "audio/Text to Speech",
        badge: null,
      },
      {
        id: "audio-voice-change",
        title: "Voice Change",
        subtitle: "Swap voices in any video",
        href: "/create/audio?mode=change-voice",
        icon: "audio/Voice Change",
        badge: null,
      },
      {
        id: "audio-translate",
        title: "Translate",
        subtitle: "Translate and lip-sync your video into a new language",
        href: "/create/audio?mode=translate",
        icon: "audio/Translate",
        badge: null,
      },
    ],
  },
  {
    id: "audio-models",
    heading: "Models",
    items: [
      {
        id: "audio-seed-audio-1-0",
        title: "Seed Audio 1.0",
        subtitle: "Multi-speaker scenes with speech and ambience",
        href: "/create/audio?model=seed_audio",
        icon: "audio/Seed Audio 1.0",
        badge: null,
      },
      {
        id: "audio-eleven-v3",
        title: "Eleven v3",
        subtitle: "Emotion and delivery control via inline tags",
        href: "/create/audio?model=elevenlabs",
        icon: "audio/Eleven v3",
        badge: null,
      },
      {
        id: "audio-qwen-audio-3-0",
        title: "Qwen Audio 3.0",
        subtitle: "Natural speech with voice, style, and emotion control",
        href: "/create/audio?model=qwen_audio",
        icon: "audio/Qwen Audio 3.0",
        badge: null,
      },
      {
        id: "audio-minimax-speech-2-8-hd",
        title: "MiniMax Speech 2.8 HD",
        subtitle: "High-fidelity single-voice narration",
        href: "/create/audio?model=minimax",
        icon: "audio/MiniMax Speech 2.8 HD",
        badge: null,
      },
      {
        id: "audio-seed-speech",
        title: "Seed Speech",
        subtitle: "Multilingual speech across 30+ languages",
        href: "/create/audio?model=seed_speech",
        icon: "audio/Seed Speech",
        badge: null,
      },
    ],
  },
];

export const PLUGINS_SECTIONS: MenuSection[] = [
  {
    id: "plugins-plugins",
    heading: "Plugins",
    items: [
      {
        id: "plugins-adobe-photoshop",
        title: "Adobe Photoshop",
        subtitle: "AI photo tools inside Photoshop",
        href: "/plugins/photoshop",
        icon: "plugins/Adobe Photoshop",
        badge: null,
      },
      {
        id: "plugins-adobe-premiere-pro",
        title: "Adobe Premiere Pro",
        subtitle: "AI video tools inside Premiere Pro",
        href: "/plugins/premiere-pro",
        icon: "plugins/Adobe Premiere Pro",
        badge: null,
      },
      {
        id: "plugins-adobe-after-effects",
        title: "Adobe After Effects",
        subtitle: "AI video tools inside After Effects",
        href: "/plugins/after-effects",
        icon: "plugins/Adobe After Effects",
        badge: null,
      },
      {
        id: "plugins-davinci-resolve",
        title: "DaVinci Resolve",
        subtitle: "AI video tools inside DaVinci Resolve",
        href: "/plugins/davinci",
        icon: "plugins/DaVinci Resolve",
        badge: null,
      },
      {
        id: "plugins-figma",
        title: "Figma",
        subtitle: "AI image & video tools inside Figma",
        href: "/plugins/figma",
        icon: "plugins/Figma",
        badge: null,
      },
      {
        id: "plugins-blender",
        title: "Blender",
        subtitle: "AI image & video tools inside Blender",
        href: "/plugins/blender",
        icon: "plugins/Blender",
        badge: null,
      },
      {
        id: "plugins-minecraft",
        title: "Minecraft",
        subtitle: "AI generation tools inside Minecraft",
        href: "/plugins/minecraft",
        icon: "plugins/Minecraft",
        badge: null,
      },
    ],
  },
];

export const HEADER_ITEMS: MenuItem[] = [
  { kind: "link", id: "Explore", label: "Explore", href: "/", activeOn: ["/"] },
  { kind: "separator", id: "header-sep-1" },
  {
    kind: "dropdown",
    id: "Create Image Tab",
    label: "Image",
    href: "/create/image",
    activeOn: [
      "/create/image",
      "/create/image/**",
      "/create/studio/ai.image.*",
      "/create/studio/ai.inpaint",
      "/create/studio/ai.upscale",
    ],
    sections: IMAGE_SECTIONS,
  },
  {
    kind: "dropdown",
    id: "Create Video Tab",
    label: "Video",
    href: "/create/video",
    activeOn: [
      "/create/video",
      "/create/video/**",
      "/create/studio/ai.video.*",
      "/create/studio/ai.motion",
    ],
    sections: VIDEO_SECTIONS,
  },
  {
    kind: "dropdown",
    id: "Audio Tab",
    label: "Audio",
    href: "/create/audio",
    activeOn: ["/create/audio", "/create/audio/**"],
    sections: AUDIO_SECTIONS,
  },
  {
    kind: "link",
    id: "Layer",
    label: "Edit",
    href: "/layers",
    activeOn: ["/layers", "/layers/**", "/create/studio/ai.image.edit"],
  },
  {
    kind: "link",
    id: "Cinema Studio",
    label: "Cinema Studio 4.0",
    href: "/movies",
    activeOn: ["/movies", "/movies/**"],
  },
  {
    kind: "link",
    id: "Marketing Studio",
    label: "Marketing Studio",
    href: "/marketing-studio",
    activeOn: ["/marketing-studio", "/templates", "/templates/**"],
  },
  {
    kind: "link",
    id: "3D Jutsu",
    label: "3D Jutsu",
    href: "/3d-jutsu",
    activeOn: ["/3d-jutsu", "/3d-jutsu/**"],
    badge: "New",
  },
  { kind: "separator", id: "header-sep-2" },
  {
    kind: "link",
    id: "CLI",
    label: "MCP & CLI",
    href: "/mcp",
    activeOn: ["/mcp", "/developer/mcp", "/developer/api-keys", "/developer/docs"],
  },
  {
    kind: "link",
    id: "Supercomputer",
    label: "Supercomputer",
    href: "/supercomputer",
    activeOn: ["/supercomputer"],
    accent: true,
  },
  {
    kind: "link",
    id: "Academy",
    label: "Academy",
    href: "/academy",
    activeOn: ["/academy", "/academy/**"],
  },
  {
    kind: "link",
    id: "Viral Presets",
    label: "Viral Presets",
    href: "/viral-presets",
    activeOn: ["/viral-presets", "/viral-presets/**"],
  },
  {
    kind: "link",
    id: "Community",
    label: "Community",
    href: "/community",
    activeOn: ["/community", "/community/**"],
  },
  {
    kind: "link",
    id: "Contests",
    label: "Contests",
    href: "/contests",
    activeOn: ["/contests", "/contests/**"],
  },
  {
    kind: "dropdown",
    id: "Plugins",
    label: "Plugins",
    href: "/plugins/after-effects",
    activeOn: ["/plugins", "/plugins/**"],
    sections: PLUGINS_SECTIONS,
    alignToTrigger: true,
  },
  {
    kind: "link",
    id: "Canvas",
    label: "Canvas",
    href: "/canvas",
    activeOn: ["/canvas", "/canvas/**"],
  },
  {
    kind: "link",
    id: "Originals",
    label: "Originals",
    href: "/original-series",
    activeOn: ["/original-series", "/original-series/**"],
  },
];

/** Every dropdown entry, flattened; the placeholder page uses it to title unknown routes. */
export const ALL_ENTRIES: MenuEntry[] = HEADER_ITEMS.flatMap((i) =>
  i.kind === "dropdown" ? i.sections.flatMap((s) => s.items) : [],
);

/**
 * Glob-ish path match used for the active state: exact, `/**` for any
 * descendant, `.*` for a suffix wildcard on one segment.
 */
export function matchesPath(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  if (pattern.endsWith(".*")) return pathname.startsWith(pattern.slice(0, -1));
  return pathname === pattern;
}
