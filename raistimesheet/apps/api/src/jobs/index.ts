/** Background job execution for Queue messages, inline mode and Cron triggers. */
import type { Bindings, QueueJob } from "../env";
import type { AppContext } from "../services/context";
import { createRepositories } from "../repositories";
import { getDb } from "../db/client";
import type { PgDatabase } from "../db/pg-adapter";
import { Logger } from "../lib/logger";
import { analyseImport } from "../services/imports";
import { runSyncJob, sweepDueSyncJobs } from "../services/jira/sync";
import { applyRetention } from "../services/retention";
import { correlationId } from "../lib/ids";

export function systemContext(env: Bindings, corr: string, waitUntil: (p: Promise<unknown>) => void, db: PgDatabase = getDb(env)): AppContext {
  const ctx: AppContext = {
    env, repos: createRepositories(db), log: new Logger({ request_id: corr, source: "job" }), correlationId: corr, user: null, source: "system",
    async enqueue(job) { if (env.JOB_MODE === "inline") waitUntil(runJob(env, job, ctx)); else await env.JOBS.send(job); },
    waitUntil,
  };
  return ctx;
}

export async function runJob(env: Bindings, job: QueueJob, parent?: AppContext): Promise<void> {
  const ctx = parent ? { ...parent, log: parent.log.child({ job: job.type }), correlationId: job.correlation_id } : systemContext(env, job.correlation_id, () => undefined);
  switch (job.type) {
    case "ANALYSE_IMPORT": return analyseImport(ctx, job.import_id);
    case "SYNC_JOB": return runSyncJob(ctx, job.sync_job_id);
    case "GENERATE_REPORT": return; // reports are generated synchronously today; reserved for large exports
  }
}

export async function handleQueueBatch(batch: MessageBatch<QueueJob>, env: Bindings): Promise<void> {
  const db = getDb(env);
  try { await runBatch(batch, env, db); } finally { await db.close().catch(() => undefined); }
}

async function runBatch(batch: MessageBatch<QueueJob>, env: Bindings, db: PgDatabase): Promise<void> {
  for (const msg of batch.messages) {
    const ctx = systemContext(env, msg.body.correlation_id ?? correlationId("job"), () => undefined, db);
    try {
      await runJob(env, msg.body, ctx);
      msg.ack();
    } catch (e) {
      ctx.log.warn("queue_job_failed", { type: msg.body.type, attempts: msg.attempts, error: e });
      if (msg.attempts >= 5) msg.ack(); // give up; state already recorded in Postgres (sync_errors / import FAILED)
      else msg.retry({ delaySeconds: Math.min(600, 30 * 2 ** msg.attempts) });
    }
  }
}

export async function handleScheduled(event: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
  const db = getDb(env);
  const app = systemContext(env, correlationId("cron"), (p) => ctx.waitUntil(p), db);
  try {
    if (event.cron === "*/5 * * * *") {
      const n = await sweepDueSyncJobs(app);
      if (n) app.log.info("cron_sync_sweep", { jobs: n });
    } else if (event.cron === "0 2 * * *") {
      const r = await applyRetention(app);
      app.log.info("cron_retention", r as unknown as Record<string, unknown>);
    }
  } finally {
    await db.close().catch(() => undefined);
  }
}
