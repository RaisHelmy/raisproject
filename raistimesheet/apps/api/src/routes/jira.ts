import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth, requireRole } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { isApprover } from "../services/context";
import { getJiraClient } from "../services/jira/factory";
import { accessibleResources, authorizeUrl, exchangeCode, oauthConfigured, redirectUri } from "../services/jira/oauth";
import { JiraCloudClient } from "../services/jira/cloud";
import { encryptString, randomToken } from "../lib/crypto";
import { uuid } from "../lib/ids";
import { nowIso, todayIso } from "../lib/time";
import { audit } from "../services/audit";
import { createIssueForTimesheet, duplicateCheck, ignoreMatch, issueDefaults, linkTimesheet, reconcileAllApproved, reconcileTimesheet, refreshIssueCache, retryTimesheetSync } from "../services/jira/sync";
import { toJiraIssueDTO, toJiraLinkDTO, toSyncErrorDTO, toTimesheetDTO } from "../services/mappers";
import type { JiraConnectionDTO, ReconciliationRowDTO } from "@rais/shared-types";
import { classifyDelay } from "../lib/delay";

const router = new Hono<HonoEnv>();

// ---------- connection ----------
async function connectionDTO(c: { get(k: "ctx"): HonoEnv["Variables"]["ctx"] }): Promise<JiraConnectionDTO> {
  const ctx = c.get("ctx");
  const handle = await getJiraClient(ctx);
  const projects = (await ctx.repos.projects.list({ active_only: true })).map((p) => p.jira_project_key).filter((k): k is string => !!k);
  if (handle.demo) {
    const last = await ctx.repos.settings.get<string>("demo.jira_last_sync_at");
    return { configured: !!handle.connection, demo_mode: true, status: "DEMO", auth_type: "DEMO", site_url: handle.client.site_url, account_name: "Rais (demo)", account_id: "demo-rais", project_keys: [...new Set(projects)], last_sync_at: last, last_successful_connection_at: last, last_error: handle.connection ? handle.reason : null };
  }
  const conn = handle.connection!;
  return { configured: true, demo_mode: false, status: conn.status === "HEALTHY" ? "HEALTHY" : "DEGRADED", auth_type: conn.auth_type as "OAUTH" | "API_TOKEN", site_url: conn.site_url, account_name: conn.account_name, account_id: conn.account_id, project_keys: [...new Set(projects)], last_sync_at: conn.last_sync_at, last_successful_connection_at: conn.last_ok_at, last_error: conn.last_error };
}

router.get("/connection", requireAuth, async (c) => ok(c, { ...(await connectionDTO(c)), oauth_available: oauthConfigured(c.get("ctx").env) }));

router.post("/connection/test", requireAuth, requireRole("ADMIN"), rateLimit(10, 60, "jira-test"), async (c) => {
  const ctx = c.get("ctx");
  const handle = await getJiraClient(ctx);
  const r = await handle.client.testConnection();
  if (handle.connection) await ctx.repos.jira.updateConnection(handle.connection.id, { status: r.ok ? "HEALTHY" : "DEGRADED", last_ok_at: r.ok ? nowIso() : handle.connection.last_ok_at, last_error: r.ok ? null : r.error, updated_at: nowIso() });
  await audit(ctx, { entity_type: "jira_connection", entity_id: handle.connection?.id ?? "demo", action: "tested", after: { ok: r.ok, demo: handle.demo } });
  return ok(c, { ok: r.ok, demo: handle.demo, account: r.account ? { account_id: r.account.account_id, display_name: r.account.display_name } : null, error: r.error });
});

