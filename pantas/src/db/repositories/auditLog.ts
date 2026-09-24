import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { auditLog } from "../schema";

/**
 * This module intentionally exports no update/delete functions — the audit
 * log is append-only per CLAUDE.md ("Never UPDATE, never DELETE"). Anything
 * that needs correcting gets a new row, not a mutation of an old one.
 */
export interface AuditLogEntryInput {
  actorUserId: string | null;
  actorRole: string | null;
  groupId: string | null;
  impersonatedByUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  result: "success" | "failure";
  resultReason?: string;
}

export async function appendAuditLog(db: Db, input: AuditLogEntryInput) {
  const row = {
    id: newId(),
    ts: nowIso(),
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    groupId: input.groupId,
    impersonatedByUserId: input.impersonatedByUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.beforeJson === undefined ? null : JSON.stringify(input.beforeJson),
    afterJson: input.afterJson === undefined ? null : JSON.stringify(input.afterJson),
    ip: input.ip,
    userAgent: input.userAgent,
    requestId: input.requestId,
    result: input.result,
    resultReason: input.resultReason ?? null,
  };
  await db.insert(auditLog).values(row);
  return row;
}

export async function listAuditLogForEntity(
  db: Db,
  entityType: string,
  entityId: string,
) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)));
}
