import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const applicationRoutes = new Hono();

applicationRoutes.get("/applications", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const projectId = c.req.query("projectId") ?? undefined;
    const environment = c.req.query("environment") ?? undefined;
    return ok(c, await rf.applications.list(ctx, { projectId, environment }));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().applications.create(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.get("/applications/:id", async (c) => {
  try {
    return ok(c, await getRunForge().applications.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.get("/applications/:id/health", async (c) => {
  try {
    return ok(c, await getRunForge().applications.getHealth(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.get("/applications/:id/revisions", async (c) => {
  try {
    return ok(c, await getRunForge().applications.listRevisions(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.get("/applications/:id/environment", async (c) => {
  try {
    return ok(c, await getRunForge().applications.getEnvironment(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.put("/applications/:id/environment", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().applications.setEnvironment(requireAuth(c), c.req.param("id"), body.variables ?? body));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/deploy", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const deployment = await rf.deployments.deploy(ctx, c.req.param("id"), { ...body, trigger: body.trigger ?? "manual" });
    return ok(c, deployment, {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/restart", async (c) => {
  try {
    return ok(c, await getRunForge().applications.restart(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/stop", async (c) => {
  try {
    return ok(c, await getRunForge().applications.stop(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/start", async (c) => {
  try {
    return ok(c, await getRunForge().applications.start(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/rollback", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().applications.rollback(requireAuth(c), c.req.param("id"), body.revisionId));
  } catch (err) {
    return fail(c, err);
  }
});

applicationRoutes.post("/applications/:id/scale", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().applications.scale(requireAuth(c), c.req.param("id"), body.instances));
  } catch (err) {
    return fail(c, err);
  }
});
