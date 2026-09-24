import type { Id } from "./ids";

/** Roles are assigned to members at the organization level (spec §49). */
export type Role = "owner" | "admin" | "developer" | "operator" | "viewer" | "ai_agent";

/** Permission levels used by RBAC and by MCP scopes (spec §44). */
export type PermissionLevel = "READ" | "WRITE" | "DANGEROUS";

export type ActorType = "user" | "ai" | "system" | "agent";

export interface User {
  id: Id;
  email: string;
  name: string;
  avatarUrl?: string;
  /** PBKDF2-SHA256 hash (`pbkdf2$iterations$saltB64$hashB64`), if this user
   * has a real password credential (see PasswordAuthProvider). Optional —
   * most seeded/demo users only authenticate via demo headers or tokens. */
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: Id;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: Id;
  organizationId: Id;
  userId: Id;
  role: Role;
  status: "active" | "invited" | "suspended";
  createdAt: string;
  updatedAt: string;
}

/**
 * Every request (REST, MCP, CLI, agent) is resolved to an AuthContext before it
 * touches a domain service. The context is the single source of truth for
 * tenant isolation and authorization.
 */
export interface AuthContext {
  actorType: ActorType;
  actorId: Id;
  userId?: Id;
  organizationId: Id;
  role: Role;
  /** Max permission level this credential is allowed to exercise. */
  maxLevel: PermissionLevel;
  /** For MCP / API tokens. */
  tokenId?: Id;
  correlationId: string;
  demo: boolean;
}

export interface McpToken {
  id: Id;
  organizationId: Id;
  name: string;
  /** Hash of the secret — never the secret itself. */
  tokenHash: string;
  tokenPrefix: string;
  level: PermissionLevel;
  role: Role;
  lastUsedAt?: string;
  expiresAt?: string;
  status: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
}
