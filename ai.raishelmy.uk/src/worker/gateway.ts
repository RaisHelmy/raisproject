import type { Env } from "./env";
import { ACCOUNT_ID } from "./env";
import type { KeyRow, ModelRow, AliasRow } from "./db";
import { keySpend, globalSpend, requestsLastMinute, getSettings, loadCatalog } from "./db";
import { newId, now, windows, dayKeyFor, openaiError } from "./util";

const NEURON_USD = 0.011 / 1000;
const CHAT_PATH = "chat/completions";

export interface Resolved {
  requested: string;
  candidates: ModelRow[];
  forcedFallback: boolean;
}

function parseList(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Turns a requested model (alias or provider/model) into an ordered list of enabled models the key may use. */
export function resolveModel(requested: string, key: KeyRow, models: ModelRow[], aliases: AliasRow[]): { ok: true; candidates: ModelRow[] } | { ok: false; error: string; status: number } {
  const byId = new Map(models.filter((m) => m.enabled).map((m) => [m.id, m]));
  const allowed = parseList(key.allowed_models);
  const isAllowed = (id: string) => allowed.length === 0 || allowed.includes(id);

  const alias = aliases.find((a) => a.name === requested);
  let ids: string[];
  if (alias) {
    // An alias the key is allowed to use unlocks all its candidates; otherwise filter to allowed models.
    ids = parseList(alias.candidates);
    if (!isAllowed(alias.name)) ids = ids.filter(isAllowed);
    if (ids.length === 0) return { ok: false, error: `This credential is not allowed to use model alias '${requested}'.`, status: 403 };
  } else {
    if (!byId.has(requested)) return { ok: false, error: `Model '${requested}' does not exist or is disabled. GET /v1/models lists what this credential can use.`, status: 404 };
    if (!isAllowed(requested)) return { ok: false, error: `This credential is not allowed to use model '${requested}'.`, status: 403 };
    ids = [requested];
  }
  const candidates = ids.map((id) => byId.get(id)).filter((m): m is ModelRow => !!m);
  if (candidates.length === 0) return { ok: false, error: `No enabled model behind '${requested}'.`, status: 503 };
  return { ok: true, candidates };
}

function providerEnvName(provider: string): string {
  return provider.toUpperCase().replace(/-/g, "_") + "_API_KEY";
}

/** Upstream auth for a provider: provider-specific key if set, else the gateway token (BYOK / Workers AI). */
function upstreamAuth(env: Env, provider: string): { headers: Record<string, string> } | null {
  const headers: Record<string, string> = {};
  if (env.AI_GATEWAY_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
  const specific = env[providerEnvName(provider)];
  if (typeof specific === "string" && specific) {
    headers["Authorization"] = `Bearer ${specific}`;
  } else if (provider === "workers-ai" && env.CLOUDFLARE_API_TOKEN) {
    headers["Authorization"] = `Bearer ${env.CLOUDFLARE_API_TOKEN}`;
  } else if (!env.AI_GATEWAY_TOKEN) {
    return null; // nothing that could authenticate this provider
  }
  return { headers };
}

export function estimateCost(model: ModelRow, usage: Usage): number {
  if (model.provider === "workers-ai" && typeof usage.neurons === "number" && usage.neurons > 0) return usage.neurons * NEURON_USD;
  if (typeof usage.cost === "number" && usage.cost > 0) return usage.cost; // e.g. OpenRouter usage.cost
  return (usage.prompt_tokens / 1e6) * model.input_usd_per_m + (usage.completion_tokens / 1e6) * model.output_usd_per_m;
}

export interface Usage { prompt_tokens: number; completion_tokens: number; neurons?: number; cost?: number }

function readUsage(u: any): Usage {
  return {
    prompt_tokens: Number(u?.prompt_tokens ?? u?.input_tokens ?? 0) || 0,
    completion_tokens: Number(u?.completion_tokens ?? u?.output_tokens ?? 0) || 0,
    neurons: typeof u?.neurons === "number" ? u.neurons : undefined,
    cost: typeof u?.cost === "number" ? u.cost : undefined,
  };
}

export interface UsageRecord {
  id: string; api_key_id: string; project_id: string; requested_model: string; model: string; provider: string;
  input_tokens: number; output_tokens: number; cost_usd: number; latency_ms: number; status: number; error: string | null; streamed: number;
}

export async function recordUsage(env: Env, r: UsageRecord): Promise<void> {
  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO usage(id, api_key_id, project_id, requested_model, model, provider, input_tokens, output_tokens, cost_usd, latency_ms, status, error, streamed, created_at, day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(r.id, r.api_key_id, r.project_id, r.requested_model, r.model, r.provider, r.input_tokens, r.output_tokens, r.cost_usd, r.latency_ms, r.status, r.error, r.streamed, t, dayKeyFor(env.BUDGET_TIMEZONE, t)),
    env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(t, r.api_key_id),
  ]);
}

export interface Guard {
  ok: true; forceFallback: boolean;
} 
export type GuardResult = Guard | { ok: false; response: Response };

/** Budget + rate-limit checks. Returns whether to proceed, and whether the key's fallback model must be used. */
export async function guard(env: Env, key: KeyRow, project_slug: string): Promise<GuardResult> {
  const w = windows(env.BUDGET_TIMEZONE);
  const [spend, gspend, settings, rpm] = await Promise.all([
    keySpend(env, key.id, w),
    globalSpend(env, w),
    getSettings(env),
    key.requests_per_minute ? requestsLastMinute(env, key.id) : Promise.resolve(0),
  ]);

  if (key.requests_per_minute && rpm >= key.requests_per_minute) {
    return { ok: false, response: openaiError(`Rate limit of ${key.requests_per_minute} requests/minute reached for this credential.`, 429, "rate_limit_error", "rate_limit_exceeded", { "retry_after": 60 }) };
  }

  const over = (limit: number | null | undefined, spent: number) => typeof limit === "number" && limit > 0 && spent >= limit;
  const g = (k: string) => { const v = Number(settings[k]); return Number.isFinite(v) && v > 0 ? v : null; };

  let hit: string | null = null;
  if (over(key.daily_usd, spend.day)) hit = `daily budget ($${key.daily_usd}) for this credential`;
  else if (over(key.weekly_usd, spend.week)) hit = `weekly budget ($${key.weekly_usd}) for this credential`;
  else if (over(key.monthly_usd, spend.month)) hit = `monthly budget ($${key.monthly_usd}) for this credential`;
  else if (over(g("global_daily_usd"), gspend.day)) hit = `global daily budget ($${g("global_daily_usd")})`;
  else if (over(g("global_weekly_usd"), gspend.week)) hit = `global weekly budget ($${g("global_weekly_usd")})`;
  else if (over(g("global_monthly_usd"), gspend.month)) hit = `global monthly budget ($${g("global_monthly_usd")})`;

  if (!hit) return { ok: true, forceFallback: false };
  if (key.on_limit === "fallback" && key.fallback_model && !hit.startsWith("global")) return { ok: true, forceFallback: true };
  return { ok: false, response: openaiError(`Spend limit reached: ${hit} (project '${project_slug}'). Raise the budget at ${env.PUBLIC_BASE_URL}.`, 429, "insufficient_quota", "budget_exceeded") };
}

interface Attempt { model: ModelRow; response?: Response; error?: string; latency_ms: number }

/**
 * Proxies one OpenAI-style chat completion to Cloudflare AI Gateway, trying candidates in order.
 * Records usage (tokens, estimated cost) to D1 — for streams this happens after the stream ends.
 */
export async function proxyChat(
  env: Env, ctx: { waitUntil(p: Promise<unknown>): void }, key: KeyRow, project: { id: string; slug: string },
  requested: string, candidates: ModelRow[], body: Record<string, unknown>,
): Promise<Response> {
  const requestId = newId("req");
  const stream = body.stream === true;
  if (stream) body.stream_options = { ...(typeof body.stream_options === "object" && body.stream_options ? body.stream_options : {}), include_usage: true };
  delete body.user; // never forward client identities upstream

  const metadata = JSON.stringify({ project: project.slug, credential: key.id, request_id: requestId, portal: "ai.raishelmy.uk" });
  const url = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${env.AI_GATEWAY_ID}/compat/${CHAT_PATH}`;
  const attempts: Attempt[] = [];

  for (const model of candidates) {
    const auth = upstreamAuth(env, model.provider);
    if (!auth) { attempts.push({ model, error: `provider '${model.provider}' has no upstream key configured`, latency_ms: 0 }); continue; }
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-aig-metadata": metadata, ...auth.headers },
        body: JSON.stringify({ ...body, model: model.id }),
      });
    } catch (e) {
      attempts.push({ model, error: `network: ${(e as Error).message}`, latency_ms: Date.now() - started });
      continue;
    }
    const latency = Date.now() - started;
    // Retryable upstream failures → next candidate. Client errors (400/401/403 on our request shape) are returned as-is.
    if (res.status >= 500 || res.status === 429 || res.status === 404 || res.status === 408) {
      const text = await res.text().catch(() => "");
      attempts.push({ model, error: `HTTP ${res.status}: ${text.slice(0, 300)}`, latency_ms: latency });
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      ctx.waitUntil(recordUsage(env, { id: requestId, api_key_id: key.id, project_id: project.id, requested_model: requested, model: model.id, provider: model.provider, input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: latency, status: res.status, error: text.slice(0, 500), streamed: stream ? 1 : 0 }));
      return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json", "x-rais-request-id": requestId, "x-rais-model": model.id } });
    }

    const base = { id: requestId, api_key_id: key.id, project_id: project.id, requested_model: requested, model: model.id, provider: model.provider, streamed: stream ? 1 : 0 };

    if (!stream) {
      const text = await res.text();
      let usage: Usage = { prompt_tokens: 0, completion_tokens: 0 };
      try { usage = readUsage(JSON.parse(text)?.usage); } catch { /* keep zeros */ }
      ctx.waitUntil(recordUsage(env, { ...base, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, cost_usd: estimateCost(model, usage), latency_ms: latency, status: 200, error: null }));
      return new Response(text, { status: 200, headers: { "Content-Type": "application/json", "x-rais-request-id": requestId, "x-rais-model": model.id, "x-rais-fallbacks": String(attempts.length) } });
    }

    // Streaming: pass bytes through untouched, watch SSE data lines for the final usage object.
    let usage: Usage = { prompt_tokens: 0, completion_tokens: 0 };
    let buffer = "";
    const decoder = new TextDecoder();
    const scan = (chunk: Uint8Array) => {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:") || !line.includes('"usage"')) continue;
        try {
          const u = JSON.parse(line.slice(5).trim())?.usage;
          if (u && (u.prompt_tokens || u.completion_tokens || u.total_tokens)) usage = readUsage(u);
        } catch { /* partial or [DONE] */ }
      }
    };
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => { resolveDone = r; });
    const ts = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) { scan(chunk); controller.enqueue(chunk); },
      flush() { resolveDone(); },
      cancel() { resolveDone(); },
    });
    const outStream = res.body!.pipeThrough(ts);
    ctx.waitUntil(done.then(() => recordUsage(env, { ...base, input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, cost_usd: estimateCost(model, usage), latency_ms: Date.now() - started, status: 200, error: null })));
    return new Response(outStream, { status: 200, headers: { "Content-Type": res.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-cache", "x-rais-request-id": requestId, "x-rais-model": model.id, "x-rais-fallbacks": String(attempts.length) } });
  }

  const detail = attempts.map((a) => `${a.model.id}: ${a.error}`).join(" | ");
  const last = attempts[attempts.length - 1];
  ctx.waitUntil(recordUsage(env, { id: requestId, api_key_id: key.id, project_id: project.id, requested_model: requested, model: last?.model.id ?? requested, provider: last?.model.provider ?? "-", input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: last?.latency_ms ?? 0, status: 502, error: detail.slice(0, 500), streamed: stream ? 1 : 0 }));
  return openaiError(`All upstream models failed for '${requested}'. ${detail}`, 502, "api_error", "upstream_failed");
}

export { loadCatalog };