router.post("/connection/api-token", requireAuth, requireRole("ADMIN"), async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ site_url: z.string().url(), email: z.string().email(), api_token: z.string().min(10) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Site URL, email and API token are required.");
  if (!ctx.env.ENCRYPTION_KEY) throw Errors.validation("ENCRYPTION_KEY secret is not configured on the server.");
  const client = new JiraCloudClient({ type: "basic", site_url: body.data.site_url, email: body.data.email, api_token: body.data.api_token }, ctx.log);
  const test = await client.testConnection();
  if (!test.ok) throw Errors.validation(`Could not connect to Jira: ${test.error}`);
  await ctx.repos.jira.deactivateConnections();
  const id = uuid();
  await ctx.repos.jira.saveConnection({ id, auth_type: "API_TOKEN", site_url: body.data.site_url.replace(/\/$/, ""), cloud_id: null, account_id: test.account!.account_id, account_name: test.account!.display_name, account_email: body.data.email, access_token_enc: null, refresh_token_enc: null, api_token_enc: await encryptString(body.data.api_token, ctx.env.ENCRYPTION_KEY), token_expires_at: null, status: "HEALTHY", last_sync_at: null, last_ok_at: nowIso(), last_error: null, is_active: 1, created_at: nowIso(), updated_at: nowIso(), created_by: ctx.user!.id, updated_by: ctx.user!.id });
  await audit(ctx, { entity_type: "jira_connection", entity_id: id, action: "connected", after: { auth_type: "API_TOKEN", site_url: body.data.site_url, account: test.account!.display_name } });
  return ok(c, await connectionDTO(c), undefined, 201);
});

router.get("/oauth/start", requireAuth, requireRole("ADMIN"), async (c) => {
  const ctx = c.get("ctx");
  if (!oauthConfigured(ctx.env)) throw Errors.validation("Jira OAuth is not configured (JIRA_OAUTH_CLIENT_ID / SECRET secrets).");
  const state = randomToken(24);
  await ctx.repos.jira.saveOauthState(state, ctx.user!.id, nowIso());
  return ok(c, { url: authorizeUrl(ctx.env, state, redirectUri(ctx.env, c.req.url)) });
});

router.get("/oauth/callback", async (c) => {
  const ctx = c.get("ctx");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const web = ctx.env.WEB_ORIGIN || new URL(c.req.url).origin;
  if (!code || !state) return c.redirect(`${web}/settings/jira?error=missing_code`);
  const st = await ctx.repos.jira.consumeOauthState(state);
  if (!st || Date.parse(st.created_at) < Date.now() - 15 * 60000) return c.redirect(`${web}/settings/jira?error=invalid_state`);
  if (!ctx.env.ENCRYPTION_KEY) return c.redirect(`${web}/settings/jira?error=no_encryption_key`);
  try {
    const tokens = await exchangeCode(ctx.env, code, redirectUri(ctx.env, c.req.url));
    const sites = await accessibleResources(tokens.access_token);
    const site = sites[0];
    if (!site) return c.redirect(`${web}/settings/jira?error=no_sites`);
    const client = new JiraCloudClient({ type: "oauth", cloud_id: site.id, access_token: tokens.access_token, site_url: site.url }, ctx.log);
    const me = await client.myself();
    await ctx.repos.jira.deactivateConnections();
    const id = uuid();
    await ctx.repos.jira.saveConnection({ id, auth_type: "OAUTH", site_url: site.url, cloud_id: site.id, account_id: me.account_id, account_name: me.display_name, account_email: me.email, access_token_enc: await encryptString(tokens.access_token, ctx.env.ENCRYPTION_KEY), refresh_token_enc: tokens.refresh_token ? await encryptString(tokens.refresh_token, ctx.env.ENCRYPTION_KEY) : null, api_token_enc: null, token_expires_at: tokens.expires_at, status: "HEALTHY", last_sync_at: null, last_ok_at: nowIso(), last_error: null, is_active: 1, created_at: nowIso(), updated_at: nowIso(), created_by: st.user_id, updated_by: st.user_id });
    await audit(ctx, { entity_type: "jira_connection", entity_id: id, action: "connected", after: { auth_type: "OAUTH", site_url: site.url, account: me.display_name }, actor_id: st.user_id });
    return c.redirect(`${web}/settings/jira?connected=1`);
  } catch (e) {
    ctx.log.error("jira_oauth_failed", { error: e });
    return c.redirect(`${web}/settings/jira?error=oauth_failed`);
  }
});

/**
 * The real Jira site's projects, so an admin mapping a Rais project to a
 * Jira project key can pick an existing key instead of guessing. Without
 * this, a wrong/stale key silently syncs zero issues (JQL matches nothing)
 * with no indication that the key itself is the problem.
 */
