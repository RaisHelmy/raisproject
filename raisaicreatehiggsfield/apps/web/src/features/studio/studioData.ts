import { AUDIO_SECTIONS, IMAGE_SECTIONS, VIDEO_SECTIONS, type MenuEntry } from "../../app/header/menuData";

/**
 * Content for the three creation studios, matching the reference studio pages
 * (Video, Image, Audio). Media lives under public/studio; the model pickers
 * reuse the header menu's model lists so both stay in step.
 */

export type StudioKind = "video" | "image" | "audio";

export interface ChipOption {
  label: string;
  icon: ChipIcon;
  /** Choices offered by the chip's dropdown; the first is the default. */
  options: string[];
}

export type ChipIcon = "clock" | "ratio" | "resolution" | "bitrate" | "quality" | "batch";

export interface HowItWorksStep {
  title: string;
  desc: string;
  img?: string;
  video?: string;
}

const A = {
  presetVideo: "/studio/15c7b33206f1.mp4",
  step1: "/studio/832cd9044fe2.webp",
  step2: "/studio/1d3c84f31ace.mp4",
  step3: "/studio/d12e59d5d8d1.mp4",
  ttsLeft: "/studio/d4f7d161f516.mp4",
  ttsRight: "/studio/8612c12cf7a3.mp4",
  academy: ["/studio/1c55f6cdb323.webp", "/studio/5851810f056e.webp", "/studio/0917d2db0917.webp"],
  emptyState: ["/studio/cccd95c12658.webp", "/studio/fae528eacf79.webp", "/studio/067683571bb9.webp", "/studio/ea4f4817d50b.webp"],
};

export const ACADEMY_IMAGES = A.academy;
export const IMAGE_EMPTY_STATE = A.emptyState;

/** The models each studio offers, taken from the header menu's "Models" section. */
function models(sections: typeof VIDEO_SECTIONS): MenuEntry[] {
  return sections.find((s) => s.heading === "Models")?.items ?? [];
}

export const VIDEO_MODELS = models(VIDEO_SECTIONS);
export const IMAGE_MODELS = models(IMAGE_SECTIONS);
export const AUDIO_MODELS = models(AUDIO_SECTIONS);

export interface StudioConfig {
  kind: StudioKind;
  /** Rail tabs; the first one is selected. */
  tabs: string[];
  models: MenuEntry[];
  chips: ChipOption[];
  /** Cost shown on the Generate button, and the struck-through "before" price. */
  price: { now: number; was?: number };
  howItWorks: { title: string; lead: string; steps: HowItWorksStep[] };
}

export const VIDEO_STUDIO: StudioConfig = {
  kind: "video",
  tabs: ["Create Video", "Edit Video", "Motion Control"],
  models: VIDEO_MODELS,
  chips: [
    { label: "5s", icon: "clock", options: ["5s", "8s", "10s", "15s", "30s"] },
    { label: "16:9", icon: "ratio", options: ["16:9", "9:16", "1:1", "4:3", "21:9"] },
    { label: "1080p", icon: "resolution", options: ["1080p", "720p", "4K"] },
  ],
  price: { now: 45, was: 80 },
  howItWorks: {
    title: "Make videos in one click",
    lead: "250+ presets for camera control, framing, and high-quality VFX - or use the general preset for manual control.",
    steps: [
      { title: "Add image", desc: "Upload or generate an image to start your animation", img: A.step1 },
      { title: "Choose preset", desc: "Pick a preset to control your image movement", video: A.step2 },
      { title: "Get video", desc: "Click generate to create your final animated video!", video: A.step3 },
    ],
  },
};

export const AUDIO_STUDIO: StudioConfig = {
  kind: "audio",
  tabs: ["Text to Speech", "Voice Change", "Translate"],
  models: AUDIO_MODELS,
  chips: [],
  price: { now: 12 },
  howItWorks: {
    title: "Turn text into speech",
    lead: "Lifelike speech from any script — ready for your projects",
    steps: [
      { title: "Pick or clone a voice", desc: "Choose a preset, clone your own, or pick a model", video: A.ttsLeft },
      { title: "Write, describe and generate", desc: "Type your script, describe how it sounds, and create", video: A.ttsRight },
    ],
  },
};

export const IMAGE_STUDIO: StudioConfig = {
  kind: "image",
  tabs: ["Create Image", "Edit Image"],
  models: IMAGE_MODELS,
  chips: [
    { label: "Auto", icon: "ratio", options: ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4"] },
    { label: "High", icon: "quality", options: ["High", "Medium", "Low"] },
    { label: "2K", icon: "resolution", options: ["2K", "1K", "4K"] },
    { label: "Auto", icon: "batch", options: ["Auto", "Fast", "Quality"] },
  ],
  price: { now: 18 },
  howItWorks: { title: "", lead: "", steps: [] },
};

/** The preset card at the top of the video rail. */
export const VIDEO_PRESET = { name: "General", model: "Seedance 2.5", video: A.presetVideo };

export const STUDIOS: Record<StudioKind, StudioConfig> = {
  video: VIDEO_STUDIO,
  image: IMAGE_STUDIO,
  audio: AUDIO_STUDIO,
};

/** Headline shown over the image studio's empty state, per model. */
export const IMAGE_EMPTY_TITLE = { lead: "Start creating with", brand: "RaisAI Soul Cinema", sub: "Describe a scene, character, mood, or style — and watch it come to life" };
