export interface Model {
  id: string;
  displayName: string;
  description: string;
  category: string;
  task: string;
  capabilities: string[];
  parameters: { name: string; type: string; label: string; default?: unknown; advanced: boolean }[];
  limits: Record<string, unknown>;
  tags: string[];
  typicalCostSen?: number;
}

export interface CostEstimate {
  estimatedSen: number;
  approximate: boolean;
  currency: string;
}

export interface AssetRef {
  assetId: string;
  mime: string;
  version?: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface Generation {
  id: string;
  modelId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  prompt: string;
  estimatedCostSen: number;
  chargedSen: number | null;
  costEstimated: boolean;
  currency: string;
  outputs: Record<string, unknown>;
  error: { code: string; message: string } | null;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "paused";
  estimatedCostSen: number;
  chargedSen: number;
  outputs: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface Balance {
  availableSen: number;
  reservedSen: number;
  currency: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  version: number;
  estimatedCostSen: number | null;
  variables?: { name: string; type: string; required: boolean; label?: string }[];
}

export function isAssetRef(value: unknown): value is AssetRef {
  return typeof value === "object" && value !== null && "assetId" in value && "mime" in value;
}
