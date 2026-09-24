import type { MiddlewareHandler } from "hono";
import { runWithRequestContext } from "../requestContext";
import { getSession } from "../auth/session";
import type { AppEnv } from "../types";

/**
 * Establishes the ambient request context every audited repository write
 * reads from. Must run before any route handler and before session
 * resolution failures short-circuit the request, so even a rejected /
 * failed request is attributable to a request id.
 */
export function auditContext(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = crypto.randomUUID();
    const ip = c.req.header("CF-Connecting-IP") ?? null;
    const userAgent = c.req.header("User-Agent") ?? null;

    const session = await getSession(c.env, c.req.raw);

    c.set("requestId", requestId);
    c.set("session", session);

    await runWithRequestContext(
      {
        requestId,
        actorUserId: session?.userId ?? null,
        actorRole: session?.activeRole ?? null,
        groupId: session?.groupId ?? null,
        impersonatedByUserId: session?.impersonatedByUserId ?? null,
        ip,
        userAgent,
      },
      () => next(),
    );
  };
}
