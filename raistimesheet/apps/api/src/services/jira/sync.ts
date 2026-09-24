/**
 * Jira reconciliation + synchronisation engine.
 * - reconcileTimesheet: compare an approved timesheet with cached Jira issues, store candidates,
 *   auto-link only on unambiguous explicit matches.
 * - linkTimesheet / createIssueForTimesheet: human-confirmed actions, idempotent via sync_jobs.
 * - runSyncJob: executes a job with retry/backoff; failures become sync_errors with a reference.
 */
import type { AppContext } from "../context";
import { isApprover } from "../context";
import { Errors } from "../../lib/errors";
import { errorReference, uuid } from "../../lib/ids";
import { formatDateLong, minutesToHuman, nowIso } from "../../lib/time";
import { audit, notify } from "../audit";
import { getJiraClient } from "./factory";
import { JiraApiError, type JiraIssue } from "./client";
import { duplicateCandidates, matchTimesheet, overallResult, type Candidate } from "./matcher";
import type { JiraIssueRow, SyncJobRow, TimesheetJoined } from "../../repositories/types";
import type { MatchType } from "@rais/shared-types";

const MAX_ATTEMPTS = 5;

export function issueToRow(i: JiraIssue, demo: boolean): JiraIssueRow {
  return {
    id: uuid(), issue_key: i.key, issue_id: i.id, project_key: i.project_key, summary: i.summary, description: i.description, status: i.status, status_category: i.status_category,
    issue_type: i.issue_type, assignee_account_id: i.assignee?.account_id ?? null, assignee_name: i.assignee?.display_name ?? null, priority: i.priority, due_date: i.due_date,
    resolved_at: i.resolved_at, jira_created_at: i.created, jira_updated_at: i.updated, url: i.url, is_demo: demo ? 1 : 0, synced_at: nowIso(),
  };
}

/** Refresh the local issue cache from Jira for all active projects with a Jira key. */
export async function refreshIssueCache(ctx: AppContext): Promise<{ projects: number; issues: number; demo: boolean }> {
  const handle = await getJiraClient(ctx);
  const projects = (await ctx.repos.projects.list({ active_only: true })).filter((p) => p.jira_project_key);
  let issues = 0;
  if (!handle.demo) {
    for (const p of projects) {
      const found = await handle.client.searchIssues(`project = "${p.jira_project_key}" ORDER BY updated DESC`, 300);
      await ctx.repos.jira.upsertIssues(found.map((i) => issueToRow(i, false)));
      issues += found.length;
    }
    if (handle.connection) await ctx.repos.jira.updateConnection(handle.connection.id, { last_sync_at: nowIso(), last_ok_at: nowIso(), status: "HEALTHY", last_error: null, updated_at: nowIso() });
  } else {
    issues = (await ctx.repos.jira.allIssues()).length;
    await ctx.repos.settings.set("demo.jira_last_sync_at", nowIso(), ctx.user?.id ?? null);
  }
  await audit(ctx, { entity_type: "jira_connection", entity_id: handle.connection?.id ?? "demo", action: "issues_refreshed", after: { projects: projects.length, issues, demo: handle.demo } });
  return { projects: projects.length, issues, demo: handle.demo };
}

async function explicitKeyFor(ctx: AppContext, t: TimesheetJoined): Promise<string | null> {
  if (t.source_work_item_id) {
    const w = await ctx.repos.analyses.workItem(t.source_work_item_id);
    if (w?.explicit_jira_key) return w.explicit_jira_key;
  }
  const m = /\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/.exec(`${t.title} ${t.description}`);
  return m?.[1] ?? null;
}

