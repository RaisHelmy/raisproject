import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Bindings, QueueJob } from "../env";
import type { AppContext, AuthUser } from "../services/context";
import { createRepositories } from "../repositories";
import { getDb } from "../db/client";
import { Logger } from "../lib/logger";
import { correlationId } from "../lib/ids";
import { sha256Hex } from "../lib/crypto";
import { AppError, Errors } from "../lib/errors";
import { fail } from "../lib/http";
import { nowIso } from "../lib/time";
import { safeJson } from "../services/mappers";
import type { Role } from "@rais/shared-types";

export type HonoEnv = { Bindings: Bindings; Variables: { ctx: AppContext } };

export const SESSION_COOKIE = "rais_session";

/**
 * Every browser origin the web app is served from. `WEB_ORIGIN` is the
 * canonical one (used for redirects); `WEB_ORIGINS_EXTRA` is an optional
 * comma-separated list of additional origins (e.g. the *.pages.dev alias
 * next to the custom domain). localhost:5173 (Vite dev) is always allowed
 * so local dev against a deployed API needs no wrangler.jsonc edit.
 */
export function webOrigins(env: Pick<Bindings, "WEB_ORIGIN" | "WEB_ORIGINS_EXTRA">): string[] {
  const extra = (env.WEB_ORIGINS_EXTRA ?? "").split(",").map((s) => s.trim());
  return [...new Set([env.WEB_ORIGIN, ...extra, "http://localhost:5173"].filter((v): v is string => Boolean(v)))];
}

/** Build the per-request AppContext (repositories, logger, correlation id). */
export const appContext = (runInline: (env: Bindings, job: QueueJob, ctx: AppContext) => Promise<void>): MiddlewareHandler<HonoEnv> => async (c, next) => {
  const reqId = c.req.header("x-request-id") ?? correlationId("req");
  const db = getDb(c.env);
  const repos = createRepositories(db);
  const log = new Logger({ request_id: reqId, path: c.req.path, method: c.req.method });
  const background: Promise<unknown>[] = [];
  const ctx: AppContext = {
    env: c.env,
    repos,
    log,
    correlationId: reqId,
    user: null,
    source: "web",
    async enqueue(job) {
      if (c.env.JOB_MODE === "inline") background.push(runInline(c.env, job, ctx));
      else await c.env.JOBS.send(job);
    },
    waitUntil(p) { background.push(p); },
  };
  c.set("ctx", ctx);
  c.header("x-request-id", reqId);
  try {
    await next();
  } finally {
    // Unclosed postgres.js clients accumulate sockets in the isolate until it hits Cloudflare error 1102.
    const drain = async () => { for (let n = 0; n < background.length; n = background.length) await Promise.allSettled(background.slice(n)); await db.close(); };
    c.executionCtx.waitUntil(drain().catch(() => undefined));
  }
};

/** Resolve the user from session cookie or Bearer API token (MCP). */
export const authenticate: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const ctx = c.get("ctx");
  const bearer = c.req.header("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7).trim();
    const t = await ctx.repos.sessions.findApiTokenByHash(await sha256Hex(token));
    if (t) {
      const user = await ctx.repos.users.findById(t.user_id);
      if (user && user.is_active) {
        ctx.user = await toAuthUser(ctx, user, "api_token");
        ctx.source = "mcp";
        ctx.waitUntil(ctx.repos.sessions.touchApiToken(t.id, nowIso()));
      }
    }
  } else {
    const cookie = getCookie(c, SESSION_COOKIE);
    if (cookie) {
      const s = await ctx.repos.sessions.findByTokenHash(await sha256Hex(cookie));
      if (s && s.expires_at > nowIso()) {
        const user = await ctx.repos.users.findById(s.user_id);
        if (user && user.is_active) ctx.user = await toAuthUser(ctx, user, "session");
      }
    }
  }
  if (ctx.user) ctx.log = ctx.log.child({ user_id: ctx.user.id });
  await next();
};

async function toAuthUser(ctx: AppContext, u: { id: string; email: string; name: string; timezone: string; whatsapp_aliases: string; jira_account_id: string | null; onboarding_completed: number }, method: AuthUser["auth_method"]): Promise<AuthUser> {
  const roles = (await ctx.repos.users.rolesFor(u.id)) as Role[];
  return { id: u.id, email: u.email, name: u.name, roles, timezone: u.timezone, whatsapp_aliases: safeJson<string[]>(u.whatsapp_aliases, []), jira_account_id: u.jira_account_id, onboarding_completed: !!u.onboarding_completed, auth_method: method };
}

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (!c.get("ctx").user) throw Errors.unauthorized();
  await next();
};

export const requireRole = (...roles: Role[]): MiddlewareHandler<HonoEnv> => async (c, next) => {
  const u = c.get("ctx").user;
  if (!u) throw Errors.unauthorized();
  if (!roles.some((r) => u.roles.includes(r))) throw Errors.forbidden();
  await next();
};

/**
 * CSRF protection for cookie sessions: mutating requests must carry the custom header
 * (browsers cannot add it cross-site without CORS approval) and, when present, a same-origin Origin.
 */
export const csrf: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
  const ctx = c.get("ctx");
  if (ctx.user?.auth_method === "api_token") return next();
  if (c.req.path.startsWith("/api/jira/oauth/callback")) return next();
  // Server-to-server MCP bootstrap: no cookie, no session, so there is no
  // CSRF surface to protect — it authenticates with MCP_BOOTSTRAP_TOKEN
  // (timing-safe compare) and is rate limited. Without this bypass the
  // endpoint is unreachable by the very clients it exists for.
  if (c.req.path === "/api/auth/mcp/bootstrap") return next();
  if (c.req.header("x-requested-with") !== "RaisTimesheet") throw new AppError("CSRF_REJECTED", "Request rejected (missing anti-CSRF header).", 403);
  const origin = c.req.header("origin");
  if (origin && ctx.env.WEB_ORIGIN && !webOrigins(ctx.env).includes(origin) && origin !== new URL(c.req.url).origin) throw new AppError("CSRF_REJECTED", "Request rejected (origin mismatch).", 403);
  await next();
};

/** Simple fixed-window rate limit per IP (+ per user), backed by Postgres. */
export const rateLimit = (limit: number, windowSeconds: number, scope = "api"): MiddlewareHandler<HonoEnv> => async (c, next) => {
  const ctx = c.get("ctx");
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "local";
  const key = `${scope}:${ctx.user?.id ?? ip}`;
  const count = await ctx.repos.rateLimits.hit(key, windowSeconds, new Date());
  c.header("x-ratelimit-limit", String(limit));
  c.header("x-ratelimit-remaining", String(Math.max(0, limit - count)));
  if (count > limit) throw Errors.rateLimited();
  await next();
};

export function errorHandler(err: Error, c: Context<HonoEnv>) {
  const ctx = c.get("ctx");
  if (err instanceof AppError) {
    if (err.status >= 500) ctx?.log.error("app_error", { code: err.code, message: err.message, reference: err.reference });
    return fail(c, err.code, err.message, err.status as 400, err.reference, err.details);
  }
  const reference = `ERR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${(ctx?.correlationId ?? "").slice(-6).toUpperCase() || "00000"}`;
  ctx?.log.error("unhandled_error", { error: err, reference });
  return fail(c, "INTERNAL_ERROR", "Something went wrong. Please try again or contact support with the reference.", 500, reference);
}

export function notFoundHandler(c: Context<HonoEnv>) {
  return fail(c, "NOT_FOUND", "Endpoint not found.", 404);
}

export async function noop(_c: Context, next: Next) { await next(); }
