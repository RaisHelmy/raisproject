import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const containerRoutes = new Hono();

containerRoutes.get("/containers", async (c) => {
  try {
    return ok(c, await getRunForge().containers.list(requireAuth(c), c.req.query("serverId") ?? undefined));
  } catch (err) {
    return fail(c, err);
  }
});

containerRoutes.get("/containers/:id", async (c) => {
  try {
    return ok(c, await getRunForge().containers.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

for (const action of ["start", "stop", "restart", "pause"] as const) {
  containerRoutes.post(`/containers/:id/${action}`, async (c) => {
    try {
      const rf = getRunForge();
      const ctx = requireAuth(c);
      const id = c.req.param("id");
      const result = action === "start" ? await rf.containers.start(ctx, id) : action === "stop" ? await rf.containers.stop(ctx, id) : action === "pause" ? await rf.containers.pause(ctx, id) : await rf.containers.restart(ctx, id);
      return ok(c, result);
    } catch (err) {
      return fail(c, err);
    }
  });
}

containerRoutes.post("/containers/:id/remove", async (c) => {
  try {
    await getRunForge().containers.remove(requireAuth(c), c.req.param("id"));
    return ok(c, { removed: true });
  } catch (err) {
    return fail(c, err);
  }
});
