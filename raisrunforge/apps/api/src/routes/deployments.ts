import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const deploymentRoutes = new Hono();

deploymentRoutes.get("/deployments", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const applicationId = c.req.query("applicationId") ?? undefined;
    const projectId = c.req.query("projectId") ?? undefined;
    return ok(c, await rf.deployments.list(ctx, { applicationId, projectId }));
  } catch (err) {
    return fail(c, err);
  }
});

deploymentRoutes.get("/deployments/:id", async (c) => {
  try {
    return ok(c, await getRunForge().deployments.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

deploymentRoutes.post("/deployments/:id/cancel", async (c) => {
  try {
    return ok(c, await getRunForge().deployments.cancel(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});
