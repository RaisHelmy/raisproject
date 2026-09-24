import type { Context, Next } from "hono";
import type { AuthContext, Role } from "@runforge/shared";
import { newId } from "@runforge/shared";
import { getRunForge } from "../runforge-instance";
import { fail } from "../response";

/**
 * Resolves credentials from the request into an AuthContext (spec §11/§55/§56).
 * Demo mode reads the bearer token if present, otherwise falls back to the
 * seeded demo owner; X-RunForge-Demo-Role lets the UI/tests exercise RBAC.
 */
export async function authMiddleware(c: Context, next: Next) {
  const runforge = getRunForge();
  const requestId = newId("req");
  c.set("requestId", requestId);
  try {
    const authHeader = c.req.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const ctx: AuthContext = await runforge.auth.authenticate({
      bearerToken,
      demoUserId: c.req.header("X-RunForge-Demo-User") || undefined,
      demoRole: (c.req.header("X-RunForge-Demo-Role") as Role) || undefined,
      organizationId: c.req.header("X-RunForge-Organization") || undefined,
      correlationId: requestId,
    });
    c.set("auth", ctx);
    // Demo mode: advance simulated deployments/jobs on every request so state
    // is always current without a separate background worker.
    if (runforge.mode === "demo") await runforge.tick();
    await next();
  } catch (err) {
    return fail(c, err);
  }
}

export function requireAuth(c: Context): AuthContext {
  return c.get("auth") as AuthContext;
}
