import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createRating,
  listVisibleRatingsForUser,
  rejectRating,
  resolveRating,
} from "../../db/repositories/ratings";

const ratings = new Hono<AppEnv>();
ratings.use("*", requireAuth);

const createSchema = z.object({
  jobId: z.string(),
  rateeUserId: z.string(),
  score: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

ratings.post("/", async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const rating = await createRating(db, { ...body, raterUserId: session.userId });
  return c.json(rating, 201);
});

ratings.get("/for-user/:userId", async (c) => {
  const db = await createDb(c.env);
  return c.json(await listVisibleRatingsForUser(db, c.req.param("userId")));
});

const rejectSchema = z.object({ reason: z.string().min(1) });

/** Any party can reject a rating they received — see CLAUDE.md "Ratings". */
ratings.post("/:id/reject", async (c) => {
  const body = rejectSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await rejectRating(db, c.req.param("id"), body.reason);
  return c.json({ ok: true });
});

const resolveSchema = z.object({ outcome: z.string().min(1) });

ratings.post("/:id/resolve", requireRole("admin"), async (c) => {
  const session = c.get("session")!;
  const body = resolveSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await resolveRating(db, c.req.param("id"), session.userId, body.outcome);
  return c.json({ ok: true });
});

export default ratings;
