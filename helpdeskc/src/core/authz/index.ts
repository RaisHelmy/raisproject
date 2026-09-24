import { type Permission, type TicketScope } from "./permissions";

export * from "./permissions";

// The one code path every permission check goes through (CLAUDE.md §8).
// Built from the caller's resolved memberships — never from a role name.
// Platform admins are not modelled here: no platform-admin routes exist yet
// (see CLAUDE.md §17 open decisions), so this stays agent/contact-only
// rather than carrying a third case nothing can construct or narrow on.
export interface AuthContext {
  tenantId: string;
  subjectType: "agent" | "contact";
  subjectId: string;
  /** Union of permissions across all of the agent's role memberships. Empty for contacts. */
  permissions: ReadonlySet<Permission>;
  /** The broadest ticket scope across the agent's role memberships. Undefined for contacts. */
  ticketScope?: TicketScope;
}

const SCOPE_RANK: Record<TicketScope, number> = {
  none: 0,
  own: 1,
  assigned: 2,
  team: 3,
  all: 4,
};

/** Combine scopes from multiple role memberships: the broadest one wins. */
export function widestScope(scopes: TicketScope[]): TicketScope {
  if (scopes.length === 0) return "none";
  return scopes.reduce((widest, s) => (SCOPE_RANK[s] > SCOPE_RANK[widest] ? s : widest));
}

/** Deny by default: a missing permission is a denial (CLAUDE.md §8). */
export function can(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!can(ctx, permission)) {
    throw new AuthzError(permission);
  }
}

export class AuthzError extends Error {
  readonly code = "authz.denied";
  constructor(readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
  }
}
