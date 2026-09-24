export interface ParameterDef {
  name: string;
  type: "number" | "enum" | "boolean" | "string" | "range";
  label: string;
  help?: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
  advanced: boolean;
  mapsTo?: string;
}

export interface ModelDTO {
  id: string;
  displayName: string;
  description: string;
  category: "image" | "video" | "audio" | "text" | "vision" | "embedding" | "utility";
  task: string;
  capabilities: string[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  parameters: ParameterDef[];
  limits: {
    maxReferenceImages?: number;
    maxPromptChars?: number;
    durations?: number[];
    resolutions?: string[];
    aspectRatios?: string[];
    maxTokens?: number;
  };
  tags: string[];
  docUrl?: string;
  typicalCostSen?: number;
  typicalCostApproximate?: boolean;
}

export interface AssetHandleDTO {
  assetId: string;
  version?: number;
  mime: string;
  name?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface GenerationDTO {
  id: string;
  modelId: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  prompt: string;
  projectId: string;
  estimatedCostSen: number;
  chargedSen: number | null;
  costEstimated: boolean;
  currency: string;
  outputs: Record<string, unknown>;
  error: { code: string; message: string } | null;
  durationMs: number | null;
  createdAt: string;
  workflowRunId: string | null;
}

export function assetUrl(handle: AssetHandleDTO): string {
  return `/api/v1/assets/${handle.assetId}/content${handle.version ? `?version=${handle.version}` : ""}`;
}

export function isAssetHandle(value: unknown): value is AssetHandleDTO {
  return typeof value === "object" && value !== null && "assetId" in value;
}
