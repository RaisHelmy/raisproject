import type { AppContext } from "./context";
import { isApprover } from "./context";
import { Errors } from "../lib/errors";
import { uuid } from "../lib/ids";
import { isIsoDate, minutesBetween, nowIso } from "../lib/time";
import { audit, notify, notifyApprovers, timesheetSnapshot } from "./audit";
import type { TimesheetJoined, TimesheetRow } from "../repositories/types";
import type { WorkStatus } from "@rais/shared-types";
import { reconcileTimesheet, queueIssueUpdate } from "./jira/sync";

export interface TimesheetInput {
  project_id: string;
  work_date: string;
  title: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number;
  work_status?: WorkStatus;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateInput(i: Partial<TimesheetInput>, partial = false): void {
  if (!partial || i.work_date !== undefined) if (!i.work_date || !isIsoDate(i.work_date)) throw Errors.validation("Work date must be a valid date (YYYY-MM-DD).");
  if (!partial || i.title !== undefined) if (!i.title || i.title.trim().length < 3 || i.title.length > 200) throw Errors.validation("Title must be between 3 and 200 characters.");
  if (i.start_time && !HHMM.test(i.start_time)) throw Errors.validation("Start time must be HH:MM.");
  if (i.end_time && !HHMM.test(i.end_time)) throw Errors.validation("End time must be HH:MM.");
  if (i.duration_minutes !== undefined && (i.duration_minutes < 0 || i.duration_minutes > 24 * 60)) throw Errors.validation("Duration must be between 0 and 24 hours.");
  if (i.description && i.description.length > 5000) throw Errors.validation("Description is too long (max 5000 characters).");
}

export function resolveDuration(i: Partial<TimesheetInput>, fallback = 0): number {
  if (i.duration_minutes !== undefined && i.duration_minutes !== null) return Math.round(i.duration_minutes);
  if (i.start_time && i.end_time) { const d = minutesBetween(i.start_time, i.end_time); if (d > 0) return d; }
  return fallback;
}

export async function assertProjectAccess(ctx: AppContext, projectId: string): Promise<void> {
  const p = await ctx.repos.projects.findById(projectId);
  if (!p || !p.is_active) throw Errors.validation("Project is not available.");
  if (isApprover(ctx.user)) return;
  if (!(await ctx.repos.projects.isMember(projectId, ctx.user!.id))) throw Errors.forbidden("You are not a member of this project.");
}

export async function createTimesheet(ctx: AppContext, input: TimesheetInput, extra: Partial<Pick<TimesheetRow, "source_import_id" | "source_work_item_id" | "confidence" | "ai_generated" | "user_id">> = {}): Promise<TimesheetJoined> {
  validateInput(input);
  await assertProjectAccess(ctx, input.project_id);
  const now = nowIso();
  const id = uuid();
  const reference = await ctx.repos.timesheets.nextReference(Number(input.work_date.slice(0, 4)));
  const row: TimesheetRow = {
    id, reference, user_id: extra.user_id ?? ctx.user!.id, project_id: input.project_id, work_date: input.work_date, title: input.title.trim(), description: (input.description ?? "").trim(),
    start_time: input.start_time ?? null, end_time: input.end_time ?? null, duration_minutes: resolveDuration(input), status: "DRAFT", work_status: input.work_status ?? "COMPLETED",
    jira_sync_status: "NOT_LINKED", source_import_id: extra.source_import_id ?? null, source_work_item_id: extra.source_work_item_id ?? null, confidence: extra.confidence ?? null,
    ai_generated: extra.ai_generated ?? 0, submitted_at: null, approved_at: null, approved_by: null, rejection_reason: null, created_at: now, updated_at: now, created_by: ctx.user!.id, updated_by: ctx.user!.id,
  };
  await ctx.repos.timesheets.create(row);
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: extra.ai_generated ? "ai_draft_created" : "created", after: timesheetSnapshot(row as unknown as Record<string, unknown>) });
  return (await ctx.repos.timesheets.findById(id))!;
}

export async function getTimesheet(ctx: AppContext, id: string): Promise<TimesheetJoined> {
  const t = await ctx.repos.timesheets.findById(id);
  if (!t) throw Errors.notFound("Timesheet");
  if (t.user_id !== ctx.user!.id && !isApprover(ctx.user)) throw Errors.notFound("Timesheet"); // no IDOR leak
  return t;
}

