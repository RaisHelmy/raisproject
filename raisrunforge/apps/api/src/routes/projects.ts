import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const projectRoutes = new Hono();

projectRoutes.get("/projects", async (c) => {
  try {
    return ok(c, await getRunForge().projects.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

projectRoutes.post("/projects", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().projects.create(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

projectRoutes.get("/projects/:id", async (c) => {
  try {
    return ok(c, await getRunForge().projects.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

projectRoutes.get("/projects/:id/environments", async (c) => {
  try {
    return ok(c, await getRunForge().projects.listEnvironments(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

projectRoutes.post("/projects/:id/archive", async (c) => {
  try {
    return ok(c, await getRunForge().projects.archive(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});
