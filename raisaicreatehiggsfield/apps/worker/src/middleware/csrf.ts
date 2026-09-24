import type { MiddlewareHandler } from "hono";
import { AppError } from "@raisai/shared";
import type { Env } from "../env";
import { CSRF_COOKIE, parseCookies } from "../auth/cookies";
import type { AuthVariables } from "./auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF check for cookie-authenticated (browser) mutations.
 * Bearer-token requests (API keys, MCP tokens) are exempt — a stolen
 * bearer token already grants access; CSRF only matters for cookies a
 * browser attaches automatically.
 */
export const requireCsrf = (): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> => async (c, next) => {
  const hasBearer = Boolean(c.req.header("authorization"));
  if (SAFE_METHODS.has(c.req.method) || hasBearer) {
    await next();
    return;
  }
  const cookieToken = parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE];
  const headerToken = c.req.header("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new AppError("forbidden", "Missing or invalid CSRF token.", { action: "Reload the page and try again." });
  }
  await next();
};
