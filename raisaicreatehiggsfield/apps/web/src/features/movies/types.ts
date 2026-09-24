export interface Shot {
  id: string;
  number: number;
  shotType: string | null;
  cameraMovement: string | null;
  description: string;
  durationSeconds: number;
  imageAssetId: string | null;
  videoAssetId: string | null;
  status: "pending" | "image_ready" | "video_ready" | "failed";
  costSen: number;
}

export interface Scene {
  id: string;
  number: number;
  title: string;
  timeOfDay: string | null;
  characters: string[];
  action: string | null;
  dialogue: { character: string; line: string }[];
  durationSeconds: number | null;
  shots: Shot[];
}

export interface Movie {
  id: string;
  projectId: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  idea: string | null;
  status: string;
  targetDurationSeconds: number | null;
  updatedAt: string;
  scenes?: Scene[];
}

export interface TimelineItem {
  id: string;
  asset_id: string | null;
  shot_id: string | null;
  label: string | null;
  start_ms: number;
  duration_ms: number;
  trim_in_ms: number;
  trim_out_ms: number;
  volume: number;
}

export interface TimelineTrack {
  id: string;
  kind: string;
  name: string;
  muted: number;
  items: TimelineItem[];
}

export interface Timeline {
  movieId: string;
  durationMs: number;
  tracks: TimelineTrack[];
}

export const STEPS = [
  { key: "story", label: "Story" },
  { key: "cast", label: "Characters" },
  { key: "storyboard", label: "Storyboard" },
  { key: "shots", label: "Shots" },
  { key: "audio", label: "Audio" },
  { key: "timeline", label: "Timeline" },
  { key: "export", label: "Export" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
