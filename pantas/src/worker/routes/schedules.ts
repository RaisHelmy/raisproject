import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import {
  createSchedule,
  listSchedulesForPurchaser,
  setScheduleStatus,
} from "../../db/repositories/rideSchedules";

const schedules = new Hono<AppEnv>();
schedules.use("*", requireRole("purchaser"));

const dayCode = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const createSchema = z.object({
  jobType: z.enum(["food_order", "item_order", "fetch", "delivery", "ride"]),
  daysOfWeek: z.array(dayCode).min(1),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  poolPreferred: z.boolean().optional(),
  preferredRunnerUserId: z.string().optional(),
  deliveryFeeMinor: z.number().int().positive(),
  paymentMethod: z.enum(["cash", "gateway"]),
  leadTimeMinutes: z.number().int().positive().optional(),
});

/** "Ride to work and back, pool or non-pool" recurring booking — CLAUDE.md "Scheduling & subscriptions". */
schedules.post("/", async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const schedule = await createSchedule(db, {
    groupId: session.groupId,
    purchaserUserId: session.userId,
    ...body,
  });
  return c.json(schedule, 201);
});

schedules.get("/mine", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listSchedulesForPurchaser(db, session.userId));
});

const statusSchema = z.object({ status: z.enum(["active", "paused", "cancelled"]) });

schedules.post("/:id/status", async (c) => {
  const body = statusSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await setScheduleStatus(db, c.req.param("id"), body.status);
  return c.json({ ok: true });
});

export default schedules;
