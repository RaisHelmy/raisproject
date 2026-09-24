import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const serverRoutes = new Hono();

serverRoutes.get("/servers", async (c) => {
  try {
    return ok(c, await getRunForge().servers.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.post("/servers", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().servers.connect(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.get("/servers/:id", async (c) => {
  try {
    return ok(c, await getRunForge().servers.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.get("/servers/:id/metrics", async (c) => {
  try {
    return ok(c, await getRunForge().servers.getMetrics(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.get("/servers/:id/services", async (c) => {
  try {
    return ok(c, await getRunForge().servers.listServices(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.get("/servers/:id/applications", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const apps = await rf.applications.list(ctx);
    return ok(c, apps.filter((a) => a.serverId === c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.get("/servers/:id/containers", async (c) => {
  try {
    return ok(c, await getRunForge().containers.list(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.post("/servers/:id/restart-agent", async (c) => {
  try {
    await getRunForge().servers.restartAgent(requireAuth(c), c.req.param("id"));
    return ok(c, { restarted: true });
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.post("/servers/:id/remove", async (c) => {
  try {
    await getRunForge().servers.remove(requireAuth(c), c.req.param("id"));
    return ok(c, { removed: true });
  } catch (err) {
    return fail(c, err);
  }
});

serverRoutes.post("/services/:id/:action", async (c) => {
  try {
    const action = c.req.param("action") as "start" | "stop" | "restart" | "enable" | "disable";
    return ok(c, await getRunForge().servers.controlService(requireAuth(c), c.req.param("id"), action));
  } catch (err) {
    return fail(c, err);
  }
});
