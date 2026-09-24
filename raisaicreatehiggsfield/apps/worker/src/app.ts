import { Hono } from "hono";
import { AppError } from "@raisai/shared";
import type { Env } from "./env";
import { requestId } from "./middleware/request-id";
import { attachAuth, type AuthVariables } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { billing } from "./routes/billing";
import { models } from "./routes/models";
import { projects } from "./routes/projects";
import { generations } from "./routes/generations";
import { assets } from "./routes/assets";
import { templates } from "./routes/templates";
import { workflows } from "./routes/workflows";
import { workflowRuns } from "./routes/workflow-runs";
import { credentials } from "./routes/credentials";
import { mcp } from "./routes/mcp";
import { usage } from "./routes/usage";
import { adminModels } from "./routes/admin-models";
import { webhooks } from "./routes/webhooks";
import { openapi } from "./routes/openapi";
import { movies } from "./routes/movies";
import { hooks, publicHooks } from "./routes/hooks";
import { search } from "./routes/search";
import { members } from "./routes/members";
import { cast } from "./routes/cast";
import { connectors } from "./routes/connectors";
import { studio } from "./routes/studio";
import { publicRoutes } from "./routes/public";
import { DEFAULT_RULES, rateLimit } from "./middleware/rate-limit";
import { createStubAI } from "./test-ai";
import { attachDb } from "./db/client";
import { ScheduleService } from "./services/schedule-service";
import { ModelSyncService } from "./services/model-sync-service";

export type AppEnv = { Bindings: Env; Variables: AuthVariables };

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", requestId());
  // Postgres (via Hyperdrive) client, shaped like the old D1Database so the
  // repositories/services below didn't need to change their query API.
  // getDb() builds a fresh postgres.js client every call (see db/client.ts
  // — a cached client is an I/O object Workers forbids reusing across
  // requests), and this middleware runs unconditionally on every request,
  // so `env.DB` is always this request's own client.
  app.use("*", async (c, next) => {
    attachDb(c.env);
    await next();
  });
  // The browser smoke test runs the real stack against a stubbed model so it
  // never calls a provider or spends money.
  app.use("*", async (c, next) => {
    if (c.env.APP_ENV === "e2e") {
      (c.env as { AI: Ai }).AI = createStubAI();
    }
    await next();
  });
  app.onError(errorHandler);

  // Replaces the Workers Cron Trigger (moved to Ubuntu cron). Same jobs
  // scheduled() used to run nightly.
  //
  // Retries once on failure: the Hyperdrive/postgres.js client is cached at
  // module scope per Hyperdrive's own guidance (db/client.ts), which means
  // the very first query after a cold start can race the pool's initial
  // connection setup and throw "Cannot perform I/O on behalf of a different
  // request" or a spurious "relation does not exist" — both clear up on the
  // next query against the now-warm pool. A cron endpoint that fires
  // infrequently hits this far more often than user traffic does.
  app.post("/internal/cron", async (c) => {
    if (c.req.header("X-Cron-Secret") !== c.env.CRON_SECRET) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const run = async () => {
      const schedules = await new ScheduleService(c.env).runDue();
      const sync = await new ModelSyncService(c.env).sync();
      return { schedules, sync };
    };
    try {
      return c.json({ ok: true, ...(await run()) });
    } catch (firstError) {
      console.error("internal-cron.retrying", firstError);
      try {
        return c.json({ ok: true, ...(await run()) });
      } catch (error) {
        console.error("internal-cron.failed", error);
        return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
      }
    }
  });

  const api = new Hono<AppEnv>();
  api.use("*", attachAuth());
  // Broad ceiling for every API call, with tighter buckets on the routes that
  // cost money or start work (§107).
  api.use("*", rateLimit(DEFAULT_RULES.api));
  api.use("/generations", rateLimit(DEFAULT_RULES.generations));
  api.use("/workflows/:id/run", rateLimit(DEFAULT_RULES.runs));
  api.use("/templates/:id/execute", rateLimit(DEFAULT_RULES.runs));
  api.use("/studios/:type/run", rateLimit(DEFAULT_RULES.generations));
  api.use("/assets", rateLimit(DEFAULT_RULES.uploads));
  api.route("/", health);
  // /auth/* is exempt from the CSRF double-submit check: signup/login have no
  // session yet to carry a CSRF cookie. Protected mutating routes added from
  // task 0.4.2 onward should mount behind `requireCsrf()`.
  api.route("/auth", auth);
  api.route("/", billing);
  api.route("/", models);
  api.route("/", projects);
  api.route("/", generations);
  api.route("/", assets);
  api.route("/", templates);
  api.route("/", workflows);
  api.route("/", workflowRuns);
  api.route("/", credentials);
  api.route("/", mcp);
  api.route("/", usage);
  api.route("/", adminModels);
  api.route("/", webhooks);
  api.route("/", openapi);
  api.route("/", movies);
  api.route("/", hooks);
  api.route("/", search);
  api.route("/", members);
  api.route("/", cast);
  api.route("/", connectors);
  api.route("/", studio);
  api.route("/", publicRoutes);

  // Test-only helper so the browser smoke test can set itself up the way an
  // operator would. Guarded by APP_ENV, so it cannot exist in production.
  api.post("/e2e/promote", async (c) => {
    if (c.env.APP_ENV !== "e2e") {
      return c.json(new AppError("not_found", "No route for POST /e2e/promote.").toJSON(), 404);
    }
    const auth = c.get("auth");
    if (!auth) return c.json(new AppError("unauthorized", "Sign in first.").toJSON(), 401);
    await c.env.DB.prepare(`UPDATE users SET role='admin' WHERE id = ?`).bind(auth.userId).run();
    return c.json({ promoted: true });
  });
  api.all("*", (c) => c.json(new AppError("not_found", `No route for ${c.req.method} ${c.req.path}.`).toJSON(), 404));

  app.route("/api/v1", api);

  // Public webhook ingress lives outside /api/v1: it is addressed by a secret
  // token rather than authenticated, and is not part of the customer API.
  publicHooks.use("*", attachAuth());
  app.route("/", publicHooks);

  // Everything else is the SPA (served by the assets binding when built).
  app.get("*", async (c) => {
    if (c.env.WEB) return c.env.WEB.fetch(c.req.raw);
    return c.text("RaisAI Create API. Web build not present.", 200);
  });
  return app;
}
