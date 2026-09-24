import type { AuthContext, PermissionLevel, Role } from "@runforge/shared";
import { DomainError } from "../errors";

const LEVEL_RANK: Record<PermissionLevel, number> = { READ: 0, WRITE: 1, DANGEROUS: 2 };

/** Highest permission level each role may exercise (spec §44/§49). */
export const ROLE_MAX_LEVEL: Record<Role, PermissionLevel> = {
  owner: "DANGEROUS",
  admin: "DANGEROUS",
  operator: "DANGEROUS",
  developer: "WRITE",
  viewer: "READ",
  ai_agent: "WRITE",
};

/**
 * Permission catalogue. Every domain operation names one of these keys. The
 * level decides which roles/tokens may call it and whether MCP must ask for
 * confirmation first.
 */
export const PERMISSIONS = {
  "project:read": "READ",
  "project:write": "WRITE",
  "project:delete": "DANGEROUS",
  "application:read": "READ",
  "application:write": "WRITE",
  "application:deploy": "WRITE",
  "application:deploy:production": "DANGEROUS",
  "application:restart": "WRITE",
  "application:rollback": "DANGEROUS",
  "application:delete": "DANGEROUS",
  "deployment:read": "READ",
  "server:read": "READ",
  "server:write": "WRITE",
  "server:delete": "DANGEROUS",
  "container:read": "READ",
  "container:restart": "WRITE",
  "container:remove": "DANGEROUS",
  "service:control": "WRITE",
  "database:read": "READ",
  "database:write": "WRITE",
  "database:query": "WRITE",
  "database:delete": "DANGEROUS",
  "domain:read": "READ",
  "domain:write": "WRITE",
  "domain:delete": "DANGEROUS",
  "network:read": "READ",
  "network:write": "WRITE",
  "port:expose": "DANGEROUS",
  "logs:read": "READ",
  "metrics:read": "READ",
  "events:read": "READ",
  "incident:read": "READ",
  "incident:write": "WRITE",
  "team:read": "READ",
  "team:write": "DANGEROUS",
  "mcp:read": "READ",
  "mcp:write": "DANGEROUS",
  "audit:read": "READ",
} as const satisfies Record<string, PermissionLevel>;

export type Permission = keyof typeof PERMISSIONS;

export function levelOf(permission: Permission): PermissionLevel {
  return PERMISSIONS[permission];
}

export function levelAtLeast(actual: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

export function minLevel(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return LEVEL_RANK[a] <= LEVEL_RANK[b] ? a : b;
}

/**
 * PermissionService is the only place authorization decisions are made.
 * REST, MCP, CLI and the agent all pass through it via the domain services.
 */
export class PermissionService {
  /** Effective level = min(role ceiling, credential ceiling). */
  effectiveLevel(ctx: AuthContext): PermissionLevel {
    return minLevel(ROLE_MAX_LEVEL[ctx.role], ctx.maxLevel);
  }

  can(ctx: AuthContext, permission: Permission): boolean {
    return levelAtLeast(this.effectiveLevel(ctx), levelOf(permission));
  }

  /** Throws FORBIDDEN when the context cannot exercise the permission. */
  require(ctx: AuthContext, permission: Permission): void {
    if (!this.can(ctx, permission)) {
      throw DomainError.forbidden(`Permission ${permission} requires ${levelOf(permission)} access`, {
        permission,
        required: levelOf(permission),
        effective: this.effectiveLevel(ctx),
        role: ctx.role,
      });
    }
  }

  /** Tenant isolation guard: a resource must belong to the caller's organization. */
  requireTenant(ctx: AuthContext, resource: { organizationId: string } | null | undefined, resourceType: string, id: string): void {
    if (!resource || resource.organizationId !== ctx.organizationId) {
      // Deliberately indistinguishable from a missing resource.
      throw DomainError.notFound(resourceType, id);
    }
  }
}
