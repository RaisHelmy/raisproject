import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const miscRoutes = new Hono();

miscRoutes.get("/search", async (c) => {
  try {
    const q = c.req.query("q") ?? "";
    return ok(c, await getRunForge().search.search(requireAuth(c), q));
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/graph", async (c) => {
  try {
    return ok(c, await getRunForge().graph.build(requireAuth(c), c.req.query("applicationId") ?? undefined));
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/templates", async (c) => {
  try {
    const rf = getRunForge();
    const kind = c.req.query("kind") as "application" | "infrastructure" | "database" | undefined;
    return ok(c, (await rf.catalog?.listTemplates(kind)) ?? []);
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/me", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const [user, org] = await Promise.all([rf.auth.currentUser(ctx), rf.organizations.get(ctx)]);
    return ok(c, { user, organization: org, role: ctx.role, permissionLevel: rf.permissions.effectiveLevel(ctx) });
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/team", async (c) => {
  try {
    return ok(c, await getRunForge().organizations.listMembers(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.post("/team/invite", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().organizations.invite(requireAuth(c), body), {}, 201);
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.post("/team/:id/role", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().organizations.changeRole(requireAuth(c), c.req.param("id"), body.role));
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/git/repositories", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    return ok(c, await rf.registry.git().listRepositories(ctx.organizationId));
  } catch (err) {
    return fail(c, err);
  }
});

miscRoutes.get("/git/branches", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const repo = c.req.query("repository") ?? "";
    return ok(c, await rf.registry.git().listBranches(ctx.organizationId, repo));
  } catch (err) {
    return fail(c, err);
  }
});