/** Compare one approved timesheet with Jira. Stores candidates and updates the sync state. */
export async function reconcileTimesheet(ctx: AppContext, timesheetId: string): Promise<{ result: string; candidates: Candidate[] }> {
  const t = await ctx.repos.timesheets.findById(timesheetId);
  if (!t) throw Errors.notFound("Timesheet");
  const existing = await ctx.repos.jira.linkForTimesheet(t.id);
  if (existing && ["SYNCED", "PUSHING", "READY_TO_PUSH"].includes(existing.sync_status)) return { result: "EXACT_MATCH", candidates: [] };
  const project = await ctx.repos.projects.findById(t.project_id);
  const user = await ctx.repos.users.findById(t.user_id);
  const issues = await ctx.repos.jira.allIssues(project?.jira_project_key ? [project.jira_project_key] : undefined);
  const explicit = await explicitKeyFor(ctx, t);
  const candidates = matchTimesheet(
    { title: t.title, description: t.description, work_date: t.work_date, explicit_jira_key: explicit, existing_link_key: existing?.jira_issue_key ?? null, user_jira_account_id: user?.jira_account_id ?? null },
    issues.map((i) => ({ key: i.issue_key, summary: i.summary, description: i.description, project_key: i.project_key, assignee_account_id: i.assignee_account_id, created: i.jira_created_at, updated: i.jira_updated_at, status_category: i.status_category })),
    { project_key: project?.jira_project_key ?? null },
  );
  const result = overallResult(candidates);
  const now = nowIso();
  await ctx.repos.jira.replaceCandidates(t.id, candidates.map((c) => ({ id: uuid(), timesheet_id: t.id, jira_issue_key: c.issue_key, result: c.result, confidence: c.confidence, reason: c.reason, status: "OPEN", created_at: now })));

  const top = candidates[0];
  if (top && top.confidence >= 1 && (explicit === top.issue_key || existing?.jira_issue_key === top.issue_key)) {
    // Unambiguous: explicit key in the conversation, or already linked → link automatically (no Jira write yet).
    await ctx.repos.jira.upsertLink({
      id: existing?.id ?? uuid(), timesheet_id: t.id, jira_issue_key: top.issue_key, match_type: existing?.match_type ?? "EXACT", match_confidence: 1, linked_at: existing?.linked_at ?? now,
      linked_by: existing?.linked_by ?? null, sync_status: "LINKED", last_sync_at: existing?.last_sync_at ?? null, sync_error: null, idempotency_key: existing?.idempotency_key ?? `link:${t.id}`, created_at: existing?.created_at ?? now, updated_at: now,
    });
    await ctx.repos.timesheets.update(t.id, { jira_sync_status: "LINKED", updated_at: now });
    await audit(ctx, { entity_type: "jira_link", entity_id: t.id, action: "auto_linked_explicit", after: { jira_issue_key: top.issue_key, confidence: 1 } });
    return { result: "EXACT_MATCH", candidates };
  }
  await ctx.repos.timesheets.update(t.id, { jira_sync_status: candidates.length ? "MATCH_SUGGESTED" : "NOT_LINKED", updated_at: now });
  await audit(ctx, { entity_type: "jira_link", entity_id: t.id, action: "reconciled", after: { result, candidates: candidates.slice(0, 3).map((c) => ({ key: c.issue_key, confidence: c.confidence })) } });
  return { result, candidates };
}

export async function reconcileAllApproved(ctx: AppContext): Promise<{ reconciled: number }> {
  const { items } = await ctx.repos.timesheets.list({ status: "APPROVED", jira_sync_status: ["NOT_LINKED", "MATCH_SUGGESTED"] }, { offset: 0, limit: 500 });
  let n = 0;
  for (const t of items) { await reconcileTimesheet(ctx, t.id); n++; }
  return { reconciled: n };
}

function assertCanSync(ctx: AppContext, t: TimesheetJoined) {
  if (t.status !== "APPROVED") throw Errors.invalidState("Only approved timesheets can be synchronised with Jira.");
  if (t.user_id !== ctx.user!.id && !isApprover(ctx.user)) throw Errors.forbidden();
}

