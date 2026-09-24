import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { buildDashboard } from "../services/dashboard";
import { toNotificationDTO, toReportJobDTO } from "../services/mappers";
import { isApprover } from "../services/context";
import { buildReportData, renderPdf, renderXlsx, reportPreview, simplifyReportData } from "../services/reports/builder";
import { uuid } from "../lib/ids";
import { nowIso } from "../lib/time";
import { audit } from "../services/audit";
import { getJiraClient } from "../services/jira/factory";
import { aiIsDemo, aiIsExternal } from "../services/ai";
import type { HealthDTO, ReportParams, SearchResultDTO } from "@rais/shared-types";
import { getDb } from "../db/client";

export const dashboard = new Hono<HonoEnv>();
dashboard.get("/", requireAuth, async (c) => ok(c, await buildDashboard(c.get("ctx"))));

export const notifications = new Hono<HonoEnv>();
notifications.use("*", requireAuth);
notifications.get("/", async (c) => {
  const ctx = c.get("ctx");
  const page = parsePage(c.req.query(), 20);
  const r = await ctx.repos.notifications.list(ctx.user!.id, { offset: page.offset, limit: page.page_size }, c.req.query("unread") === "1");
  return ok(c, { items: r.items.map(toNotificationDTO), total: r.total, unread: r.unread, page: page.page, page_size: page.page_size });
});
notifications.post("/read", async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ ids: z.union([z.array(z.string()), z.literal("all")]) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Provide ids or 'all'.");
  await ctx.repos.notifications.markRead(ctx.user!.id, body.data.ids);
  return ok(c, { marked: true });
});

export const search = new Hono<HonoEnv>();
search.get("/", requireAuth, rateLimit(60, 60, "search"), async (c) => {
  const ctx = c.get("ctx");
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return ok(c, [] as SearchResultDTO[]);
  const rows = await ctx.repos.search(q, ctx.user!.id, isApprover(ctx.user));
  const linkFor = (r: { type: string; id: string }) => r.type === "timesheet" ? `/timesheets/${r.id}` : r.type === "jira" ? `/jira/tasks/${r.id}` : r.type === "import" ? `/imports/${r.id}` : r.type === "project" ? `/settings/projects` : "/";
  return ok(c, rows.map((r) => ({ ...r, type: r.type as SearchResultDTO["type"], link: linkFor(r) })));
});

// ---------- reports ----------
export const reports = new Hono<HonoEnv>();
reports.use("*", requireAuth);

const ParamsSchema = z.object({
  type: z.enum(["TIMESHEET_SUMMARY", "DETAILED_TIMESHEET", "JIRA_RECONCILIATION", "DELAYED_TASKS", "PROJECT_WORKLOAD", "HR_TIMESHEET"]),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  project_id: z.string().nullable().optional(), client_id: z.string().nullable().optional(), user_id: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).nullable().optional(),
  jira_sync_status: z.enum(["NOT_LINKED", "MATCH_SUGGESTED", "LINKED", "READY_TO_PUSH", "PUSHING", "SYNCED", "SYNC_FAILED"]).nullable().optional(),
  delayed_only: z.boolean().optional(),
  simplified: z.boolean().optional(),
});

function paramsFromQuery(q: Record<string, string | undefined>): ReportParams {
  const r = ParamsSchema.safeParse({ type: q.type ?? "TIMESHEET_SUMMARY", date_from: q.date_from, date_to: q.date_to, project_id: q.project_id || null, client_id: q.client_id || null, user_id: q.user_id || null, status: q.status || null, jira_sync_status: q.jira_sync_status || null, simplified: q.simplified === "1" || q.simplified === "true" });
  if (!r.success) throw Errors.validation("Please choose a report type and a valid date range.", r.error.issues);
  return r.data;
}

