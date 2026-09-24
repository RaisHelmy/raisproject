import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const databaseRoutes = new Hono();

databaseRoutes.get("/databases", async (c) => {
  try {
    return ok(c, await getRunForge().databases.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

databaseRoutes.post("/databases", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().databases.create(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

databaseRoutes.get("/databases/:id", async (c) => {
  try {
    return ok(c, await getRunForge().databases.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

databaseRoutes.get("/databases/:id/health", async (c) => {
  try {
    return ok(c, await getRunForge().databases.getHealth(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

databaseRoutes.post("/databases/:id/query", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().databases.runQuery(requireAuth(c), c.req.param("id"), body.sql));
  } catch (err) {
    return fail(c, err);
  }
});

databaseRoutes.post("/databases/:id/delete", async (c) => {
  try {
    await getRunForge().databases.remove(requireAuth(c), c.req.param("id"));
    return ok(c, { deleted: true });
  } catch (err) {
    return fail(c, err);
  }
});
