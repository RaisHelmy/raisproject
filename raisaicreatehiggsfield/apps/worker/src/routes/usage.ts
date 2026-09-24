import { Hono } from "hono";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { UsageService } from "../services/usage-service";

export const usage = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

usage.get("/usage", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "billing:read")) throw new AppError("insufficient_scope", "This token cannot read usage.");
  const days = c.req.query("days") ? Number(c.req.query("days")) : 30;
  const summary = await new UsageService(c.env).summary(auth, Number.isFinite(days) ? days : 30);
  return c.json({ ...summary, currency: "MYR" });
});
