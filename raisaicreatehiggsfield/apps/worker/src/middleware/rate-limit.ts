import type { MiddlewareHandler } from "hono";
import { AppError } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "./auth";

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number;
  windowMs: number;
  /** Distinguishes buckets, e.g. "generations" vs "api". */
  bucket: string;
}

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * Per-organization rate limiting (§107), so one workspace cannot flood the
 * provider or run up an unbounded bill.
 *
 * The counters live in the isolate, which means the limit is enforced per
 * isolate rather than globally. That is enough to stop a runaway client or a
 * looping workflow, which is the actual risk here; a globally exact limit needs
 * a Durable Object and is only worth it once traffic spans many isolates.
 */
const counters = new Map<string, Counter>();

function hit(key: string, rule: RateLimitRule, now: number): { allowed: boolean; retryAfterSeconds: number } {
  const existing = counters.get(key);
  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > rule.limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export const DEFAULT_RULES = {
  api: { bucket: "api", limit: 600, windowMs: 60_000 },
  generations: { bucket: "generations", limit: 30, windowMs: 60_000 },
  runs: { bucket: "runs", limit: 10, windowMs: 60_000 },
  uploads: { bucket: "uploads", limit: 60, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export const rateLimit = (rule: RateLimitRule): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> =>
  async (c, next) => {
    const auth = c.get("auth");
    // Unauthenticated requests are limited by IP so signup cannot be hammered.
    const identity = auth?.orgId ?? c.req.header("cf-connecting-ip") ?? "anonymous";
    const { allowed, retryAfterSeconds } = hit(`${rule.bucket}:${identity}`, rule, Date.now());

    if (!allowed) {
      c.header("retry-after", String(retryAfterSeconds));
      throw new AppError("rate_limited", "Too many requests. Slow down and try again shortly.", {
        action: `Wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} and retry.`,
        details: { retryAfterSeconds },
      });
    }
    await next();
  };

/** Test helper: clears counters between cases. */
export function resetRateLimits(): void {
  counters.clear();
}
