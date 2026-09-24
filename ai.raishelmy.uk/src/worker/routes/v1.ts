import { Hono } from "hono";
import type { Env } from "../env";
import type { KeyRow, ProjectRow } from "../db";
import { loadCatalog } from "../db";
import { extractBearer } from "../keys";
import { sha256Hex, now, openaiError } from "../util";
import { guard, proxyChat, resolveModel } from "../gateway";

type Vars = { key: KeyRow; project: ProjectRow };
export const v1 = new Hono<{ Bindings: Env; Variables: Vars }>();

v1.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  const token = extractBearer(c.req.raw);
  if (!token || !token.startsWith("rais_sk_")) return withCors(openaiError("Missing or malformed API key. Send 'Authorization: Bearer rais_sk_...'.", 401, "authentication_error", "invalid_api_key"));
  const hash = await sha256Hex(token);
  const key = await c.env.DB.prepare("SELECT * FROM api_keys WHERE key_hash = ?").bind(hash).first<KeyRow>();
  if (!key) return withCors(openaiError("Invalid API key.", 401, "authentication_error", "invalid_api_key"));
  if (!key.enabled) return withCors(openaiError("This API key is disabled.", 401, "authentication_error", "key_disabled"));
  if (key.expires_at && key.expires_at < now()) return withCors(openaiError("This API key has expired.", 401, "authentication_error", "key_expired"));
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(key.project_id).first<ProjectRow>();
  if (!project) return withCors(openaiError("Project missing for this key.", 401, "authentication_error", "invalid_api_key"));
  c.set("key", key);
  c.set("project", project);
  await next();
  for (const [k, v] of Object.entries(cors())) c.res.headers.set(k, v);
});

function cors(): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
}
function withCors(r: Response): Response {
  for (const [k, v] of Object.entries(cors())) r.headers.set(k, v);
  return r;
}

/** OpenAI-shaped model list: aliases + the concrete models this credential may use. */
v1.get("/models", async (c) => {
  const key = c.get("key");
  const { models, aliases } = await loadCatalog(c.env);
  let allowed: string[] = [];
  try { allowed = JSON.parse(key.allowed_models); } catch { /* ignore */ }
  const ok = (id: string) => allowed.length === 0 || allowed.includes(id);
  const created = Math.floor(key.created_at);
  const data = [
    ...aliases.filter((a) => ok(a.name) || JSON.parse(a.candidates).some(ok)).map((a) => ({ id: a.name, object: "model", created, owned_by: "ai.raishelmy.uk", description: a.description })),
    ...models.filter((m) => m.enabled && ok(m.id)).map((m) => ({ id: m.id, object: "model", created, owned_by: m.provider, display_name: m.display_name })),
  ];
  return c.json({ object: "list", data, default_model: key.default_model });
});

v1.post("/chat/completions", async (c) => {
  const key = c.get("key");
  const project = c.get("project");
  let body: Record<string, unknown>;
  try { body = (await c.req.json()) as Record<string, unknown>; } catch { return openaiError("Request body must be JSON.", 400); }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return openaiError("'messages' is required.", 400, "invalid_request_error", null, { param: "messages" });

  const requested = typeof body.model === "string" && body.model.trim() ? body.model.trim() : key.default_model;
  const g = await guard(c.env, key, project.slug);
  if (!g.ok) return g.response;

  const { models, aliases } = await loadCatalog(c.env);
  const target = g.forceFallback && key.fallback_model ? key.fallback_model : requested;
  const resolved = resolveModel(target, key, models, aliases);
  if (!resolved.ok) return openaiError(resolved.error, resolved.status, resolved.status === 404 ? "invalid_request_error" : "permission_error", "model_not_allowed", { param: "model" });

  return proxyChat(c.env, c.executionCtx, key, project, requested, resolved.candidates, body);
});

v1.all("*", () => openaiError("Only /v1/chat/completions and /v1/models are supported.", 404, "invalid_request_error", "unknown_endpoint"));