/** Human-confirmed link to an existing Jira issue. Queues a traceability comment on the issue. */
export async function linkTimesheet(ctx: AppContext, timesheetId: string, issueKey: string, matchType: MatchType = "MANUAL"): Promise<void> {
  const t = await ctx.repos.timesheets.findById(timesheetId);
  if (!t) throw Errors.notFound("Timesheet");
  assertCanSync(ctx, t);
  const handle = await getJiraClient(ctx);
  let issue = await ctx.repos.jira.findIssue(issueKey);
  if (!issue) {
    const remote = await handle.client.getIssue(issueKey);
    if (!remote) throw Errors.validation(`No Jira task found for ${issueKey}.`);
    await ctx.repos.jira.upsertIssues([issueToRow(remote, handle.demo)]);
    issue = await ctx.repos.jira.findIssue(issueKey);
  }
  const existing = await ctx.repos.jira.linkForTimesheet(t.id);
  const now = nowIso();
  const cand = (await ctx.repos.jira.candidates(t.id)).find((c) => c.jira_issue_key === issueKey);
  await ctx.repos.jira.upsertLink({
    id: existing?.id ?? uuid(), timesheet_id: t.id, jira_issue_key: issueKey, match_type: cand && matchType === "MANUAL" ? "AI_SUGGESTED" : matchType, match_confidence: cand?.confidence ?? null,
    linked_at: now, linked_by: ctx.user!.id, sync_status: "READY_TO_PUSH", last_sync_at: null, sync_error: null, idempotency_key: existing?.idempotency_key ?? `link:${t.id}`, created_at: existing?.created_at ?? now, updated_at: now,
  });
  await ctx.repos.jira.updateCandidates(t.id, "ACCEPTED");
  await ctx.repos.timesheets.update(t.id, { jira_sync_status: "READY_TO_PUSH", updated_at: now });
  await audit(ctx, { entity_type: "jira_link", entity_id: t.id, action: "linked", after: { jira_issue_key: issueKey, match_type: matchType, confidence: cand?.confidence ?? null } });
  await enqueueSyncJob(ctx, { type: "LINK_ISSUE", timesheet_id: t.id, idempotency_key: `link:${t.id}:${issueKey}`, payload: { issue_key: issueKey } });
}

export async function ignoreMatch(ctx: AppContext, timesheetId: string): Promise<void> {
  const t = await ctx.repos.timesheets.findById(timesheetId);
  if (!t) throw Errors.notFound("Timesheet");
  assertCanSync(ctx, t);
  await ctx.repos.jira.updateCandidates(t.id, "DISMISSED");
  await ctx.repos.timesheets.update(t.id, { jira_sync_status: "NOT_LINKED", updated_at: nowIso() });
  await audit(ctx, { entity_type: "jira_link", entity_id: t.id, action: "match_dismissed" });
}

export interface CreateIssueOverrides { summary?: string; description?: string; issue_type?: string; assignee_account_id?: string | null; project_key?: string }

/** Build the default Jira issue payload for a timesheet (what the confirmation dialog shows). */
export async function issueDefaults(ctx: AppContext, t: TimesheetJoined) {
  const project = await ctx.repos.projects.findById(t.project_id);
  const user = await ctx.repos.users.findById(t.user_id);
  return {
    project_key: project?.jira_project_key ?? null,
    issue_type: project?.default_issue_type ?? "Task",
    summary: t.title,
    description: `Work performed based on approved timesheet.\n\nWork date: ${formatDateLong(t.work_date)}\nActual effort: ${minutesToHuman(t.duration_minutes)}\nPerformed by: ${t.user_name}\n\n${t.description}\n\nSource: Rais Timesheet ${t.reference}`,
    assignee_account_id: user?.jira_account_id ?? project?.default_assignee_account_id ?? null,
    assignee_name: user?.jira_account_id ? user.name : null,
  };
}

/** Check for potential duplicates before creating. */
export async function duplicateCheck(ctx: AppContext, t: TimesheetJoined): Promise<Candidate[]> {
  const project = await ctx.repos.projects.findById(t.project_id);
  const issues = await ctx.repos.jira.allIssues(project?.jira_project_key ? [project.jira_project_key] : undefined);
  const user = await ctx.repos.users.findById(t.user_id);
  const explicit = await explicitKeyFor(ctx, t);
  return duplicateCandidates(
    { title: t.title, description: t.description, work_date: t.work_date, explicit_jira_key: explicit, user_jira_account_id: user?.jira_account_id ?? null },
    issues.map((i) => ({ key: i.issue_key, summary: i.summary, description: i.description, project_key: i.project_key, assignee_account_id: i.assignee_account_id, created: i.jira_created_at, updated: i.jira_updated_at, status_category: i.status_category })),
    project?.jira_project_key ?? null,
  );
}

/**
 * Human-confirmed creation. Idempotent: the same timesheet+project never creates two issues,
 * even if the button is clicked twice or the queue redelivers.
 */
