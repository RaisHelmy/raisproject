import { getRequestContext } from "../../worker/requestContext";
import type { Db } from "../client";
import { appendAuditLog } from "./auditLog";

export interface AuditMeta {
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
}

/**
 * The repository-layer audit hook CLAUDE.md requires ("middleware plus a
 * repository-layer hook, so a developer cannot forget"). Every mutating
 * repository function wraps its write in this, so no handler has to
 * remember to log anything — the only way to mutate data is through a
 * repository function, and every one of those logs itself, success or
 * failure, using whatever ambient actor/request context the audit
 * middleware set up (see src/worker/requestContext.ts). Outside a request
 * (tests, cron jobs) the context is simply absent and logs as `system`.
 */
export async function withAudit<T>(
  db: Db,
  meta: AuditMeta,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = getRequestContext();
  try {
    const result = await fn();
    await appendAuditLog(db, {
      actorUserId: ctx?.actorUserId ?? null,
      actorRole: ctx?.actorRole ?? null,
      groupId: ctx?.groupId ?? null,
      impersonatedByUserId: ctx?.impersonatedByUserId ?? null,
      action: meta.action,
      entityType: meta.entityType,
      entityId: meta.entityId,
      beforeJson: meta.before,
      afterJson: result,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: ctx?.requestId ?? "system",
      result: "success",
    });
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await appendAuditLog(db, {
      actorUserId: ctx?.actorUserId ?? null,
      actorRole: ctx?.actorRole ?? null,
      groupId: ctx?.groupId ?? null,
      impersonatedByUserId: ctx?.impersonatedByUserId ?? null,
      action: meta.action,
      entityType: meta.entityType,
      entityId: meta.entityId,
      beforeJson: meta.before,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: ctx?.requestId ?? "system",
      result: "failure",
      resultReason: reason,
    });
    throw err;
  }
}
