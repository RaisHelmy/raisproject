import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import { confirmPoolLeg, joinPool, listLegsForJob } from "../../db/repositories/jobPoolLegs";

const pool = new Hono<AppEnv>();

const joinSchema = z.object({
  jobId: z.string(),
  pickupNote: z.string().optional(),
  dropoffNote: z.string().optional(),
  fareMinor: z.number().int().positive(),
});

/**
 * MVP carpool: manual join on an already-poolEnabled ride, not automatic
 * route-matching — CLAUDE.md "Carpool (pooled rides)".
 */
pool.post("/join", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const body = joinSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const leg = await joinPool(db, { ...body, purchaserUserId: session.userId });
  return c.json(leg, 201);
});

pool.get("/for-job/:jobId", async (c) => {
  const db = await createDb(c.env);
  return c.json(await listLegsForJob(db, c.req.param("jobId")));
});

pool.post("/legs/:id/confirm", async (c) => {
  const db = await createDb(c.env);
  await confirmPoolLeg(db, c.req.param("id"));
  return c.json({ ok: true });
});

export default pool;