export async function updateTimesheet(ctx: AppContext, id: string, patch: Partial<TimesheetInput>, reason?: string | null, jiraComment = true): Promise<TimesheetJoined> {
  const t = await getTimesheet(ctx, id);
  validateInput(patch, true);
  const owner = t.user_id === ctx.user!.id;
  const approver = isApprover(ctx.user);
  if (t.status === "SUBMITTED" && !approver) throw Errors.invalidState("Submitted timesheets can only be edited by an approver. Ask the approver to return it, or wait for the decision.");
  if (t.status === "APPROVED") {
    if (!approver) throw Errors.invalidState("Approved timesheets are official records and can only be corrected by an approver.");
    if (!reason || reason.trim().length < 5) throw Errors.validation("A reason is required when changing an approved timesheet.");
  }
  if (!owner && !approver) throw Errors.forbidden();
  if (patch.project_id && patch.project_id !== t.project_id) await assertProjectAccess(ctx, patch.project_id);

  const next: Partial<TimesheetRow> = {
    project_id: patch.project_id ?? undefined, work_date: patch.work_date ?? undefined, title: patch.title?.trim(), description: patch.description?.trim(),
    start_time: patch.start_time === undefined ? undefined : patch.start_time, end_time: patch.end_time === undefined ? undefined : patch.end_time,
    work_status: patch.work_status ?? undefined, updated_at: nowIso(), updated_by: ctx.user!.id,
  };
  const merged = { ...t, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) } as TimesheetRow;
  next.duration_minutes = resolveDuration({ duration_minutes: patch.duration_minutes, start_time: merged.start_time, end_time: merged.end_time }, patch.duration_minutes === undefined && !(patch.start_time || patch.end_time) ? t.duration_minutes : 0);
  if (t.status === "REJECTED" && owner) { next.status = "DRAFT"; next.rejection_reason = null; }
  await ctx.repos.timesheets.update(id, next);
  const after = (await ctx.repos.timesheets.findById(id))!;
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: t.status === "APPROVED" ? "approved_record_corrected" : "updated", before: timesheetSnapshot(t as unknown as Record<string, unknown>), after: timesheetSnapshot(after as unknown as Record<string, unknown>), reason: reason ?? null });
  if (t.status === "APPROVED" && after.jira_issue_key && jiraComment) await queueIssueUpdate(ctx, after, reason ?? "Corrected after review");
  return after;
}

export async function submitTimesheet(ctx: AppContext, id: string): Promise<TimesheetJoined> {
  const t = await getTimesheet(ctx, id);
  if (t.user_id !== ctx.user!.id && !isApprover(ctx.user)) throw Errors.forbidden();
  if (!["DRAFT", "REJECTED"].includes(t.status)) throw Errors.invalidState(`Only drafts can be submitted (current status: ${t.status}).`);
  if (t.duration_minutes <= 0) throw Errors.validation("Please set a duration before submitting.");
  const now = nowIso();
  await ctx.repos.timesheets.update(id, { status: "SUBMITTED", submitted_at: now, rejection_reason: null, updated_at: now, updated_by: ctx.user!.id });
  await ctx.repos.timesheets.addApproval({ id: uuid(), timesheet_id: id, action: "SUBMITTED", actor_id: ctx.user!.id, reason: null, created_at: now });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "submitted", before: { status: t.status }, after: { status: "SUBMITTED" } });
  await notifyApprovers(ctx, { type: "approval_pending", title: `${t.reference} submitted for approval`, body: `${ctx.user!.name}: ${t.title}`, link: `/approvals/${id}` });
  return (await ctx.repos.timesheets.findById(id))!;
}

export async function approveTimesheet(ctx: AppContext, id: string): Promise<TimesheetJoined> {
  if (!isApprover(ctx.user)) throw Errors.forbidden();
  const t = await ctx.repos.timesheets.findById(id);
  if (!t) throw Errors.notFound("Timesheet");
  if (t.status !== "SUBMITTED") throw Errors.invalidState(`Only submitted timesheets can be approved (current status: ${t.status}).`);
  const now = nowIso();
  await ctx.repos.timesheets.update(id, { status: "APPROVED", approved_at: now, approved_by: ctx.user!.id, updated_at: now, updated_by: ctx.user!.id });
  await ctx.repos.timesheets.addApproval({ id: uuid(), timesheet_id: id, action: "APPROVED", actor_id: ctx.user!.id, reason: null, created_at: now });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "approved", before: { status: "SUBMITTED" }, after: { status: "APPROVED", approved_by: ctx.user!.id } });
  if (t.user_id !== ctx.user!.id) await notify(ctx, t.user_id, { type: "approved", title: `${t.reference} approved`, body: t.title, link: `/timesheets/${id}` });
  // Automatic Jira reconciliation after approval (never creates issues by itself).
  try {
    await reconcileTimesheet(ctx, id);
  } catch (e) {
    ctx.log.warn("reconcile_after_approve_failed", { timesheet_id: id, error: e });
  }
  return (await ctx.repos.timesheets.findById(id))!;
}