export async function createIssueForTimesheet(ctx: AppContext, timesheetId: string, overrides: CreateIssueOverrides = {}, force = false): Promise<{ status: "QUEUED" | "ALREADY_LINKED" | "POTENTIAL_DUPLICATE"; job_id?: string; issue_key?: string; duplicates?: Candidate[] }> {
  const t = await ctx.repos.timesheets.findById(timesheetId);
  if (!t) throw Errors.notFound("Timesheet");
  assertCanSync(ctx, t);
  const existing = await ctx.repos.jira.linkForTimesheet(t.id);
  if (existing && existing.sync_status !== "SYNC_FAILED") return { status: "ALREADY_LINKED", issue_key: existing.jira_issue_key };
  const key = `create:${t.id}:${t.project_id}`;
  const prior = await ctx.repos.jira.findSyncJobByKey(key);
  if (prior && ["PENDING", "RUNNING", "SUCCEEDED"].includes(prior.status)) return { status: prior.status === "SUCCEEDED" ? "ALREADY_LINKED" : "QUEUED", job_id: prior.id, issue_key: existing?.jira_issue_key };
  if (!force) {
    const dups = await duplicateCheck(ctx, t);
    if (dups.length) return { status: "POTENTIAL_DUPLICATE", duplicates: dups };
  }
  const defaults = await issueDefaults(ctx, t);
  const project_key = overrides.project_key ?? defaults.project_key;
  if (!project_key) throw Errors.validation("This project has no Jira project key configured. Ask an administrator to set it under Settings → Projects.");
  const payload = { project_key, issue_type: overrides.issue_type ?? defaults.issue_type, summary: overrides.summary ?? defaults.summary, description: overrides.description ?? defaults.description, assignee_account_id: overrides.assignee_account_id === undefined ? defaults.assignee_account_id : overrides.assignee_account_id, labels: ["rais-timesheet"] };
  const job = await enqueueSyncJob(ctx, { type: "CREATE_ISSUE", timesheet_id: t.id, idempotency_key: key, payload, reuse: prior?.id });
  await ctx.repos.timesheets.update(t.id, { jira_sync_status: "READY_TO_PUSH", updated_at: nowIso() });
  await audit(ctx, { entity_type: "sync_job", entity_id: job.id, action: "issue_creation_requested", after: { timesheet_id: t.id, project_key, forced: force } });
  return { status: "QUEUED", job_id: job.id };
}

export async function queueIssueUpdate(ctx: AppContext, t: TimesheetJoined, reason: string): Promise<void> {
  if (!t.jira_issue_key) return;
  await enqueueSyncJob(ctx, { type: "COMMENT_ISSUE", timesheet_id: t.id, idempotency_key: `comment:${t.id}:${Date.now()}`, payload: { issue_key: t.jira_issue_key, body: `Rais Timesheet ${t.reference} was corrected by ${ctx.user?.name ?? "system"}: ${reason}. Current effort ${minutesToHuman(t.duration_minutes)} on ${formatDateLong(t.work_date)}.` } });
}

interface EnqueueInput { type: string; timesheet_id: string; idempotency_key: string; payload: Record<string, unknown>; reuse?: string }

async function enqueueSyncJob(ctx: AppContext, i: EnqueueInput): Promise<SyncJobRow> {
  const now = nowIso();
  let job: SyncJobRow | null = i.reuse ? await ctx.repos.jira.findSyncJob(i.reuse) : await ctx.repos.jira.findSyncJobByKey(i.idempotency_key);
  if (job) {
    await ctx.repos.jira.updateSyncJob(job.id, { status: "PENDING", attempts: 0, next_run_at: null, last_error: null, payload_json: JSON.stringify(i.payload), updated_at: now });
  } else {
    job = { id: uuid(), type: i.type, timesheet_id: i.timesheet_id, payload_json: JSON.stringify(i.payload), status: "PENDING", attempts: 0, max_attempts: MAX_ATTEMPTS, next_run_at: null, idempotency_key: i.idempotency_key, correlation_id: ctx.correlationId, last_error: null, result_json: null, created_by: ctx.user?.id ?? null, created_at: now, updated_at: now };
    await ctx.repos.jira.createSyncJob(job);
  }
  await ctx.enqueue({ type: "SYNC_JOB", sync_job_id: job.id, correlation_id: ctx.correlationId });
  return job;
}

