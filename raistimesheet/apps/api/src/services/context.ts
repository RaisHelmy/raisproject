import type { Bindings, QueueJob } from "../env";
import type { Repositories } from "../repositories";
import type { Logger } from "../lib/logger";
import type { Role } from "@rais/shared-types";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  timezone: string;
  whatsapp_aliases: string[];
  jira_account_id: string | null;
  onboarding_completed: boolean;
  /** "session" (browser cookie) or "api_token" (MCP / integrations) */
  auth_method: "session" | "api_token";
}

export interface AppContext {
  env: Bindings;
  repos: Repositories;
  log: Logger;
  correlationId: string;
  user: AuthUser | null;
  source: "web" | "mcp" | "system";
  enqueue(job: QueueJob): Promise<void>;
  waitUntil(p: Promise<unknown>): void;
}

export function requireUser(ctx: AppContext): AuthUser {
  if (!ctx.user) throw new Error("UNAUTHENTICATED");
  return ctx.user;
}

export function hasRole(u: AuthUser | null, ...roles: Role[]): boolean {
  return !!u && roles.some((r) => u.roles.includes(r));
}

export const isAdmin = (u: AuthUser | null) => hasRole(u, "ADMIN");
export const isApprover = (u: AuthUser | null) => hasRole(u, "ADMIN", "APPROVER");

/** Read the current job mode: Queue-backed or inline (local dev). */
export function jobMode(env: Bindings): "queue" | "inline" {
  return env.JOB_MODE === "inline" ? "inline" : "queue";
}
