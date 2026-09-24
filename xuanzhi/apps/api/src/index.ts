import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings, QueueJob } from "./env";
import { appContext, authenticate, csrf, errorHandler, notFoundHandler, webOrigins, type HonoEnv } from "./middleware";
import { handleQueueBatch, housekeeping, runJob, systemContext } from "./jobs";
import { correlationId } from "./lib/ids";
import { ok } from "./lib/http";
import authRoutes from "./routes/auth";
import catalogRoutes from "./routes/catalog";
import conversationRoutes from "./routes/conversations";
import chatRoutes from "./routes/chat";
import knowledgeRoutes from "./routes/knowledge";
import fileRoutes from "./routes/files";
import accountRoutes from "./routes/account";
import billingRoutes from "./routes/billing";
import shareRoutes from "./routes/share";
import adminRoutes from "./routes/admin";

const app = new Hono<HonoEnv>();

app.use("*", secureHeaders({ contentSecurityPolicy: undefined, crossOriginEmbedderPolicy: false }));
app.use("/api/*", async (c, next) => {
  const allowed = [...webOrigins(c.env), "http://localhost:5173", "http://localhost:4173"];
  return cors({ origin: allowed, credentials: true, allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"], exposeHeaders: ["X-Request-Id", "X-RateLimit-Remaining"] })(c, next);
});
app.use("*", appContext(runJob));
app.use("/api/*", authenticate);
app.use("/api/*", csrf);

app.get("/api/health", (c) => ok(c, { ok: true, app: c.env.APP_NAME, version: c.env.APP_VERSION, time: new Date().toISOString() }));
app.get("/api/ready", async (c) => { const ctx = c.get("ctx"); await ctx.repos.db.one(`SELECT 1 AS ok`); return ok(c, { ready: true }); });

app.route("/api/auth", authRoutes);
app.route("/api", catalogRoutes);
app.route("/api/conversations", conversationRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/account", accountRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/share", shareRoutes);
app.route("/api/admin", adminRoutes);

/** Ubuntu cron → POST /internal/cron/housekeeping with X-Cron-Secret. */
app.post("/internal/cron/:job", async (c) => {
  if (!c.env.CRON_SECRET || c.req.header("X-Cron-Secret") !== c.env.CRON_SECRET) return c.json({ error: "unauthorized" }, 401);
  const ctx = systemContext(c.env, correlationId("cron"), (p) => c.executionCtx.waitUntil(p));
  if (c.req.param("job") === "housekeeping") return c.json({ ok: true, ...(await housekeeping(ctx)) });
  return c.json({ error: "unknown job" }, 400);
});

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<QueueJob>, env: Bindings) => handleQueueBatch(batch, env),
} satisfies ExportedHandler<Bindings, QueueJob>;
