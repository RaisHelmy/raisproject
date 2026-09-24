import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { rideSchedules } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";
import type { JobType, PaymentMethod } from "./jobs";

export interface CreateScheduleInput {
  groupId: string | null;
  purchaserUserId: string;
  jobType: JobType;
  daysOfWeek: string[];
  timeOfDay: string;
  poolPreferred?: boolean;
  preferredRunnerUserId?: string;
  deliveryFeeMinor: number;
  paymentMethod: PaymentMethod;
  leadTimeMinutes?: number;
}

export async function createSchedule(db: Db, input: CreateScheduleInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    groupId: input.groupId,
    purchaserUserId: input.purchaserUserId,
    jobType: input.jobType,
    daysOfWeekJson: JSON.stringify(input.daysOfWeek),
    timeOfDay: input.timeOfDay,
    poolPreferred: input.poolPreferred ?? false,
    preferredRunnerUserId: input.preferredRunnerUserId ?? null,
    deliveryFeeMinor: input.deliveryFeeMinor,
    paymentMethod: input.paymentMethod,
    status: "active" as const,
    leadTimeMinutes: input.leadTimeMinutes ?? 30,
  };
  return withAudit(
    db,
    { action: "ride_schedule.create", entityType: "ride_schedule", entityId: row.id },
    async () => {
      await db.insert(rideSchedules).values(row);
      return row;
    },
  );
}

export async function getScheduleById(db: Db, groupId: string | null, scheduleId: string) {
  const rows = await db
    .select()
    .from(rideSchedules)
    .where(and(groupScope(rideSchedules.groupId, groupId), eq(rideSchedules.id, scheduleId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSchedulesForPurchaser(db: Db, purchaserUserId: string) {
  return db
    .select()
    .from(rideSchedules)
    .where(eq(rideSchedules.purchaserUserId, purchaserUserId));
}

/** All active schedules — used by the daily spawner cron, not group-scoped by request. */
export async function listAllActiveSchedules(db: Db) {
  return db.select().from(rideSchedules).where(eq(rideSchedules.status, "active"));
}

export async function setScheduleStatus(
  db: Db,
  scheduleId: string,
  status: "active" | "paused" | "cancelled",
) {
  return withAudit(
    db,
    { action: "ride_schedule.set_status", entityType: "ride_schedule", entityId: scheduleId },
    async () => {
      await db
        .update(rideSchedules)
        .set({ status, updatedAt: nowIso() })
        .where(eq(rideSchedules.id, scheduleId));
      return { scheduleId, status };
    },
  );
}
