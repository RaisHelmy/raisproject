import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { unauthorized } from "../lib/errors";

/**
 * Cloudflare Pages Functions can't declare Cron Triggers directly (those are a
 * standalone-Worker feature); the intended setup is an external scheduler
 * (Cloudflare Cron on a tiny companion Worker, or any scheduled HTTP caller)
 * hitting these endpoints with this shared secret on a schedule (e.g. hourly).
 */
export const requireCronSecret: MiddlewareHandler<AppEnv> = async (c, next) => {
  const provided = c.req.header("X-Cron-Secret");
  if (!c.env.CRON_SECRET || !provided || provided !== c.env.CRON_SECRET) {
    throw unauthorized("Invalid or missing cron secret");
  }
  await next();
};
