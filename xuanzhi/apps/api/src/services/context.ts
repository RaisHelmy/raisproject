import type { Bindings, QueueJob } from "../env";
import type { Repositories } from "../repositories";
import type { Logger } from "../lib/logger";
import type { Locale, UserRole } from "@xuanzhi/shared-types";

export interface AuthUser { id: string; email: string; name: string; role: UserRole; locale: Locale; auth_method: "session" | "api_key"; org_ids: string[]; email_verified: boolean }

export interface AppContext {
  env: Bindings;
  repos: Repositories;
  log: Logger;
  correlationId: string;
  user: AuthUser | null;
  ip: string | null;
  enqueue(job: QueueJob): Promise<void>;
  waitUntil(p: Promise<unknown>): void;
}

export function isAdmin(u: AuthUser | null): boolean { return !!u && (u.role === "admin" || u.role === "super_admin"); }
