import { createDb } from "../db/client";
import { generateWeeklyPayouts } from "../db/services/payoutGenerator";
import { spawnScheduledJobs } from "../db/services/scheduleSpawner";
import { spawnContractOrders } from "../db/services/contractSpawner";

const WEEKLY_PAYOUT_CRON = "0 18 * * 0";
const DAILY_SPAWNER_CRON = "0 0 * * *";

export async function scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
  const db = await createDb(env);

  if (event.cron === WEEKLY_PAYOUT_CRON) {
    const periodEnd = new Date(event.scheduledTime).toISOString();
    const periodStart = new Date(event.scheduledTime - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Platform-wide (groupId: null) batch only — per-group weekly runs are
    // an operator action via POST /api/admin/payouts/generate, not
    // automated here, since group-specific payout cadence can differ.
    ctx.waitUntil(generateWeeklyPayouts(db, null, periodStart, periodEnd));
  }

  if (event.cron === DAILY_SPAWNER_CRON) {
    const now = new Date(event.scheduledTime);
    ctx.waitUntil(spawnScheduledJobs(db, now));
    ctx.waitUntil(spawnContractOrders(db, now));
  }
}
