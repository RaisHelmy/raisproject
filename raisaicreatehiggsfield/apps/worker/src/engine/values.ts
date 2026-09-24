/**
 * Values that travel along edges. Everything is JSON-serializable so a node
 * result can be stored in node_runs.output_json and resumed after a failure.
 */

/** A stored asset, referenced rather than inlined so bytes never enter D1. */
export interface AssetHandle {
  assetId: string;
  version?: number;
  mime: string;
  width?: number;
  height?: number;
  durationMs?: number;
  name?: string;
}

export type PortValue =
  | string
  | number
  | boolean
  | null
  | AssetHandle
  | AssetHandle[]
  | Record<string, unknown>
  | unknown[];

export function isAssetHandle(value: unknown): value is AssetHandle {
  return typeof value === "object" && value !== null && "assetId" in value && "mime" in value;
}

export function asAssetHandles(value: PortValue | undefined): AssetHandle[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return (value as unknown[]).filter(isAssetHandle);
  return isAssetHandle(value) ? [value] : [];
}

export function asText(value: PortValue | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}
