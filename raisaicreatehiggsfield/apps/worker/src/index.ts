import { createApp } from "./app";
import type { Env } from "./env";
import { ThumbnailService, type ThumbnailJob } from "./services/thumbnail-service";
import { ModelSyncService } from "./services/model-sync-service";
import { ScheduleService } from "./services/schedule-service";
import { WebhookService, type DeliveryJob } from "./services/webhook-service";
import { Logger } from "./lib/logger";
import { attachDb } from "./db/client";

const app = createApp();

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),

  /**
   * Side effects that must not slow a generation down: thumbnails today,
   * webhook delivery and usage rollups in phase 2.
   */
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    attachDb(env);
    const logger = new Logger({ queue: batch.queue });
    for (const message of batch.messages) {
      const job = message.body as { kind?: string };
      try {
        if (job.kind === "thumbnail") {
          await new ThumbnailService(env).generate(message.body as ThumbnailJob);
          message.ack();
          continue;
        }
        if (job.kind === "webhook") {
          const { deliveryId } = message.body as DeliveryJob;
          const outcome = await new WebhookService(env).deliver(deliveryId);
          // The service decides whether another attempt is worthwhile; the
          // queue's own backoff carries out the wait.
          if (outcome.retry) message.retry();
          else message.ack();
          continue;
        }
        message.ack();
      } catch (error) {
        logger.error("queue.job_failed", {
          kind: job.kind,
          message: error instanceof Error ? error.message : String(error),
        });
        // Retried with backoff by the queue; a lost thumbnail is not fatal.
        message.retry();
      }
    }
  },

  /**
   * Nightly catalog sync. It only records what Cloudflare offers as
   * `discovered`; an admin still prices, tests and enables anything new, so
   * this can never put an unverified model in front of a paying customer.
   */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    attachDb(env);
    const logger = new Logger({ job: "scheduled" });

    // Due schedules first: they are time-sensitive, catalog sync is not.
    try {
      const schedules = await new ScheduleService(env).runDue();
      if (schedules.fired > 0 || schedules.failed > 0) logger.info("schedules.finished", { ...schedules });
    } catch (error) {
      logger.error("schedules.failed", { message: error instanceof Error ? error.message : String(error) });
    }

    try {
      const result = await new ModelSyncService(env).sync();
      logger.info("model_sync.finished", { ...result });
    } catch (error) {
      logger.error("model_sync.failed", { message: error instanceof Error ? error.message : String(error) });
    }
  },
} satisfies ExportedHandler<Env>;

export { RaisWorkflowRun } from "./engine/runner";
