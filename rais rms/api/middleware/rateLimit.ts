import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { checkRateLimit } from "../lib/rateLimit";
import { ApiHttpError } from "../lib/errors";

export function rateLimit(opts: { limit: number; windowSeconds: number; keyPrefix: string }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
    const key = `${opts.keyPrefix}:${ip}`;
    const { allowed, remaining } = await checkRateLimit(c.env.DB, key, opts);
    c.header("X-RateLimit-Remaining", String(remaining));
    if (!allowed) {
      throw new ApiHttpError(429, "RATE_LIMITED", "Too many requests, please try again shortly.");
    }
    await next();
  };
}
