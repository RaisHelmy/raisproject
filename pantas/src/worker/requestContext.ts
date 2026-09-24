import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Ambient per-request context, threaded through AsyncLocalStorage so the
 * repository layer can log every mutation without every handler having to
 * remember to pass actor/ip/requestId down manually (CLAUDE.md: "middleware
 * plus a repository-layer hook, so a developer cannot forget"). Set once by
 * auditContext middleware at the top of the request; read by
 * repositories/withAudit.ts.
 */
export interface RequestContext {
  requestId: string;
  actorUserId: string | null;
  actorRole: string | null;
  groupId: string | null;
  impersonatedByUserId: string | null;
  ip: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