reports.get("/preview", async (c) => ok(c, await reportPreview(c.get("ctx"), paramsFromQuery(c.req.query()))));
reports.get("/data", async (c) => { const p = paramsFromQuery(c.req.query()); const d = await buildReportData(c.get("ctx"), p); return ok(c, p.type === "HR_TIMESHEET" && p.simplified ? simplifyReportData(d) : d); });

reports.get("/", async (c) => {
  const ctx = c.get("ctx");
  const page = parsePage(c.req.query());
  const r = await ctx.repos.reports.list(isApprover(ctx.user) && c.req.query("all") === "1" ? null : ctx.user!.id, { offset: page.offset, limit: page.page_size });
  return ok(c, { items: r.items.map(toReportJobDTO), total: r.total, page: page.page, page_size: page.page_size });
});

reports.post("/", rateLimit(20, 600, "reports"), async (c) => {
  const ctx = c.get("ctx");
  const body = ParamsSchema.extend({ format: z.enum(["XLSX", "PDF"]) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please choose a report type, format and a valid date range.", body.error.issues);
  const { format, ...params } = body.data;
  const id = uuid();
  const now = nowIso();
  await ctx.repos.reports.create({ id, user_id: ctx.user!.id, type: params.type, format, params_json: JSON.stringify(params), status: "RUNNING", r2_key: null, row_count: null, error_message: null, created_at: now, completed_at: null });
  try {
    const raw = await buildReportData(ctx, params);
    const data = params.type === "HR_TIMESHEET" && params.simplified ? simplifyReportData(raw) : raw;
    const bytes = format === "XLSX" ? renderXlsx(data) : renderPdf(data);
    const key = `reports/${now.slice(0, 4)}/${now.slice(5, 7)}/${id}.${format.toLowerCase()}`;
    await ctx.env.FILES.put(key, bytes, { httpMetadata: { contentType: format === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf" }, customMetadata: { user_id: ctx.user!.id, report_id: id } });
    await ctx.repos.reports.update(id, { status: "COMPLETED", r2_key: key, row_count: data.timesheets.length, completed_at: nowIso() });
    await audit(ctx, { entity_type: "report", entity_id: id, action: "generated", after: { type: params.type, format, period: [params.date_from, params.date_to], rows: data.timesheets.length } });
  } catch (e) {
    ctx.log.error("report_failed", { error: e });
    await ctx.repos.reports.update(id, { status: "FAILED", error_message: e instanceof Error ? e.message.slice(0, 300) : "Failed", completed_at: nowIso() });
    if (e instanceof Error && e.name === "AppError") throw e;
    throw Errors.internal(`RPT-${id.slice(0, 8).toUpperCase()}`);
  }
  return ok(c, toReportJobDTO((await ctx.repos.reports.findById(id))!), undefined, 201);
});

reports.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const r = await ctx.repos.reports.findById(c.req.param("id"));
  if (!r || (r.user_id !== ctx.user!.id && !isApprover(ctx.user))) throw Errors.notFound("Report");
  return ok(c, toReportJobDTO(r));
});

reports.get("/:id/download", async (c) => {
  const ctx = c.get("ctx");
  const r = await ctx.repos.reports.findById(c.req.param("id"));
  if (!r || (r.user_id !== ctx.user!.id && !isApprover(ctx.user))) throw Errors.notFound("Report");
  if (!r.r2_key || r.status !== "COMPLETED") throw Errors.invalidState("This report is not available for download.");
  const obj = await ctx.env.FILES.get(r.r2_key);
  if (!obj) throw Errors.notFound("Report file");
  const p = JSON.parse(r.params_json) as ReportParams;
  const name = `rais-timesheet-${r.type.toLowerCase().replace(/_/g, "-")}-${p.date_from}-to-${p.date_to}.${r.format.toLowerCase()}`;
  await audit(ctx, { entity_type: "report", entity_id: r.id, action: "downloaded" });
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
});

// ---------- health ----------
export const health = new Hono<HonoEnv>();

health.get("/health", async (c) => {
  const ctx = c.get("ctx");
  return ok(c, { status: "ok", version: ctx.env.APP_VERSION, time: nowIso() });
});

health.get("/ready", async (c) => {
  const ctx = c.get("ctx");
  const checks: HealthDTO["checks"] = {};
  try { const hdb = getDb(ctx.env); try { await hdb.prepare("SELECT 1").first(); } finally { ctx.waitUntil(hdb.close().catch(() => undefined)); } checks.database = { status: "healthy" }; } catch (e) { checks.database = { status: "degraded", detail: "Database query failed" }; }
  try { await ctx.env.FILES.head("__health__"); checks.storage = { status: "healthy" }; } catch { checks.storage = { status: "degraded", detail: "R2 not reachable" }; }
  checks.queue = ctx.env.JOB_MODE === "inline" ? { status: "healthy", detail: "inline mode" } : ctx.env.JOBS ? { status: "healthy" } : { status: "unconfigured" };
  checks.ai = aiIsExternal(ctx.env) ? { status: "healthy", detail: "External — Claude via MCP" } : aiIsDemo(ctx.env) ? { status: "unconfigured", detail: "Heuristic demo provider active" } : { status: "healthy", detail: `Anthropic ${ctx.env.AI_MODEL}` };
  const conn = await ctx.repos.jira.activeConnection().catch(() => null);
  checks.jira = conn ? { status: conn.status === "HEALTHY" ? "healthy" : "degraded", detail: conn.last_error ?? undefined, last_ok_at: conn.last_ok_at } : { status: "unconfigured", detail: "Demo mode active" };
  const degraded = Object.values(checks).some((x) => x.status === "degraded");
  const body: HealthDTO = { status: degraded ? "degraded" : "ok", checks, demo_mode: { ai: aiIsDemo(ctx.env), jira: !conn || ctx.env.JIRA_MODE === "demo" }, version: ctx.env.APP_VERSION };
  return c.json({ success: true, data: body }, degraded ? 503 : 200);
});

health.get("/admin/health", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  if (!isApprover(ctx.user)) throw Errors.forbidden();
  const handle = await getJiraClient(ctx);
  const test = await handle.client.testConnection().catch((e: Error) => ({ ok: false, account: null, error: e.message }));
  const checks: HealthDTO["checks"] = {};
  try { const hdb = getDb(ctx.env); try { await hdb.prepare("SELECT 1").first(); } finally { ctx.waitUntil(hdb.close().catch(() => undefined)); } checks.application = { status: "healthy" }; checks.database = { status: "healthy" }; } catch { checks.database = { status: "degraded" }; }
  try { await ctx.env.FILES.head("__health__"); checks.r2 = { status: "healthy" }; } catch { checks.r2 = { status: "degraded" }; }
  checks.queue = ctx.env.JOB_MODE === "inline" ? { status: "healthy", detail: "Inline job mode (local development)" } : { status: "healthy", detail: "Cloudflare Queue" };
  checks.ai = aiIsExternal(ctx.env) ? { status: "healthy", detail: "External — Claude via MCP" } : aiIsDemo(ctx.env) ? { status: "unconfigured", detail: "Heuristic demo provider — set ANTHROPIC_API_KEY for Claude" } : { status: "healthy", detail: `Anthropic · ${ctx.env.AI_MODEL}` };
  checks.jira = handle.demo ? { status: "unconfigured", detail: "Demo adapter — connect Jira under Settings → Jira Connection" } : test.ok ? { status: "healthy", detail: `${handle.connection?.site_url}`, last_ok_at: nowIso() } : { status: "degraded", detail: test.error ?? "Connection failed", last_ok_at: handle.connection?.last_ok_at ?? null };
  return ok(c, { status: Object.values(checks).some((x) => x.status === "degraded") ? "degraded" : "ok", checks, demo_mode: { ai: aiIsDemo(ctx.env), jira: handle.demo }, version: ctx.env.APP_VERSION } satisfies HealthDTO);
});
