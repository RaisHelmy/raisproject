import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth, requireRole } from "../middleware/auth";
import { getDurableObjectStub } from "../durableObjects/liveLocationRoom";

const gps = new Hono<AppEnv>();
gps.use("*", requireAuth);

const pushSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

/** Runner app streams location while a job is active — CLAUDE.md "Jobs and matching". */
gps.post("/:jobId/push", requireRole("runner"), async (c) => {
  const stub = getDurableObjectStub(c.env, c.req.param("jobId"));
  const body = pushSchema.parse(await c.req.json());
  const res = await stub.fetch("https://do/push-location", {
    method: "POST",
    body: JSON.stringify({ ...body, ts: new Date().toISOString() }),
  });
  return new Response(res.body, { status: res.status });
});

gps.get("/:jobId/latest", async (c) => {
  const stub = getDurableObjectStub(c.env, c.req.param("jobId"));
  const res = await stub.fetch("https://do/latest");
  return new Response(res.body, { status: res.status });
});

/** Retained track, for dispute evidence — CLAUDE.md "Jobs and matching". */
gps.get("/:jobId/history", async (c) => {
  const stub = getDurableObjectStub(c.env, c.req.param("jobId"));
  const res = await stub.fetch("https://do/history");
  return new Response(res.body, { status: res.status });
});

/** Purchaser's live map subscribes here. */
gps.get("/:jobId/stream", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.json({ error: "expected websocket upgrade" }, 426);
  }
  const stub = getDurableObjectStub(c.env, c.req.param("jobId"));
  return stub.fetch("https://do/stream", c.req.raw);
});

export default gps;
