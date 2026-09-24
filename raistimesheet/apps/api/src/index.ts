import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, QueueJob } from "./env";
import { appContext, authenticate, csrf, errorHandler, notFoundHandler, webOrigins, type HonoEnv } from "./middleware";
import { getDb } from "./db/client";
import { handleQueueBatch, handleScheduled, runJob, systemContext } from "./jobs";
import { sweepDueSyncJobs } from "./services/jira/sync";
import { applyRetention } from "./services/retention";
import { correlationId } from "./lib/ids";
import authRoutes from "./routes/auth";
import orgRoutes from "./routes/org";
import importRoutes from "./routes/imports";
import timesheetRoutes from "./routes/timesheets";
import jiraRoutes from "./routes/jira";
import { dashboard, health, notifications, reports, search } from "./routes/misc";

const app = new Hono<HonoEnv>();

app.use("*", secureHeaders({ contentSecurityPolicy: undefined, crossOriginEmbedderPolicy: false }));
app.use("/api/*", async (c, next) => {
  // WEB_ORIGIN (custom domain) + WEB_ORIGINS_EXTRA (*.pages.dev alias) +
  // localhost:5173 (Vite dev) — see webOrigins() in middleware.
  return cors({ origin: webOrigins(c.env), credentials: true, allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"], exposeHeaders: ["X-Request-Id"] })(c, next);
});
app.use("*", appContext(runJob));
app.use("/api/*", authenticate);
app.use("/api/*", csrf);

app.route("/api", health);
app.route("/api/auth", authRoutes);
app.route("/api", orgRoutes);
app.route("/api/imports", importRoutes);
app.route("/api/timesheets", timesheetRoutes);
app.route("/api/approvals", timesheetRoutes); // same handlers; approvers filter with scope=all&status=SUBMITTED
app.route("/api/jira", jiraRoutes);
app.route("/api/dashboard", dashboard);
app.route("/api/notifications", notifications);
app.route("/api/search", search);
app.route("/api/reports", reports);

// Replaces the Workers Cron Triggers (moved to Ubuntu cron). Same jobs
// handleScheduled() used to dispatch by cron string.
app.post("/internal/cron/:job", async (c) => {
  if (c.req.header("X-Cron-Secret") !== c.env.CRON_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const ctx = systemContext(c.env, correlationId("cron"), (p) => c.executionCtx.waitUntil(p), db);
  const job = c.req.param("job");
  try {
    if (job === "sync-sweep") {
      const n = await sweepDueSyncJobs(ctx);
      return c.json({ ok: true, jobs: n });
    } else if (job === "retention") {
      const r = await applyRetention(ctx);
      return c.json({ ok: true, ...r });
    }
    return c.json({ error: "unknown job" }, 400);
  } finally {
    c.executionCtx.waitUntil(db.close().catch(() => undefined));
  }
});

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<QueueJob>, env: Bindings) => handleQueueBatch(batch, env),
  scheduled: (event: ScheduledController, env: Bindings, ctx: ExecutionContext) => handleScheduled(event, env, ctx),
} satisfies ExportedHandler<Bindings, QueueJob>;