router.get("/projects", requireAuth, requireRole("ADMIN"), async (c) => {
  const ctx = c.get("ctx");
  const handle = await getJiraClient(ctx);
  const projects = await handle.client.listProjects();
  return ok(c, { demo: handle.demo, projects: projects.map((p) => ({ key: p.key, name: p.name })) });
});

router.post("/connection/disconnect", requireAuth, requireRole("ADMIN"), async (c) => {
  const ctx = c.get("ctx");
  const conn = await ctx.repos.jira.activeConnection();
  await ctx.repos.jira.deactivateConnections();
  await audit(ctx, { entity_type: "jira_connection", entity_id: conn?.id ?? "none", action: "disconnected" });
  return ok(c, await connectionDTO(c));
});

router.post("/sync", requireAuth, rateLimit(6, 60, "jira-sync"), async (c) => {
  const ctx = c.get("ctx");
  const refreshed = await refreshIssueCache(ctx);
  const reconciled = isApprover(ctx.user) ? await reconcileAllApproved(ctx) : { reconciled: 0 };
  return ok(c, { ...refreshed, ...reconciled });
});

// ---------- issues ----------
router.get("/issues", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const q = c.req.query();
  const page = parsePage(q, 25);
  const projects = await ctx.repos.projects.list({ active_only: true, ...(isApprover(ctx.user) ? {} : { user_id: ctx.user!.id }) });
  let keys = projects.map((p) => p.jira_project_key).filter((k): k is string => !!k);
  if (q.project_key) keys = keys.filter((k) => k === q.project_key);
  if (!keys.length) return ok(c, { items: [], total: 0, page: 1, page_size: page.page_size });
  const filter = q.filter ?? "all";
  const r = await ctx.repos.jira.listIssues({ project_keys: keys, search: q.q, assignee_account_id: filter === "mine" ? ctx.user!.jira_account_id ?? "__none__" : undefined, status_category: filter === "open" ? undefined : filter === "completed" ? "done" : undefined }, { offset: 0, limit: 1000 });
  const today = todayIso(ctx.user!.timezone);
  const linkMap = new Map<string, { timesheet_id: string; reference: string; work_date: string }>();
  const { items: ts } = await ctx.repos.timesheets.list({ ...(isApprover(ctx.user) ? {} : { user_id: ctx.user!.id }), status: ["APPROVED", "SUBMITTED", "DRAFT"] }, { offset: 0, limit: 2000 });
  for (const t of ts) if (t.jira_issue_key && !linkMap.has(t.jira_issue_key)) linkMap.set(t.jira_issue_key, { timesheet_id: t.id, reference: t.reference, work_date: t.work_date });
  let dtos = r.items.map((i) => toJiraIssueDTO(i, today, linkMap.get(i.issue_key) ?? null));
  if (filter === "open") dtos = dtos.filter((d) => d.status_category !== "done");
  if (filter === "delayed") dtos = dtos.filter((d) => d.delay.state === "DELAYED");
  if (filter === "due_soon") dtos = dtos.filter((d) => d.delay.state === "AT_RISK");
  if (filter === "missing_timesheet") dtos = dtos.filter((d) => !d.timesheet_id && d.status_category !== "new");
  const total = dtos.length;
  return ok(c, { items: dtos.slice(page.offset, page.offset + page.page_size), total, page: page.page, page_size: page.page_size });
});

router.get("/issues/:key", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const key = c.req.param("key").toUpperCase();
  let row = await ctx.repos.jira.findIssue(key);
  if (!row || c.req.query("refresh") === "1") {
    const handle = await getJiraClient(ctx);
    const remote = await handle.client.getIssue(key);
    if (remote) { const { issueToRow } = await import("../services/jira/sync"); await ctx.repos.jira.upsertIssues([issueToRow(remote, handle.demo)]); row = await ctx.repos.jira.findIssue(key); }
  }
  if (!row) throw Errors.notFound("Jira task");
  const links = await ctx.repos.jira.linksForIssue(key);
  const timesheets = (await Promise.all(links.map((l) => ctx.repos.timesheets.findById(l.timesheet_id)))).filter((t) => !!t && (isApprover(ctx.user) || t.user_id === ctx.user!.id)).map((t) => toTimesheetDTO(t!));
  const today = todayIso(ctx.user!.timezone);
  return ok(c, { issue: toJiraIssueDTO(row, today, timesheets[0] ? { timesheet_id: timesheets[0].id, reference: timesheets[0].reference, work_date: timesheets[0].work_date } : null), timesheets, delay: classifyDelay({ due_date: row.due_date, resolved_at: row.resolved_at, status_category: row.status_category as "new", status: row.status, today }) });
});

