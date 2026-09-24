export const SCOPES = [
  "models:read",
  "generations:read", "generations:write",
  "workflows:read", "workflows:write", "workflows:execute",
  "templates:read", "templates:write", "templates:execute",
  "assets:read", "assets:write",
  "projects:read", "projects:write",
  "billing:read", "billing:write",
  "account:read", "account:write",
] as const;
export type Scope = (typeof SCOPES)[number];

export type ActorType = "user" | "api_key" | "mcp";

export interface AuthContext {
  userId: string;
  orgId: string;
  actorType: ActorType;
  /** Session actors hold every scope; keys/tokens hold a subset. */
  scopes: readonly Scope[];
  requestId: string;
  isAdmin: boolean;
  /** api key / mcp token id when actorType != user */
  credentialId?: string;
}

export function hasScope(ctx: AuthContext, scope: Scope): boolean {
  return ctx.actorType === "user" || ctx.scopes.includes(scope);
}
