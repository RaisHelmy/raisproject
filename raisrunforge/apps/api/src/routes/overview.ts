import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const overviewRoutes = new Hono();

overviewRoutes.get("/overview", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const [summary, deployments, events, incidents] = await Promise.all([
      rf.overview.summary(ctx),
      rf.deployments.list(ctx, { limit: 8 }),
      rf.events.list(ctx, { limit: 8 }),
      rf.incidents.list(ctx),
    ]);
    return ok(c, { summary, recentDeployments: deployments, recentEvents: events, activeIncidents: incidents.filter((i) => i.status !== "resolved") });
  } catch (err) {
    return fail(c, err);
  }
});
