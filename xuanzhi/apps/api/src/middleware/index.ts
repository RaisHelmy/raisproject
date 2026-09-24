import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { Bindings, QueueJob } from "../env";
import type { AppContext, AuthUser } from "../services/context";
import { isAdmin } from "../services/context";
import { createRepositories } from "../repositories";
import { createDb } from "../db/client";
import { Logger } from "../lib/logger";
import { correlationId } from "../lib/ids";
import { sha256Hex } from "../lib/crypto";
import { AppError, Errors } from "../lib/errors";
import { clientIp, fail } from "../lib/http";
import type { UserRow } from "../repositories/types";

export type HonoEnv = { Bindings: Bindings; Variables: { ctx: AppContext } };
export const SESSION_COOKIE = "xz_session";
export const CSRF_HEADER_VALUE = "XuanZhi";

/** Trusted browser origins: WEB_ORIGIN (Pages origin) plus any comma-separated extras in WEB_ORIGINS (custom domains). */
export function webOrigins(env: Bindings): string[] {
  const extra = (env.WEB_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([env.WEB_ORIGIN, ...extra].filter((v): v is string => Boolean(v))));
}

export const appContext = (runInline: (env: Bindings, job: QueueJob, ctx: AppContext) => Promise<void>): MiddlewareHandler<HonoEnv> => async (c, next) => {
  const reqId = c.req.header("x-request-id") ?? correlationId("req");
  const repos = createRepositories(createDb(c.env.HYPERDRIVE.connectionString));
  const log = new Logger({ request_id: reqId, path: c.req.path, method: c.req.method });
  const ctx: AppContext = {
    env: c.env, repos, log, correlationId: reqId, user: null, ip: clientIp(c),
    async enqueue(job) { if (c.env.JOB_MODE === "inline" || !c.env.JOBS) c.executionCtx.waitUntil(runInline(c.env, job, ctx)); else await c.env.JOBS.send(job); },
    waitUntil(p) { c.executionCtx.waitUntil(p); },
  };
  c.set("ctx", ctx);
  c.header("x-request-id", reqId);
  await next();
};

async function toAuthUser(ctx: AppContext, u: UserRow, method: AuthUser["auth_method"]): Promise<AuthUser> {
  const orgs = await ctx.repos.organizations.orgIdsForUser(u.id);
  return { id: u.id, email: u.email, name: u.name, role: u.role, locale: u.locale, auth_method: method, org_ids: orgs.map((o) => o.organization_id), email_verified: !!u.email_verified_at };
}

/** Resolve the user from the session cookie or a Bearer API key (xz_...). */
export const authenticate: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const ctx = c.get("ctx");
  const bearer = c.req.header("authorization");
  if (bearer?.startsWith("Bearer xz_")) {
    const key = await ctx.repos.apiKeys.findByHash(await sha256Hex(bearer.slice(7).trim()));
    if (key) {
      const user = await ctx.repos.users.findById(key.user_id);
      if (user?.is_active) { ctx.user = await toAuthUser(ctx, user, "api_key"); ctx.waitUntil(ctx.repos.apiKeys.touch(key.id)); }
    }
  } else {
    const cookie = getCookie(c, SESSION_COOKIE);
    if (cookie) {
      const s = await ctx.repos.sessions.findByTokenHash(await sha256Hex(cookie));
      if (s) {
        const user = await ctx.repos.users.findById(s.user_id);
        if (user?.is_active) { ctx.user = await toAuthUser(ctx, user, "session"); ctx.waitUntil(ctx.repos.sessions.touch(s.id)); }
      }
    }
  }
  if (ctx.user) ctx.log = ctx.log.child({ user_id: ctx.user.id });
  await next();
};

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => { if (!c.get("ctx").user) throw Errors.unauthorized(); await next(); };
export const requireAdmin: MiddlewareHandler<HonoEnv> = async (c, next) => { const u = c.get("ctx").user; if (!u) throw Errors.unauthorized(); if (!isAdmin(u)) throw Errors.forbidden("Administrator access required."); await next(); };
export const requireSuperAdmin: MiddlewareHandler<HonoEnv> = async (c, next) => { const u = c.get("ctx").user; if (!u) throw Errors.unauthorized(); if (u.role !== "super_admin") throw Errors.forbidden("Super administrator access required."); await next(); };

/** CSRF: cookie-authenticated mutations must carry the custom header and (if present) a trusted Origin. API keys and webhooks are exempt. */
export const csrf: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();
  const ctx = c.get("ctx");
  if (ctx.user?.auth_method === "api_key") return next();
  const path = c.req.path;
  if (path.startsWith("/api/billing/webhook") || path.startsWith("/api/auth/oauth/")) return next();
  if (c.req.header("x-requested-with") !== CSRF_HEADER_VALUE) throw new AppError("CSRF_REJECTED", "Request rejected (missing anti-CSRF header).", 403);
  const origin = c.req.header("origin");
  const self = new URL(c.req.url).origin;
  if (origin && !webOrigins(ctx.env).includes(origin) && origin !== self && !origin.startsWith("http://localhost:")) throw new AppError("CSRF_REJECTED", "Request rejected (origin mismatch).", 403);
  await next();
};

/** Fixed-window rate limit per user (or IP when anonymous), backed by Postgres. */
export const rateLimit = (limit: number, windowSeconds: number, scope = "api"): MiddlewareHandler<HonoEnv> => async (c, next) => {
  const ctx = c.get("ctx");
  const key = `${scope}:${ctx.user?.id ?? ctx.ip ?? "local"}`;
  const count = await ctx.repos.rateLimits.hit(key, windowSeconds);
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
  ctx?.log.error("unhandled_error", { error: err, stack: err.stack?.slice(0, 600), reference });
  return fail(c, "INTERNAL_ERROR", "Something went wrong. Please try again or contact support with the reference.", 500, reference);
}
export function notFoundHandler(c: Context<HonoEnv>) { return fail(c, "NOT_FOUND", "Endpoint not found.", 404); }
