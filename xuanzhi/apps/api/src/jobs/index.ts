/** Queue consumer + inline runner. Document processing never runs inside an HTTP request. */
import type { Bindings, QueueJob } from "../env";
import type { AppContext } from "../services/context";
import { createRepositories } from "../repositories";
import { createDb } from "../db/client";
import { Logger } from "../lib/logger";
import { processDocument, processUpload } from "../services/knowledge/processing";
import { summarizeConversation } from "../services/chat/service";

export function systemContext(env: Bindings, correlationId: string, waitUntil: (p: Promise<unknown>) => void): AppContext {
  const repos = createRepositories(createDb(env.HYPERDRIVE.connectionString));
  const ctx: AppContext = {
    env, repos, log: new Logger({ request_id: correlationId, source: "job" }), correlationId, user: null, ip: null,
    async enqueue(job) { if (env.JOB_MODE === "inline" || !env.JOBS) waitUntil(runJob(env, job, ctx)); else await env.JOBS.send(job); },
    waitUntil,
  };
  return ctx;
}

export async function runJob(env: Bindings, job: QueueJob, ctx?: AppContext): Promise<void> {
  const c = ctx ?? systemContext(env, job.correlation_id, () => undefined);
  const log = c.log.child({ job: job.type });
  const started = Date.now();
  try {
    switch (job.type) {
      case "PROCESS_DOCUMENT": await processDocument(c, job.document_id); break;
      case "PROCESS_UPLOAD": await processUpload(c, job.upload_id); break;
      case "SUMMARIZE_CONVERSATION": await summarizeConversation(c, job.conversation_id); break;
    }
    log.info("job_done", { ms: Date.now() - started });
  } catch (e) { log.error("job_failed", { error: e as Error, ms: Date.now() - started }); throw e; }
}

export async function handleQueueBatch(batch: MessageBatch<QueueJob>, env: Bindings): Promise<void> {
  for (const msg of batch.messages) {
    try { await runJob(env, msg.body); msg.ack(); }
    catch { msg.retry({ delaySeconds: 30 }); }
  }
}

/** Housekeeping (triggered by Ubuntu cron → POST /internal/cron/housekeeping). */
export async function housekeeping(ctx: AppContext): Promise<{ sessions: boolean; uploads: number }> {
  await ctx.repos.sessions.purgeExpired();
  await ctx.repos.rateLimits.purge();
  const expired = await ctx.repos.uploads.purgeExpired();
  for (const u of expired) await ctx.env.FILES.delete(u.file_key).catch(() => undefined);
  return { sessions: true, uploads: expired.length };
}