export async function rejectTimesheet(ctx: AppContext, id: string, reason: string): Promise<TimesheetJoined> {
  if (!isApprover(ctx.user)) throw Errors.forbidden();
  if (!reason || reason.trim().length < 3) throw Errors.validation("A rejection reason is required.");
  const t = await ctx.repos.timesheets.findById(id);
  if (!t) throw Errors.notFound("Timesheet");
  if (t.status !== "SUBMITTED") throw Errors.invalidState(`Only submitted timesheets can be rejected (current status: ${t.status}).`);
  const now = nowIso();
  await ctx.repos.timesheets.update(id, { status: "REJECTED", rejection_reason: reason.trim(), updated_at: now, updated_by: ctx.user!.id });
  await ctx.repos.timesheets.addApproval({ id: uuid(), timesheet_id: id, action: "REJECTED", actor_id: ctx.user!.id, reason: reason.trim(), created_at: now });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "rejected", before: { status: "SUBMITTED" }, after: { status: "REJECTED" }, reason });
  await notify(ctx, t.user_id, { type: "rejected", title: `${t.reference} was returned`, body: reason.trim(), link: `/timesheets/${id}` });
  return (await ctx.repos.timesheets.findById(id))!;
}

export async function reopenTimesheet(ctx: AppContext, id: string): Promise<TimesheetJoined> {
  const t = await getTimesheet(ctx, id);
  if (t.status !== "REJECTED") throw Errors.invalidState("Only rejected timesheets can be moved back to draft.");
  await ctx.repos.timesheets.update(id, { status: "DRAFT", updated_at: nowIso(), updated_by: ctx.user!.id });
  await ctx.repos.timesheets.addApproval({ id: uuid(), timesheet_id: id, action: "RETURNED_TO_DRAFT", actor_id: ctx.user!.id, reason: null, created_at: nowIso() });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "returned_to_draft", before: { status: "REJECTED" }, after: { status: "DRAFT" } });
  return (await ctx.repos.timesheets.findById(id))!;
}

/** Approver-only: remove an approved/submitted record that should never have existed (e.g. a cancelled meeting). Kept as DELETED for audit; the Jira link is dropped locally. */
export async function voidTimesheet(ctx: AppContext, id: string, reason: string): Promise<void> {
  if (!isApprover(ctx.user)) throw Errors.forbidden();
  const t = await getTimesheet(ctx, id);
  if (!["APPROVED", "SUBMITTED"].includes(t.status)) throw Errors.invalidState("Only submitted or approved records can be voided; delete drafts instead.");
  if (reason.trim().length < 5) throw Errors.validation("A reason is required to void an official record.");
  const now = nowIso();
  await ctx.repos.jira.deleteLink(id);
  await ctx.repos.timesheets.update(id, { status: "DELETED" as never, jira_sync_status: "NOT_LINKED", updated_at: now, updated_by: ctx.user!.id });
  await ctx.repos.timesheets.addApproval({ id: uuid(), timesheet_id: id, action: "VOIDED", actor_id: ctx.user!.id, reason, created_at: now });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "record_voided", before: timesheetSnapshot(t as unknown as Record<string, unknown>), reason });
}

export async function deleteDraft(ctx: AppContext, id: string): Promise<void> {
  const t = await getTimesheet(ctx, id);
  if (t.status !== "DRAFT") throw Errors.invalidState("Only drafts can be deleted. Submitted and approved records are kept for audit.");
  // Soft delete by marking title; we keep the row for auditability but hide it from lists via status.
  await ctx.repos.timesheets.update(id, { status: "DELETED" as never, updated_at: nowIso(), updated_by: ctx.user!.id });
  if (t.source_work_item_id) await ctx.repos.analyses.updateWorkItem(t.source_work_item_id, { timesheet_id: null, review_status: "PENDING", updated_at: nowIso() });
  await audit(ctx, { entity_type: "timesheet", entity_id: id, action: "draft_deleted", before: timesheetSnapshot(t as unknown as Record<string, unknown>) });
}

export interface BulkResult { succeeded: string[]; failed: { id: string; reason: string }[] }

export async function bulkApprove(ctx: AppContext, ids: string[]): Promise<BulkResult> {
  const r: BulkResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try { await approveTimesheet(ctx, id); r.succeeded.push(id); } catch (e) { r.failed.push({ id, reason: e instanceof Error ? e.message : "Unknown error" }); }
  }
  return r;
}

export async function bulkReject(ctx: AppContext, ids: string[], reason: string): Promise<BulkResult> {
  const r: BulkResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try { await rejectTimesheet(ctx, id, reason); r.succeeded.push(id); } catch (e) { r.failed.push({ id, reason: e instanceof Error ? e.message : "Unknown error" }); }
  }
  return r;
}

export async function bulkSubmit(ctx: AppContext, ids: string[]): Promise<BulkResult> {
  const r: BulkResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try { await submitTimesheet(ctx, id); r.succeeded.push(id); } catch (e) { r.failed.push({ id, reason: e instanceof Error ? e.message : "Unknown error" }); }
  }
  return r;
}