export async function retryTimesheetSync(ctx: AppContext, timesheetId: string): Promise<{ job_id: string | null }> {
  const t = await ctx.repos.timesheets.findById(timesheetId);
  if (!t) throw Errors.notFound("Timesheet");
  assertCanSync(ctx, t);
  const link = await ctx.repos.jira.linkForTimesheet(t.id);
  const createKey = `create:${t.id}:${t.project_id}`;
  const job = (await ctx.repos.jira.findSyncJobByKey(createKey)) ?? (link ? await ctx.repos.jira.findSyncJobByKey(`link:${t.id}:${link.jira_issue_key}`) : null);
  if (!job) throw Errors.validation("There is no synchronisation job to retry for this timesheet.");
  await ctx.repos.jira.updateSyncJob(job.id, { status: "PENDING", attempts: 0, next_run_at: null, last_error: null, updated_at: nowIso() });
  await ctx.repos.timesheets.update(t.id, { jira_sync_status: "READY_TO_PUSH", updated_at: nowIso() });
  await audit(ctx, { entity_type: "sync_job", entity_id: job.id, action: "retry_requested" });
  await ctx.enqueue({ type: "SYNC_JOB", sync_job_id: job.id, correlation_id: ctx.correlationId });
  return { job_id: job.id };
}

