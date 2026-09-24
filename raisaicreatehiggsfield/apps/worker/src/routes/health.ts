import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables } from "../middleware/request-id";

export const health = new Hono<{ Bindings: Env; Variables: AppVariables }>();

health.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV, requestId: c.get("requestId") }));
