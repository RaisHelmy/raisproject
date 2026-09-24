export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(res.status, typeof data?.error === "string" ? data.error : data?.error?.message ?? `HTTP ${res.status}`);
  return data as T;
}

export const money = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : `$${Number(v).toFixed(v !== 0 && Math.abs(v) < 0.01 ? 4 : digits)}`);
export const fmtInt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Number(v).toLocaleString());
export const fmtTime = (epoch: number | null | undefined) => (epoch ? new Date(epoch * 1000).toLocaleString() : "—");

export interface Project { id: string; slug: string; name: string; description: string; created_at: number; month_spend?: number; keys?: Credential[] }
export interface Credential {
  id: string; project_id: string; name: string; key_prefix: string; masked: string; enabled: number; expires_at: number | null; created_at: number; last_used_at: number | null;
  daily_usd: number | null; weekly_usd: number | null; monthly_usd: number | null; on_limit: "block" | "fallback";
  allowed_models: string[]; default_model: string; fallback_model: string | null; requests_per_minute: number | null; preset: string;
  spend: { day: number; week: number; month: number }; requests_month: number;
}
export interface Model { id: string; provider: string; display_name: string; input_usd_per_m: number; output_usd_per_m: number; enabled: number; tags: string; sort: number }
export interface Alias { name: string; description: string; candidates: string }
export interface Overview {
  email: string; timezone: string; windows: { dayStart: number; weekStart: number; monthStart: number; dayKey: string };
  global: { spend: { day: number; week: number; month: number }; budget: { day: number | null; week: number | null; month: number | null } };
  last_cost_sync: number | null; projects: Project[];
}

export interface Preset { id: string; name: string; blurb: string; daily: number | null; weekly: number | null; monthly: number | null; allowed: string[]; default_model: string; fallback: string | null; rpm: number | null; on_limit: "block" | "fallback" }
export const PRESETS: Preset[] = [
  { id: "cheap", name: "Cheap", blurb: "Workers AI only (Qwen / GLM). $0.50/day.", daily: 0.5, weekly: 2.5, monthly: 8, allowed: ["cheap", "fast", "auto"], default_model: "cheap", fallback: "cheap", rpm: 60, on_limit: "block" },
  { id: "coding", name: "Coding", blurb: "Qwen Coder → Claude Sonnet fallback. $2/day.", daily: 2, weekly: 10, monthly: 30, allowed: ["auto/coding", "auto", "cheap", "fast"], default_model: "auto/coding", fallback: "cheap", rpm: 60, on_limit: "fallback" },
  { id: "premium-coding", name: "Premium coding", blurb: "Claude Sonnet first. $5/day.", daily: 5, weekly: 25, monthly: 80, allowed: ["premium", "auto/coding", "anthropic/claude-sonnet-5", "cheap"], default_model: "anthropic/claude-sonnet-5", fallback: "auto/coding", rpm: 60, on_limit: "fallback" },
  { id: "reasoning", name: "Reasoning", blurb: "Strong reasoning model. $3/day.", daily: 3, weekly: 15, monthly: 50, allowed: ["auto/reasoning", "auto", "cheap"], default_model: "auto/reasoning", fallback: "cheap", rpm: 30, on_limit: "fallback" },
  { id: "custom", name: "Unlimited / custom", blurb: "Everything enabled, no budget until you set one.", daily: null, weekly: null, monthly: null, allowed: [], default_model: "auto", fallback: null, rpm: null, on_limit: "block" },
];
