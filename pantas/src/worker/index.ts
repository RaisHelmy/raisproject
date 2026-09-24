import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "./types";
import { createDb } from "../db/client";
import { auditContext } from "./middleware/auditContext";
import auth from "./routes/auth";
import vehicles from "./routes/vehicles";
import jobs from "./routes/jobs";
import offers from "./routes/offers";
import ratings from "./routes/ratings";
import sos from "./routes/sos";
import schedules from "./routes/schedules";
import vendorContracts from "./routes/vendorContracts";
import admin from "./routes/admin";
import media from "./routes/media";
import gps from "./routes/gps";
import payouts from "./routes/payouts";
import products from "./routes/products";
import vendors from "./routes/vendors";
import pool from "./routes/pool";
import gateway from "./routes/gateway";
import rentals from "./routes/rentals";
import { scheduled } from "./scheduled";
import { generateWeeklyPayouts } from "../db/services/payoutGenerator";
import { spawnScheduledJobs } from "../db/services/scheduleSpawner";
import { spawnContractOrders } from "../db/services/contractSpawner";

const app = new Hono<AppEnv>();

app.use("*", auditContext());

app.get("/api/health", (c) => {
  return c.json({ ok: true, environment: c.env.ENVIRONMENT });
});

// Verifies the Hyperdrive binding is wired correctly. Not a general-purpose
// debug endpoint — remove or gate behind admin auth once auth is trusted
// end to end.
app.get("/api/_debug/db-ping", async (c) => {
  const db = await createDb(c.env);
  const result = await db.execute(sql`select 1 as ok`);
  return c.json({ ok: true, result });
});

app.route("/api/auth", auth);
app.route("/api/vehicles", vehicles);
app.route("/api/jobs", jobs);
app.route("/api/offers", offers);
app.route("/api/ratings", ratings);
app.route("/api/sos", sos);
app.route("/api/schedules", schedules);
app.route("/api/vendor-contracts", vendorContracts);
app.route("/api/admin", admin);
app.route("/api/media", media);
app.route("/api/gps", gps);
app.route("/api/payouts", payouts);
app.route("/api/products", products);
app.route("/api/vendors", vendors);
app.route("/api/pool", pool);
app.route("/api/gateway", gateway);
app.route("/api/rentals", rentals);

// Replaces the Workers Cron Triggers (moved to Ubuntu cron). Same jobs
// scheduled.ts used to dispatch by cron string.
app.post("/api/internal/cron/:job", async (c) => {
  if (c.req.header("X-Cron-Secret") !== c.env.CRON_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const db = await createDb(c.env);
  const now = new Date();
  const job = c.req.param("job");
  if (job === "weekly-payout") {
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await generateWeeklyPayouts(db, null, periodStart, periodEnd);
  } else if (job === "daily-spawner") {
    await spawnScheduledJobs(db, now);
    await spawnContractOrders(db, now);
  } else {
    return c.json({ error: "unknown job" }, 400);
  }
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "internal error";
  return c.json({ error: message }, 400);
});

export default {
  fetch: app.fetch,
  scheduled,
};
export { LiveLocationRoom } from "./durableObjects/liveLocationRoom";