/** Execute a queued sync job. Called from the Queue consumer and the cron retry sweep. */
export async function runSyncJob(ctx: AppContext, jobId: string): Promise<void> {
  const job = await ctx.repos.jira.findSyncJob(jobId);
  if (!job) return;
  if (job.status === "SUCCEEDED" || job.status === "DEAD" || job.status === "RUNNING") return; // idempotent
  if (job.next_run_at && job.next_run_at > nowIso()) return;
  const log = ctx.log.child({ sync_job_id: job.id, timesheet_id: job.timesheet_id ?? undefined });
  const now = nowIso();
  await ctx.repos.jira.updateSyncJob(job.id, { status: "RUNNING", attempts: job.attempts + 1, updated_at: now });
  if (job.timesheet_id) await ctx.repos.timesheets.update(job.timesheet_id, { jira_sync_status: "PUSHING", updated_at: now });
  const payload = JSON.parse(job.payload_json) as Record<string, unknown>;
  const t = job.timesheet_id ? await ctx.repos.timesheets.findById(job.timesheet_id) : null;

  try {
    const handle = await getJiraClient(ctx);
    let issueKey: string | null = null;
    if (job.type === "CREATE_ISSUE") {
      // Idempotency guard: if a link with match_type CREATED already exists, don't create again.
      const existing = t ? await ctx.repos.jira.linkForTimesheet(t.id) : null;
      if (existing?.match_type === "CREATED" && existing.sync_status === "SYNCED") { issueKey = existing.jira_issue_key; }
      else {
        const created = await handle.client.createIssue({ project_key: String(payload.project_key), issue_type: String(payload.issue_type), summary: String(payload.summary), description: String(payload.description), assignee_account_id: (payload.assignee_account_id as string | null) ?? null, labels: (payload.labels as string[]) ?? [] });
        await ctx.repos.jira.upsertIssues([issueToRow(created, handle.demo)]);
        issueKey = created.key;
        if (t) {
          await ctx.repos.jira.upsertLink({ id: uuid(), timesheet_id: t.id, jira_issue_key: created.key, match_type: "CREATED", match_confidence: 1, linked_at: nowIso(), linked_by: job.created_by, sync_status: "SYNCED", last_sync_at: nowIso(), sync_error: null, idempotency_key: job.idempotency_key, created_at: nowIso(), updated_at: nowIso() });
          await audit(ctx, { entity_type: "jira_issue", entity_id: created.key, action: "created", after: { timesheet_id: t.id, project_key: payload.project_key, assignee: payload.assignee_account_id, demo: handle.demo }, actor_id: job.created_by });
        }
      }
    } else if (job.type === "LINK_ISSUE") {
      issueKey = String(payload.issue_key);
      if (t) await handle.client.addComment(issueKey, `Linked to Rais Timesheet ${t.reference}: ${t.title} — ${minutesToHuman(t.duration_minutes)} on ${formatDateLong(t.work_date)} by ${t.user_name}.`);
      const link = t ? await ctx.repos.jira.linkForTimesheet(t.id) : null;
      if (link) await ctx.repos.jira.updateLink(link.id, { sync_status: "SYNCED", last_sync_at: nowIso(), sync_error: null, updated_at: nowIso() });
      const remote = await handle.client.getIssue(issueKey);
      if (remote) await ctx.repos.jira.upsertIssues([issueToRow(remote, handle.demo)]);
      if (t) await audit(ctx, { entity_type: "jira_issue", entity_id: issueKey, action: "linked_comment_added", after: { timesheet_id: t.id }, actor_id: job.created_by });
    } else if (job.type === "COMMENT_ISSUE") {
      issueKey = String(payload.issue_key);
      await handle.client.addComment(issueKey, String(payload.body));
      if (t) await audit(ctx, { entity_type: "jira_issue", entity_id: issueKey, action: "comment_added", after: { timesheet_id: t.id }, actor_id: job.created_by });
    }
    await ctx.repos.jira.updateSyncJob(job.id, { status: "SUCCEEDED", result_json: JSON.stringify({ issue_key: issueKey }), last_error: null, updated_at: nowIso() });
    if (t) {
      await ctx.repos.timesheets.update(t.id, { jira_sync_status: "SYNCED", updated_at: nowIso() });
      await ctx.repos.jira.resolveSyncErrors(t.id, nowIso());
      await audit(ctx, { entity_type: "sync_job", entity_id: job.id, action: "sync_succeeded", after: { issue_key: issueKey, demo: handle.demo }, actor_id: job.created_by });
      if (job.created_by) await notify(ctx, job.created_by, { type: "jira_synced", title: `${t.reference} synchronised with Jira`, body: issueKey ? `${issueKey} · ${t.title}` : t.title, link: `/timesheets/${t.id}` });
    }
    log.info("sync_job_succeeded", { jira_issue_key: issueKey, type: job.type });
  } catch (e) {
    const err = e instanceof JiraApiError ? e : new JiraApiError(e instanceof Error ? e.message : "Unknown error", 0, "JIRA_SYNC_FAILED", false);
    const attempts = job.attempts + 1;
    const reference = errorReference("SYNC");
    const exhausted = attempts >= job.max_attempts || !err.retryable;
    const backoffSeconds = Math.min(3600, 30 * 2 ** attempts);
    const next = exhausted ? null : new Date(Date.now() + backoffSeconds * 1000).toISOString();
    await ctx.repos.jira.updateSyncJob(job.id, { status: exhausted ? "DEAD" : "FAILED", next_run_at: next, last_error: `${err.code}: ${err.message}`, updated_at: nowIso() });
    await ctx.repos.jira.createSyncError({ id: uuid(), sync_job_id: job.id, timesheet_id: job.timesheet_id, error_code: err.code, error_message: err.message.slice(0, 500), reference, retry_count: attempts, correlation_id: ctx.correlationId, resolved_at: null, created_at: nowIso() });
    if (t) {
      await ctx.repos.timesheets.update(t.id, { jira_sync_status: "SYNC_FAILED", updated_at: nowIso() });
      const link = await ctx.repos.jira.linkForTimesheet(t.id);
      if (link) await ctx.repos.jira.updateLink(link.id, { sync_status: "SYNC_FAILED", sync_error: reference, updated_at: nowIso() });
      await audit(ctx, { entity_type: "sync_job", entity_id: job.id, action: "sync_failed", after: { code: err.code, reference, attempts, will_retry: !exhausted }, actor_id: job.created_by });
      if (exhausted && job.created_by) await notify(ctx, job.created_by, { type: "jira_sync_failed", title: `Jira sync failed for ${t.reference}`, body: `Reference ${reference}`, link: `/jira/errors` });
    }
    log.warn("sync_job_failed", { code: err.code, status: err.status, attempts, will_retry: !exhausted, reference });
    if (!exhausted) throw err; // let the queue retry with its own backoff too
  }
}

/** Cron sweep: re-run jobs whose backoff has elapsed. */
export async function sweepDueSyncJobs(ctx: AppContext): Promise<number> {
  const due = await ctx.repos.jira.dueSyncJobs(nowIso(), 20);
  let n = 0;
  for (const j of due) {
    try { await runSyncJob(ctx, j.id); } catch { /* recorded in sync_errors */ }
    n++;
  }
  return n;
}
