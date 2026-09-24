import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { acknowledgeSos, listOpenSosIncidents, resolveSos, triggerSos } from "../../db/repositories/sos";
import { getDurableObjectStub } from "../durableObjects/liveLocationRoom";

const sos = new Hono<AppEnv>();
sos.use("*", requireAuth);

const triggerSchema = z.object({
  jobId: z.string(),
  lastKnownLat: z.string().optional(),
  lastKnownLng: z.string().optional(),
});

/**
 * SOS never silently fails (CLAUDE.md "Emergency (SOS)"): the incident row
 * is written first — that's the source of truth for admin's queue — and
 * only then do we best-effort tell the job's live-location Durable Object
 * to keep tracking past the job's terminal state. If that second step
 * throws, the incident still exists and this still returns success to the
 * caller; it does not roll back the incident.
 */
sos.post("/trigger", async (c) => {
  const session = c.get("session")!;
  const body = triggerSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const incident = await triggerSos(db, { ...body, triggeredByUserId: session.userId });

  try {
    const stub = getDurableObjectStub(c.env, body.jobId);
    await stub.fetch("https://do/extend-tracking", { method: "POST" });
  } catch (err) {
    console.error("failed to extend live tracking after SOS", err);
  }

  return c.json(incident, 201);
});

sos.get("/open", requireRole("admin"), async (c) => {
  const db = await createDb(c.env);
  return c.json(await listOpenSosIncidents(db));
});

sos.post("/:id/acknowledge", requireRole("admin"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  await acknowledgeSos(db, c.req.param("id"), session.userId);
  return c.json({ ok: true });
});

const resolveSchema = z.object({ note: z.string().min(1) });

sos.post("/:id/resolve", requireRole("admin"), async (c) => {
  const session = c.get("session")!;
  const body = resolveSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await resolveSos(db, c.req.param("id"), session.userId, body.note);
  return c.json({ ok: true });
});

export default sos;
