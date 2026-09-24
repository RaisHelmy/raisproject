import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { sosIncidents } from "../schema";
import { withAudit } from "./withAudit";

export interface TriggerSosInput {
  jobId: string;
  triggeredByUserId: string;
  lastKnownLat?: string;
  lastKnownLng?: string;
}

/**
 * SOS never silently fails: the row is the source of truth for admin's
 * incident queue, independent of whatever notification path is used to
 * alert admin (CLAUDE.md "Emergency (SOS)"). This function only persists
 * the incident and logs it — actually notifying admin, and extending GPS
 * tracking retention past the job's terminal state, are composed by the
 * route handler alongside this call.
 */
export async function triggerSos(db: Db, input: TriggerSosInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    jobId: input.jobId,
    triggeredByUserId: input.triggeredByUserId,
    lastKnownLat: input.lastKnownLat ?? null,
    lastKnownLng: input.lastKnownLng ?? null,
    status: "triggered" as const,
    acknowledgedByUserId: null,
    acknowledgedAt: null,
    resolvedByUserId: null,
    resolvedAt: null,
    resolutionNote: null,
  };
  return withAudit(
    db,
    { action: "sos.trigger", entityType: "sos_incident", entityId: row.id },
    async () => {
      await db.insert(sosIncidents).values(row);
      return row;
    },
  );
}

export async function acknowledgeSos(db: Db, incidentId: string, adminUserId: string) {
  return withAudit(
    db,
    { action: "sos.acknowledge", entityType: "sos_incident", entityId: incidentId },
    async () => {
      const now = nowIso();
      await db
        .update(sosIncidents)
        .set({
          status: "acknowledged",
          acknowledgedByUserId: adminUserId,
          acknowledgedAt: now,
          updatedAt: now,
        })
        .where(eq(sosIncidents.id, incidentId));
      return { incidentId };
    },
  );
}

export async function resolveSos(
  db: Db,
  incidentId: string,
  adminUserId: string,
  resolutionNote: string,
) {
  return withAudit(
    db,
    { action: "sos.resolve", entityType: "sos_incident", entityId: incidentId },
    async () => {
      const now = nowIso();
      await db
        .update(sosIncidents)
        .set({
          status: "resolved",
          resolvedByUserId: adminUserId,
          resolvedAt: now,
          resolutionNote,
          updatedAt: now,
        })
        .where(eq(sosIncidents.id, incidentId));
      return { incidentId };
    },
  );
}

export async function listOpenSosIncidents(db: Db) {
  const rows = await db.select().from(sosIncidents);
  return rows.filter((r) => r.status !== "resolved");
}

export async function getSosIncidentByJob(db: Db, jobId: string) {
  const rows = await db.select().from(sosIncidents).where(eq(sosIncidents.jobId, jobId));
  return rows;
}
