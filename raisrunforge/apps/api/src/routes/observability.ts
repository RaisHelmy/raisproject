import { Hono } from "hono";
import type { LogSeverity, MetricName, MetricRange } from "@runforge/shared";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

export const observabilityRoutes = new Hono();

observabilityRoutes.get("/logs", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const severityParam = c.req.query("severity");
    const logs = await rf.monitoring.queryLogs(ctx, {
      search: c.req.query("search") ?? undefined,
      severity: severityParam ? (severityParam.split(",") as LogSeverity[]) : undefined,
      service: c.req.query("service") ?? undefined,
      serverId: c.req.query("serverId") ?? undefined,
      applicationId: c.req.query("applicationId") ?? undefined,
      deploymentId: c.req.query("deploymentId") ?? undefined,
      environment: c.req.query("environment") ?? undefined,
      since: c.req.query("since") ?? undefined,
      after: c.req.query("after") ?? undefined,
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    });
    return ok(c, logs);
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/logs/services", async (c) => {
  try {
    return ok(c, await getRunForge().monitoring.listLogServices(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/metrics", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const resourceType = (c.req.query("resourceType") ?? "server") as "server" | "application" | "database" | "organization";
    const resourceId = c.req.query("resourceId") ?? "";
    const names = (c.req.query("names") ?? "cpu").split(",") as MetricName[];
    const range = (c.req.query("range") ?? "1h") as MetricRange;
    return ok(c, await rf.monitoring.queryMetrics(ctx, { resourceType, resourceId, names, range }));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/events", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    return ok(c, await rf.events.list(ctx, {
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
      resourceType: c.req.query("resourceType") ?? undefined,
      resourceId: c.req.query("resourceId") ?? undefined,
      projectId: c.req.query("projectId") ?? undefined,
    }));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/audit-logs", async (c) => {
  try {
    return ok(c, await getRunForge().events.listAudit(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/incidents", async (c) => {
  try {
    return ok(c, await getRunForge().incidents.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/incidents/:id", async (c) => {
  try {
    return ok(c, await getRunForge().incidents.get(requireAuth(c), c.req.param("id")));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.post("/incidents/:id/status", async (c) => {
  try {
    const body = await c.req.json();
    return ok(c, await getRunForge().incidents.updateStatus(requireAuth(c), c.req.param("id"), body.status));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/jobs", async (c) => {
  try {
    return ok(c, await getRunForge().jobs.list(requireAuth(c)));
  } catch (err) {
    return fail(c, err);
  }
});

observabilityRoutes.get("/jobs/:id", async (c) => {
  try {
    const job = await getRunForge().jobs.get(requireAuth(c), c.req.param("id"));
    if (!job) return c.json({ error: { code: "NOT_FOUND", message: "Job not found" } }, 404);
    return ok(c, job);
  } catch (err) {
    return fail(c, err);
  }
});
