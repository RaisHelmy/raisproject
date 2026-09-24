import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { requireAuth, requireRole } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { isApprover } from "../services/context";
import { approveTimesheet, bulkApprove, bulkReject, bulkSubmit, createTimesheet, deleteDraft, voidTimesheet, getTimesheet, rejectTimesheet, reopenTimesheet, submitTimesheet, updateTimesheet } from "../services/timesheets";
import { toApprovalDTO, toAuditDTO, toJiraLinkDTO, toMessageDTO, toTimesheetDTO, toWorkItemDTO, toSyncErrorDTO } from "../services/mappers";
import type { TimesheetFilter } from "../repositories/types";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

const Body = z.object({
  project_id: z.string().min(1), work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(3).max(200), description: z.string().max(5000).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  duration_minutes: z.number().int().min(0).max(1440).optional(), work_status: z.enum(["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"]).optional(),
});

function filterFromQuery(q: Record<string, string | undefined>, userId: string, approver: boolean): TimesheetFilter {
  const f: TimesheetFilter = {};
  const scope = q.scope ?? "mine";
  if (!approver || scope === "mine") f.user_id = userId;
  else if (q.user_id) f.user_id = q.user_id;
  if (q.status) f.status = q.status.split(",");
  else f.status = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
  if (q.jira_sync_status) f.jira_sync_status = q.jira_sync_status.split(",");
  if (q.project_id) f.project_id = q.project_id;
  if (q.client_id) f.client_id = q.client_id;
  if (q.work_status) f.work_status = q.work_status;
  if (q.date_from) f.date_from = q.date_from;
  if (q.date_to) f.date_to = q.date_to;
  if (q.q) f.search = q.q.slice(0, 100);
  return f;
}

router.get("/", async (c) => {
  const ctx = c.get("ctx");
  const q = c.req.query();
  const page = parsePage(q);
  const f = filterFromQuery(q, ctx.user!.id, isApprover(ctx.user));
  const sort = { column: q.sort ?? "work_date", direction: (q.dir === "asc" ? "asc" : "desc") as "asc" | "desc" };
  const [r, summary] = await Promise.all([ctx.repos.timesheets.list(f, { offset: page.offset, limit: page.page_size }, sort), ctx.repos.timesheets.summary(f)]);
  return ok(c, { items: r.items.map(toTimesheetDTO), total: r.total, page: page.page, page_size: page.page_size, summary });
});

router.post("/", async (c) => {
  const body = Body.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please check the timesheet details.", body.error.issues);
  const t = await createTimesheet(c.get("ctx"), body.data);
  return ok(c, toTimesheetDTO(t), undefined, 201);
});

router.post("/bulk", async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ action: z.enum(["approve", "reject", "submit"]), ids: z.array(z.string()).min(1).max(200), reason: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Choose an action and at least one timesheet.");
  if (body.data.action === "submit") return ok(c, await bulkSubmit(ctx, body.data.ids));
  if (!isApprover(ctx.user)) throw Errors.forbidden();
  if (body.data.action === "approve") return ok(c, await bulkApprove(ctx, body.data.ids));
  if (!body.data.reason) throw Errors.validation("A rejection reason is required.");
  return ok(c, await bulkReject(ctx, body.data.ids, body.data.reason));
});

router.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const t = await getTimesheet(ctx, c.req.param("id"));
  const [approvals, auditRows, link, candidates, errors] = await Promise.all([
    ctx.repos.timesheets.approvals(t.id), ctx.repos.audit.forEntity("timesheet", t.id), ctx.repos.jira.linkForTimesheet(t.id), ctx.repos.jira.candidates(t.id), ctx.repos.jira.openSyncErrors({ offset: 0, limit: 5 }, t.id),
  ]);
  const jiraAudit = await ctx.repos.audit.forEntity("jira_link", t.id);
  const issue = link ? await ctx.repos.jira.findIssue(link.jira_issue_key) : null;
  let source: { import_id: string; filename: string; work_item: ReturnType<typeof toWorkItemDTO> | null; messages: ReturnType<typeof toMessageDTO>[] } | null = null;
  if (t.source_import_id) {
    const imp = await ctx.repos.imports.findById(t.source_import_id);
    const w = t.source_work_item_id ? await ctx.repos.analyses.workItem(t.source_work_item_id) : null;
    const ev = w ? (JSON.parse(w.evidence_json) as { message_id: string }[]).map((e) => e.message_id) : [];
    const msgs = ev.length ? await ctx.repos.imports.messagesByIds(ev) : [];
    if (imp) source = { import_id: imp.id, filename: imp.filename, work_item: w ? toWorkItemDTO(w) : null, messages: msgs.map(toMessageDTO) };
  }
  return ok(c, {
    timesheet: toTimesheetDTO(t), approvals: approvals.map(toApprovalDTO), audit: [...auditRows, ...jiraAudit].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(toAuditDTO),
    jira: { link: link ? toJiraLinkDTO(link) : null, issue: issue ? { issue_key: issue.issue_key, summary: issue.summary, status: issue.status, url: issue.url, assignee_name: issue.assignee_name, due_date: issue.due_date } : null, candidates: candidates.filter((x) => x.status === "OPEN").map((x) => ({ issue_key: x.jira_issue_key, confidence: x.confidence, reason: x.reason, result: x.result })), errors: errors.items.map(toSyncErrorDTO) },
    source,
  });
});

router.patch("/:id", async (c) => {
  const body = Body.partial().extend({ reason: z.string().max(500).nullable().optional(), jira_comment: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please check the timesheet details.", body.error.issues);
  const { reason, jira_comment, ...patch } = body.data;
  const t = await updateTimesheet(c.get("ctx"), c.req.param("id"), patch, reason ?? null, jira_comment ?? true);
  return ok(c, toTimesheetDTO(t));
});

router.delete("/:id", async (c) => {
  const reason = c.req.query("reason");
  if (reason) await voidTimesheet(c.get("ctx"), c.req.param("id"), reason);
  else await deleteDraft(c.get("ctx"), c.req.param("id"));
  return ok(c, { deleted: true });
});
router.post("/:id/submit", async (c) => ok(c, toTimesheetDTO(await submitTimesheet(c.get("ctx"), c.req.param("id")))));
router.post("/:id/reopen", async (c) => ok(c, toTimesheetDTO(await reopenTimesheet(c.get("ctx"), c.req.param("id")))));
router.post("/:id/approve", requireRole("ADMIN", "APPROVER"), async (c) => ok(c, toTimesheetDTO(await approveTimesheet(c.get("ctx"), c.req.param("id")))));
router.post("/:id/reject", requireRole("ADMIN", "APPROVER"), async (c) => {
  const body = z.object({ reason: z.string().min(3).max(500) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("A rejection reason (at least 3 characters) is required.");
  return ok(c, toTimesheetDTO(await rejectTimesheet(c.get("ctx"), c.req.param("id"), body.data.reason)));
});

export default router;
