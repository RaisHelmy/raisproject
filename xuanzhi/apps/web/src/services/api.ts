import type { ApiResponse } from "@xuanzhi/shared-types";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly reference?: string, public readonly details?: unknown) { super(message); this.name = "ApiError"; }
}
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const CSRF_HEADER = "XuanZhi";

interface Options { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; form?: FormData; query?: Record<string, string | number | boolean | null | undefined>; signal?: AbortSignal }

export function buildQuery(query?: Options["query"]): string {
  if (!query) return ""; const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString(); return s ? `?${s}` : "";
}

export async function api<T>(path: string, opts: Options = {}): Promise<{ data: T; warnings: string[] }> {
  const headers: Record<string, string> = { "X-Requested-With": CSRF_HEADER, Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}${buildQuery(opts.query)}`, { method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"), headers, credentials: "include", body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined), signal: opts.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("NETWORK", "Could not reach the server. Check your connection and try again.", 0);
  }
  let json: ApiResponse<T> | null = null;
  try { json = (await res.json()) as ApiResponse<T>; } catch { /* non-JSON */ }
  if (!json) throw new ApiError("BAD_RESPONSE", `Unexpected response (${res.status}).`, res.status);
  if (!json.success) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent("xz:unauthorized"));
    throw new ApiError(json.error.code, json.error.message, res.status, json.error.reference, json.error.details);
  }
  return { data: json.data, warnings: json.warnings ?? [] };
}