// ---------- reconciliation / sync center ----------
router.get("/summary", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const scope = isApprover(ctx.user) ? {} : { user_id: ctx.user!.id };
  const counts = await ctx.repos.timesheets.countBy({ ...scope, status: "APPROVED" }, "jira_sync_status");
  const get = (k: string) => counts.find((x) => x.key === k)?.count ?? 0;
  const errors = await ctx.repos.jira.openSyncErrors({ offset: 0, limit: 1 });
  const approved = counts.reduce((a, x) => a + x.count, 0);
  return ok(c, { approved, linked: get("LINKED") + get("SYNCED"), needs_review: get("MATCH_SUGGESTED"), ready_to_create: get("NOT_LINKED"), pushing: get("READY_TO_PUSH") + get("PUSHING"), sync_errors: errors.total, failed: get("SYNC_FAILED"), all_synced: get("MATCH_SUGGESTED") + get("NOT_LINKED") + get("SYNC_FAILED") === 0 });
});

router.get("/reconciliation", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const q = c.req.query();
  const page = parsePage(q);
  const scope = isApprover(ctx.user) ? {} : { user_id: ctx.user!.id };
  const view = q.view ?? "needs_action";
  const statusMap: Record<string, string[]> = { needs_action: ["MATCH_SUGGESTED", "NOT_LINKED", "SYNC_FAILED"], suggested: ["MATCH_SUGGESTED"], ready_to_create: ["NOT_LINKED"], ready_to_sync: ["READY_TO_PUSH", "PUSHING", "LINKED"], synced: ["SYNCED"], errors: ["SYNC_FAILED"], all: ["NOT_LINKED", "MATCH_SUGGESTED", "LINKED", "READY_TO_PUSH", "PUSHING", "SYNCED", "SYNC_FAILED"] };
  const r = await ctx.repos.timesheets.list({ ...scope, status: "APPROVED", jira_sync_status: statusMap[view] ?? statusMap.needs_action, project_id: q.project_id }, { offset: page.offset, limit: page.page_size });
  const ids = r.items.map((t) => t.id);
  const [links, cands, errs] = await Promise.all([ctx.repos.jira.linksForTimesheets(ids), ctx.repos.jira.candidatesForTimesheets(ids), ctx.repos.jira.openSyncErrors({ offset: 0, limit: 200 })]);
  const errMap = new Map(errs.items.filter((e) => e.timesheet_id).map((e) => [e.timesheet_id!, e]));
  const issueKeys = [...new Set([...cands.values()].flat().map((x) => x.jira_issue_key))];
  const issueRows = await Promise.all(issueKeys.map((k) => ctx.repos.jira.findIssue(k)));
  const summaries = new Map(issueRows.filter((x) => !!x).map((x) => [x!.issue_key, x!.summary]));
  const rows: ReconciliationRowDTO[] = r.items.map((t) => {
    const cs = (cands.get(t.id) ?? []).filter((x) => x.status === "OPEN").map((x) => ({ issue_key: x.jira_issue_key, summary: summaries.get(x.jira_issue_key) ?? "", confidence: x.confidence, reason: x.reason, result: x.result as ReconciliationRowDTO["result"] }));
    const link = links.get(t.id);
    const result: ReconciliationRowDTO["result"] = link ? "EXACT_MATCH" : cs[0]?.result === "EXACT_MATCH" ? "EXACT_MATCH" : cs.length ? "SUGGESTED_MATCH" : "NO_MATCH";
    const e = errMap.get(t.id);
    return { timesheet: toTimesheetDTO(t), result, candidates: cs, link: link ? toJiraLinkDTO(link) : null, sync_error: e ? toSyncErrorDTO(e) : null };
  });
  return ok(c, { items: rows, total: r.total, page: page.page, page_size: page.page_size });
});

