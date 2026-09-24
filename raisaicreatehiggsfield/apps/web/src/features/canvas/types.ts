export interface PortDef {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
}

export interface NodePaletteEntry {
  type: string;
  version: number;
  category: string;
  label: string;
  description: string;
  beginner: boolean;
  inputs: PortDef[];
  outputs: PortDef[];
  /** Studio presets: only models with all of these can serve the node. */
  requiredCapabilities?: string[];
  task?: string;
}

export interface NodeInstance {
  id: string;
  type: string;
  version: number;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  retry?: { count: number; delayMs: number; on: string[] };
  cache?: boolean;
  label?: string;
}

export interface WorkflowEdge {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface WorkflowVariable {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  label?: string;
}

export interface WorkflowDocument {
  version: 1;
  nodes: NodeInstance[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  settings: { maxCostSen?: number; cache: boolean; maxParallel: number };
  meta: { name?: string; description?: string };
}

export interface WorkflowDTO {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  version: number;
  document: WorkflowDocument;
  hasUnsavedChanges: boolean;
  updatedAt: string;
}

export interface ValidationError {
  code: string;
  message: string;
  action?: string;
  nodeId?: string;
  edgeId?: string;
  port?: string;
}

export interface NodeRunView {
  nodeId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "cached";
  attempt: number;
  chargedSen: number;
  durationMs: number | null;
  outputs: Record<string, unknown> | null;
  error: { code: string; message: string; action?: string } | null;
}

export interface RunView {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "paused";
  estimatedCostSen: number;
  chargedSen: number;
  outputs: Record<string, unknown>;
  nodes: NodeRunView[];
  error?: { code: string; message: string; nodeId?: string };
  pauseReason?: string;
}

/**
 * Mirrors the engine's port compatibility table so the editor can refuse an
 * invalid connection before the server has to (§22).
 */
const COMPAT: Record<string, string[]> = {
  string: ["string", "text", "prompt", "any"],
  text: ["text", "string", "prompt", "any"],
  prompt: ["prompt", "text", "string", "any"],
  number: ["number", "any"],
  boolean: ["boolean", "any"],
  json: ["json", "object", "array", "any"],
  object: ["object", "json", "any"],
  array: ["array", "json", "any"],
  image: ["image", "image[]", "any"],
  "image[]": ["image[]", "array", "any"],
  video: ["video", "any"],
  audio: ["audio", "any"],
  file: ["file", "any"],
  model: ["model", "any"],
};

export function isPortCompatible(from: string, to: string): boolean {
  if (to === "any" || from === "any") return true;
  return (COMPAT[from] ?? []).includes(to);
}

export const PORT_COLORS: Record<string, string> = {
  image: "#7c5cff",
  "image[]": "#7c5cff",
  video: "#f0693b",
  audio: "#2fb344",
  text: "#4dabf7",
  string: "#4dabf7",
  prompt: "#4dabf7",
  number: "#f6c343",
  boolean: "#f6c343",
  json: "#adb5bd",
  object: "#adb5bd",
  array: "#adb5bd",
  any: "#868e96",
};

export function portColor(type: string): string {
  return PORT_COLORS[type] ?? "#868e96";
}
