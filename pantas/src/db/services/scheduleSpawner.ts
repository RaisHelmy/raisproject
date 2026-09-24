import type { Db } from "../client";
import { createDraftJob, postJob } from "../repositories/jobs";
import { listAllActiveSchedules } from "../repositories/rideSchedules";

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Daily spawner for `ride_schedule` recurring bookings (CLAUDE.md
 * "Scheduling & subscriptions"). Runs once a day (see wrangler.jsonc cron
 * "0 0 * * *") and, for every active schedule matching today's day of
 * week, creates and posts today's job instance. NOTE: this is a coarse,
 * once-daily granularity — it does not honor `leadTimeMinutes` precisely
 * (that would need a much more frequent cron, e.g. every 5 minutes,
 * checking approaching slots). Documented gap, not silently assumed exact.
 *
 * A preferred runner is first-refusal only (CLAUDE.md) — this spawner does
 * not special-case them; normal FCFS/negotiation matching applies to the
 * posted job, same as any other. Pinning a preferred runner's priority is
 * left for the matching layer to interpret via `preferredRunnerUserId`.
 */
export async function spawnScheduledJobs(db: Db, now: Date = new Date()) {
  const todayCode = DAY_CODES[now.getUTCDay()];
  const schedules = await listAllActiveSchedules(db);
  const created = [];

  for (const schedule of schedules) {
    const days = JSON.parse(schedule.daysOfWeekJson) as string[];
    if (!days.includes(todayCode as string)) continue;

    const [hh, mm] = schedule.timeOfDay.split(":").map(Number);
    const scheduledFor = new Date(now);
    scheduledFor.setUTCHours(hh ?? 0, mm ?? 0, 0, 0);

    const draft = await createDraftJob(db, {
      groupId: schedule.groupId,
      type: schedule.jobType,
      purchaserUserId: schedule.purchaserUserId,
      paymentMethod: schedule.paymentMethod,
      deliveryFeeMinor: schedule.deliveryFeeMinor,
      poolEnabled: schedule.poolPreferred,
      scheduledFor: scheduledFor.toISOString(),
      spawnedFromScheduleId: schedule.id,
    });
    const posted = await postJob(db, schedule.groupId, draft.id);
    created.push(posted);
  }

  return created;
}
