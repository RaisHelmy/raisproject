import { buildAuthContext } from "./build-auth-context";
import { requirePermission, type AuthContext } from "../core/authz";
import type { Permission } from "../core/authz/permissions";
import { ForbiddenError, UnauthenticatedError } from "../core/errors";
import type { RequestData, Env } from "./env";

/**
 * Shared gate for every tenant-management route (accounts, roles, agents,
 * templates) — Contacts never reach these, and the permission check goes
 * through the one code path core/authz defines (CLAUDE.md §8).
 */
export async function requireAgentPermission(env: Env, data: RequestData, permission: Permission): Promise<AuthContext> {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx || authCtx.subjectType !== "agent") throw new ForbiddenError();
  requirePermission(authCtx, permission);
  return authCtx;
}
