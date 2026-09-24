import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const networkingRoutes = new Hono();

networkingRoutes.get("/domains", async (c) => {
  try {
    return ok(c, await getRunForge().domains.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.post("/domains", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().domains.create(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.get("/domains/:id", async (c) => {
  try {
    return ok(c, await getRunForge().domains.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.post("/domains/:id/delete", async (c) => {
  try {
    await getRunForge().domains.remove(requireAuth(c), c.req.param("id"));
    return ok(c, { deleted: true });
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.get("/dns", async (c) => {
  try {
    return ok(c, await getRunForge().domains.listDnsRecords(requireAuth(c), c.req.query("domainId") ?? undefined));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.get("/routes", async (c) => {
  try {
    return ok(c, await getRunForge().networking.listRoutes(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.post("/routes", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().networking.createRoute(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.post("/routes/:id/delete", async (c) => {
  try {
    await getRunForge().networking.deleteRoute(requireAuth(c), c.req.param("id"));
    return ok(c, { deleted: true });
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.get("/ports", async (c) => {
  try {
    return ok(c, await getRunForge().networking.listPorts(requireAuth(c), c.req.query("serverId") ?? undefined));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.post("/ports/:id/exposure", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().networking.setPortExposure(requireAuth(c), c.req.param("id"), body.exposure));
  } catch (err) {
    return fail(c, err);
  }
});

networkingRoutes.get("/tunnels", async (c) => {
  try {
    return ok(c, await getRunForge().networking.listTunnels(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});