router.post("/timesheets/:id/reconcile", requireAuth, async (c) => ok(c, await reconcileTimesheet(c.get("ctx"), c.req.param("id"))));

router.post("/timesheets/:id/link", requireAuth, async (c) => {
  const body = z.object({ issue_key: z.string().regex(/^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/), match_type: z.enum(["MANUAL", "AI_SUGGESTED"]).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("A valid Jira issue key is required (e.g. BNM-1524).");
  await linkTimesheet(c.get("ctx"), c.req.param("id"), body.data.issue_key, body.data.match_type ?? "MANUAL");
  return ok(c, { linked: true, issue_key: body.data.issue_key });
});

router.post("/timesheets/:id/ignore", requireAuth, async (c) => { await ignoreMatch(c.get("ctx"), c.req.param("id")); return ok(c, { ignored: true }); });

router.get("/timesheets/:id/create-preview", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const t = await ctx.repos.timesheets.findById(c.req.param("id"));
  if (!t) throw Errors.notFound("Timesheet");
  if (t.user_id !== ctx.user!.id && !isApprover(ctx.user)) throw Errors.notFound("Timesheet");
  const handle = await getJiraClient(ctx);
  const defaults = await issueDefaults(ctx, t);
  const dups = await duplicateCheck(ctx, t);
  const issueTypes = defaults.project_key ? await handle.client.getIssueTypes(defaults.project_key).catch(() => []) : [];
  return ok(c, { defaults, duplicates: dups, issue_types: issueTypes.filter((x) => !x.subtask).map((x) => x.name), demo: handle.demo, timesheet: toTimesheetDTO(t) });
});

const CreateSchema = z.object({ summary: z.string().min(3).max(255).optional(), description: z.string().max(10000).optional(), issue_type: z.string().max(40).optional(), assignee_account_id: z.string().max(120).nullable().optional(), force: z.boolean().optional() });

router.post("/timesheets/:id/create", requireAuth, rateLimit(30, 60, "jira-create"), async (c) => {
  const body = CreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid issue details.", body.error.issues);
  const { force, ...overrides } = body.data;
  const r = await createIssueForTimesheet(c.get("ctx"), c.req.param("id"), overrides, force ?? false);
  return ok(c, r, undefined, r.status === "QUEUED" ? 202 : 200);
});

router.post("/create", requireAuth, rateLimit(10, 60, "jira-bulk-create"), async (c) => {
  const body = z.object({ timesheet_ids: z.array(z.string()).min(1).max(50), force: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Choose at least one timesheet.");
  const ctx = c.get("ctx");
  const results: Record<string, unknown> = {};
  for (const id of body.data.timesheet_ids) {
    try { results[id] = await createIssueForTimesheet(ctx, id, {}, body.data.force ?? false); } catch (e) { results[id] = { status: "ERROR", message: e instanceof Error ? e.message : "Unknown error" }; }
  }
  return ok(c, results, undefined, 202);
});

router.post("/timesheets/:id/retry", requireAuth, async (c) => ok(c, await retryTimesheetSync(c.get("ctx"), c.req.param("id")), undefined, 202));

router.get("/errors", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const page = parsePage(c.req.query());
  const r = await ctx.repos.jira.openSyncErrors({ offset: page.offset, limit: page.page_size });
  const visible = isApprover(ctx.user) ? r.items : (await Promise.all(r.items.map(async (e) => ((e.timesheet_id && (await ctx.repos.timesheets.findById(e.timesheet_id))?.user_id === ctx.user!.id) ? e : null)))).filter((x) => !!x) as typeof r.items;
  return ok(c, { items: visible.map(toSyncErrorDTO), total: r.total, page: page.page, page_size: page.page_size });
});

router.get("/users", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const q = c.req.query("q") ?? "";
  const handle = await getJiraClient(ctx);
  const users = q.length >= 2 ? await handle.client.searchUsers(q) : [];
  return ok(c, users.map((u) => ({ account_id: u.account_id, display_name: u.display_name })));
});

export default router;
