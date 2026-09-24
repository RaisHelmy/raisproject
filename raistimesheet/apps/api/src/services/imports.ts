/**
 * WhatsApp import lifecycle: upload → R2 → queue → parse → AI analyse → review → drafts.
 */
import type { AppContext } from "./context";
import { isApprover } from "./context";
import { Errors } from "../lib/errors";
import { uuid } from "../lib/ids";
import { nowIso, todayIso } from "../lib/time";
import { audit, notify } from "./audit";
import { parseWhatsApp } from "./whatsapp/parser";
import { aiIsDemo, getAIProvider } from "./ai";
import type { AIMessage, ExtractedWorkItem } from "./ai/types";
import type { ImportMessageRow, ImportRow, WorkItemRow } from "../repositories/types";
import { createTimesheet, type TimesheetInput } from "./timesheets";
import { matchTimesheet } from "./jira/matcher";
import type { JiraCandidateDTO, WorkStatus } from "@rais/shared-types";

const ALLOWED_TYPES = new Set(["text/plain", "application/octet-stream", "application/zip", ""]);

export function r2KeyFor(importId: string, name: string, createdAt = new Date()): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  return `imports/${y}/${m}/${importId}/${name}`;
}

export async function createImport(ctx: AppContext, file: File, projectId: string): Promise<ImportRow & { project_code: string }> {
  const max = Number(ctx.env.MAX_UPLOAD_BYTES ?? "10485760") || 10485760;
  if (file.size > max) throw Errors.tooLarge(max);
  if (file.size === 0) throw Errors.validation("The uploaded file is empty.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["txt", "text", "log"].includes(ext) || !ALLOWED_TYPES.has(file.type)) throw Errors.unsupported("Only WhatsApp text exports (.txt) are supported right now. PDF, DOCX, HTML, JSON and screenshots are planned.");
  const project = await ctx.repos.projects.findById(projectId);
  if (!project || !project.is_active) throw Errors.validation("Please choose an active project.");
  if (!isApprover(ctx.user) && !(await ctx.repos.projects.isMember(projectId, ctx.user!.id))) throw Errors.forbidden("You are not a member of this project.");

  const id = uuid();
  const now = nowIso();
  const key = r2KeyFor(id, "original.txt");
  // Basic content sniff: reject binary-looking content
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (head.some((b) => b === 0)) throw Errors.unsupported("The file does not look like a text export.");
  await ctx.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: "text/plain; charset=utf-8" }, customMetadata: { import_id: id, user_id: ctx.user!.id } });
  const row: ImportRow = {
    id, user_id: ctx.user!.id, project_id: projectId, filename: file.name.slice(0, 200), file_size: file.size, content_type: "text/plain", r2_key_original: key, r2_key_normalized: null, r2_key_analysis: null,
    status: "QUEUED", message_count: 0, messages_processed: 0, tasks_detected: 0, ai_provider: null, error_message: null, correlation_id: ctx.correlationId, raw_deleted_at: null, created_at: now, updated_at: now, created_by: ctx.user!.id, updated_by: ctx.user!.id,
  };
  await ctx.repos.imports.create(row);
  await audit(ctx, { entity_type: "import", entity_id: id, action: "uploaded", after: { filename: row.filename, size: file.size, project_id: projectId } });
  await ctx.enqueue({ type: "ANALYSE_IMPORT", import_id: id, correlation_id: ctx.correlationId });
  return { ...row, project_code: project.code };
}

export async function getImport(ctx: AppContext, id: string) {
  const i = await ctx.repos.imports.findById(id);
  if (!i) throw Errors.notFound("Import");
  if (i.user_id !== ctx.user!.id && !isApprover(ctx.user)) throw Errors.notFound("Import");
  return i;
}

/** Re-run analysis for an import (e.g. after fixing aliases). Existing accepted drafts are kept. */
export async function reanalyse(ctx: AppContext, id: string): Promise<void> {
  const i = await getImport(ctx, id);
  // A run that died (e.g. the Worker hit a resource limit) leaves the status stuck; allow a restart once it has been silent for 10 minutes.
  const stale = Date.now() - Date.parse(i.updated_at) > 10 * 60 * 1000;
  if (["PARSING", "ANALYSING", "QUEUED"].includes(i.status) && !stale) throw Errors.invalidState("This import is already being analysed.");
  await ctx.repos.imports.update(id, { status: "QUEUED", error_message: null, updated_at: nowIso() });
  await audit(ctx, { entity_type: "import", entity_id: id, action: "reanalyse_requested" });
  await ctx.enqueue({ type: "ANALYSE_IMPORT", import_id: id, correlation_id: ctx.correlationId });
}

/** Background pipeline: parse → normalise → AI stages → persist → notify. */
export async function analyseImport(ctx: AppContext, importId: string): Promise<void> {
  const log = ctx.log.child({ import_id: importId });
  const imp = await ctx.repos.imports.findById(importId);
  if (!imp) return;
  if (!["QUEUED", "UPLOADED", "FAILED", "READY_FOR_REVIEW", "COMPLETED"].includes(imp.status)) return;
  const user = await ctx.repos.users.findById(imp.user_id);
  const project = await ctx.repos.projects.findById(imp.project_id);
  if (!user || !project) return;
  const analysisId = uuid();
  try {
    // 1. Parse
    await ctx.repos.imports.update(importId, { status: "PARSING", updated_at: nowIso() });
    const obj = imp.r2_key_original ? await ctx.env.FILES.get(imp.r2_key_original) : null;
    let rows: ImportMessageRow[];
    let parseWarnings: string[] = [];
    let normKey: string | null = imp.r2_key_normalized;
    if (obj) {
      const text = await obj.text(); // bounded by MAX_UPLOAD_BYTES
      const parsed = parseWhatsApp(text, { timezone: project.timezone });
      if (!parsed.messages.length) throw new Error("No WhatsApp messages could be recognised in this file. Make sure it is an exported chat (.txt).");
      parseWarnings = parsed.warnings;
      // 2. Normalise + persist messages
      rows = parsed.messages.map((m) => ({ id: uuid(), import_id: importId, seq: m.seq, timestamp: m.timestamp, sender: m.sender, message: m.message, is_system: m.is_system ? 1 : 0, is_attachment: m.is_attachment ? 1 : 0, is_deleted: m.is_deleted ? 1 : 0 }));
      await ctx.repos.imports.replaceMessages(importId, rows);
      normKey = r2KeyFor(importId, "normalized.json", new Date(imp.created_at));
      await ctx.env.FILES.put(normKey, JSON.stringify({ date_order: parsed.date_order, warnings: parsed.warnings, messages: rows.map(({ id, seq, timestamp, sender, is_system, is_attachment, is_deleted }) => ({ id, seq, timestamp, sender, is_system, is_attachment, is_deleted })) }), { httpMetadata: { contentType: "application/json" } });
    } else {
      // Raw file gone (retention) or never uploaded (seeded demo import): re-use normalised messages.
      rows = await ctx.repos.imports.messages(importId);
      if (!rows.length) throw new Error("Original file is no longer available (retention policy) and no normalised messages were kept.");
      parseWarnings = ["Analysed from stored normalised messages; the raw export is no longer available."];
    }
    await ctx.repos.imports.update(importId, { status: "ANALYSING", message_count: rows.length, messages_processed: 0, r2_key_normalized: normKey, updated_at: nowIso() });

    // 3–12. AI stages
    const { provider, reason } = getAIProvider(ctx.env, log);
    const isDemo = provider.is_demo && aiIsDemo(ctx.env);
    log.info("ai_provider_selected", { provider: provider.name, model: provider.model, demo: isDemo, reason });
    await ctx.repos.analyses.create({ id: analysisId, import_id: importId, provider: provider.name, model: provider.model, is_demo: isDemo ? 1 : 0, status: "RUNNING", summary_json: "{}", started_at: nowIso(), completed_at: null, error_message: null });
    const aiMessages: AIMessage[] = rows.map((r) => ({ id: r.id, seq: r.seq, timestamp: r.timestamp, sender: r.sender, message: r.message, is_system: !!r.is_system, is_attachment: !!r.is_attachment, is_deleted: !!r.is_deleted }));
    const aliases = JSON.parse(user.whatsapp_aliases || "[]") as string[];
    const result = await provider.analyse(aiMessages, {
      me_name: user.name, me_aliases: aliases, today: todayIso(project.timezone),
      project: { code: project.code, name: project.name, jira_project_key: project.jira_project_key, timezone: project.timezone, working_hours_start: project.working_hours_start, working_hours_end: project.working_hours_end },
    }, async (processed, detected) => { await ctx.repos.imports.update(importId, { messages_processed: processed, tasks_detected: detected, updated_at: nowIso() }); });

    // Jira candidate search per item (stage 12) using the local issue cache
    const issues = await ctx.repos.jira.allIssues(project.jira_project_key ? [project.jira_project_key] : undefined);
    const matchIssues = issues.map((i) => ({ key: i.issue_key, summary: i.summary, description: i.description, project_key: i.project_key, assignee_account_id: i.assignee_account_id, created: i.jira_created_at, updated: i.jira_updated_at, status_category: i.status_category }));
    const items: WorkItemRow[] = result.items.map((it, idx) => {
      const cands: JiraCandidateDTO[] = it.is_mine ? matchTimesheet({ title: it.title, description: it.description, work_date: it.work_date.value, explicit_jira_key: it.explicit_jira_key, user_jira_account_id: user.jira_account_id }, matchIssues, { project_key: project.jira_project_key }).slice(0, 3) : [];
      const jiraAssumption = it.assumptions.find((a) => a.key === "jira_issue");
      if (jiraAssumption && cands.length && !it.explicit_jira_key) { jiraAssumption.state = "inferred"; jiraAssumption.summary = `Suggested: ${cands[0]!.issue_key}`; jiraAssumption.reasoning = cands[0]!.reason; }
      return toWorkItemRow(analysisId, importId, it, cands, idx);
    });
    await ctx.repos.analyses.replaceWorkItems(analysisId, items);
    const removed = await ctx.repos.analyses.deleteUnreviewedWorkItems(importId, analysisId);
    if (removed) log.info("previous_work_items_replaced", { removed });
    const mineCount = items.filter((i) => i.is_mine).length;
    const summary = { provider: result.provider, model: result.model, is_demo: isDemo, participants: result.participants, message_count: rows.length, work_message_count: result.work_message_ids.length, noise_message_count: result.noise_count, task_count: mineCount, warnings: [...parseWarnings, ...result.warnings] };
    await ctx.repos.analyses.update(analysisId, { status: "COMPLETED", summary_json: JSON.stringify(summary), completed_at: nowIso() });
    const analysisKey = r2KeyFor(importId, "analysis.json", new Date(imp.created_at));
    await ctx.env.FILES.put(analysisKey, JSON.stringify({ summary, items: result.items }), { httpMetadata: { contentType: "application/json" } });
    await ctx.repos.imports.update(importId, { status: "READY_FOR_REVIEW", messages_processed: rows.length, tasks_detected: mineCount, ai_provider: isDemo ? `${provider.name} (demo)` : `${provider.name}/${provider.model}`, r2_key_analysis: analysisKey, error_message: null, updated_at: nowIso() });
    await audit(ctx, { entity_type: "import", entity_id: importId, action: "analysed", after: { provider: provider.name, model: provider.model, demo: isDemo, messages: rows.length, tasks: mineCount }, actor_id: null });
    await notify(ctx, imp.user_id, { type: "ai_review", title: `${mineCount} work item${mineCount === 1 ? "" : "s"} ready for review`, body: imp.filename, link: `/imports/${importId}/review` });
    log.info("import_analysed", { messages: rows.length, tasks: mineCount, provider: provider.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed.";
    log.error("import_failed", { error: e });
    await ctx.repos.analyses.update(analysisId, { status: "FAILED", error_message: msg.slice(0, 500), completed_at: nowIso() }).catch(() => undefined);
    await ctx.repos.imports.update(importId, { status: "FAILED", error_message: msg.slice(0, 500), updated_at: nowIso() });
    await notify(ctx, imp.user_id, { type: "import_failed", title: "Conversation analysis failed", body: msg.slice(0, 200), link: `/imports/${importId}` });
  }
}

function toWorkItemRow(analysisId: string, importId: string, it: ExtractedWorkItem, cands: JiraCandidateDTO[], idx: number): WorkItemRow {
  const now = nowIso();
  return {
    id: uuid(), analysis_id: analysisId, import_id: importId, title: it.title, description: it.description, executor: it.executor, is_mine: it.is_mine ? 1 : 0,
    work_date_json: JSON.stringify(it.work_date), duration_json: JSON.stringify(it.duration_minutes), start_time_json: JSON.stringify(it.start_time), end_time_json: JSON.stringify(it.end_time),
    work_status_json: JSON.stringify(it.work_status), jira_candidates_json: JSON.stringify(cands), explicit_jira_key: it.explicit_jira_key, confidence: it.confidence,
    evidence_json: JSON.stringify(it.evidence), assumptions_json: JSON.stringify(it.assumptions), review_status: "PENDING", timesheet_id: null, sort_order: idx, created_at: now, updated_at: now,
  };
}

// ---------- Review actions (human-in-the-loop) ----------

export interface AcceptOverrides { title?: string; description?: string; work_date?: string; duration_minutes?: number; start_time?: string | null; end_time?: string | null; work_status?: WorkStatus }

export async function acceptWorkItem(ctx: AppContext, workItemId: string, overrides: AcceptOverrides = {}): Promise<{ timesheet_id: string; reference: string }> {
  const w = await ctx.repos.analyses.workItem(workItemId);
  if (!w) throw Errors.notFound("Work item");
  const imp = await getImport(ctx, w.import_id);
  if (w.timesheet_id) { const t = await ctx.repos.timesheets.findById(w.timesheet_id); if (t && t.status !== ("DELETED" as string)) return { timesheet_id: t.id, reference: t.reference }; }
  const wd = JSON.parse(w.work_date_json) as { value: string };
  const du = JSON.parse(w.duration_json) as { value: number };
  const st = JSON.parse(w.start_time_json) as { value: string | null };
  const et = JSON.parse(w.end_time_json) as { value: string | null };
  const ws = JSON.parse(w.work_status_json) as { value: WorkStatus };
  const input: TimesheetInput = {
    project_id: imp.project_id, work_date: overrides.work_date ?? wd.value, title: overrides.title ?? w.title, description: overrides.description ?? w.description,
    start_time: overrides.start_time === undefined ? st.value : overrides.start_time, end_time: overrides.end_time === undefined ? et.value : overrides.end_time,
    duration_minutes: overrides.duration_minutes ?? du.value, work_status: overrides.work_status ?? (ws.value === "UNKNOWN" ? "COMPLETED" : ws.value),
  };
  const edited = Object.keys(overrides).length > 0;
  const t = await createTimesheet(ctx, input, { source_import_id: imp.id, source_work_item_id: w.id, confidence: w.confidence, ai_generated: 1, user_id: imp.user_id });
  await ctx.repos.analyses.updateWorkItem(w.id, { review_status: "ACCEPTED", timesheet_id: t.id, is_mine: 1, updated_at: nowIso() });
  await audit(ctx, { entity_type: "work_item", entity_id: w.id, action: edited ? "accepted_with_edits" : "accepted", before: edited ? { title: w.title, work_date: wd.value, duration_minutes: du.value } : undefined, after: { timesheet_id: t.id, ...overrides } });
  return { timesheet_id: t.id, reference: t.reference };
}

export async function ignoreWorkItem(ctx: AppContext, workItemId: string, reason?: string): Promise<void> {
  const w = await ctx.repos.analyses.workItem(workItemId);
  if (!w) throw Errors.notFound("Work item");
  await getImport(ctx, w.import_id);
  if (w.timesheet_id) throw Errors.invalidState("This item already has a timesheet. Delete the draft first.");
  await ctx.repos.analyses.updateWorkItem(w.id, { review_status: "IGNORED", updated_at: nowIso() });
  await audit(ctx, { entity_type: "work_item", entity_id: w.id, action: "ignored", reason: reason ?? null });
}

export async function restoreWorkItem(ctx: AppContext, workItemId: string): Promise<void> {
  const w = await ctx.repos.analyses.workItem(workItemId);
  if (!w) throw Errors.notFound("Work item");
  await getImport(ctx, w.import_id);
  await ctx.repos.analyses.updateWorkItem(w.id, { review_status: "PENDING", updated_at: nowIso() });
  await audit(ctx, { entity_type: "work_item", entity_id: w.id, action: "restored" });
}

/** Split: the user assigns evidence message ids to two or more new items (titles optional). */
export async function splitWorkItem(ctx: AppContext, workItemId: string, parts: { title?: string; message_ids: string[] }[]): Promise<string[]> {
  const w = await ctx.repos.analyses.workItem(workItemId);
  if (!w) throw Errors.notFound("Work item");
  await getImport(ctx, w.import_id);
  if (w.timesheet_id) throw Errors.invalidState("Cannot split an item that already has a timesheet.");
  if (parts.length < 2) throw Errors.validation("Choose at least two groups of messages to split into.");
  const evidence = JSON.parse(w.evidence_json) as { message_id: string; reason: string }[];
  const msgs = await ctx.repos.imports.messagesByIds(evidence.map((e) => e.message_id));
  const ids: string[] = [];
  let order = w.sort_order;
  for (const p of parts) {
    const part = msgs.filter((m) => p.message_ids.includes(m.id));
    if (!part.length) throw Errors.validation("Each split group must contain at least one message.");
    const first = part[0]!, last = part[part.length - 1]!;
    const dur = Math.max(15, Math.round((Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 60000 / 15) * 15);
    const title = p.title?.trim() || `${w.title} (part)`;
    const row: WorkItemRow = {
      ...w, id: uuid(), title, description: part.map((m) => `${m.timestamp.slice(11, 16)} ${m.sender}: ${m.message}`).join("\n"),
      work_date_json: JSON.stringify({ value: first.timestamp.slice(0, 10), source: "explicit", confidence: 0.9, reason: "First message of this split group." }),
      duration_json: JSON.stringify({ value: dur, source: "inferred", confidence: 0.4, reason: `Split by user; window ${first.timestamp.slice(11, 16)}–${last.timestamp.slice(11, 16)}. Please review.` }),
      start_time_json: JSON.stringify({ value: first.timestamp.slice(11, 16), source: "inferred", confidence: 0.5, reason: "First message of split group." }),
      end_time_json: JSON.stringify({ value: last.timestamp.slice(11, 16), source: "inferred", confidence: 0.5, reason: "Last message of split group." }),
      evidence_json: JSON.stringify(part.map((m) => ({ message_id: m.id, reason: "Assigned by user during split" }))),
      assumptions_json: JSON.stringify([{ key: "duration", label: "Duration", state: "inferred", summary: `${dur} min`, reasoning: "Estimated from the split group's activity window. Please confirm." }]),
      review_status: "PENDING", timesheet_id: null, sort_order: ++order, created_at: nowIso(), updated_at: nowIso(), confidence: 0.5, jira_candidates_json: "[]",
    };
    await ctx.repos.analyses.insertWorkItem(row);
    ids.push(row.id);
  }
  await ctx.repos.analyses.updateWorkItem(w.id, { review_status: "MERGED", updated_at: nowIso() });
  await audit(ctx, { entity_type: "work_item", entity_id: w.id, action: "split", after: { into: ids } });
  return ids;
}

/** Merge: combine several pending items into one (title from first; evidence/durations summed). */
export async function mergeWorkItems(ctx: AppContext, ids: string[], title?: string): Promise<string> {
  if (ids.length < 2) throw Errors.validation("Choose at least two items to merge.");
  const items = (await Promise.all(ids.map((id) => ctx.repos.analyses.workItem(id)))).filter((x): x is WorkItemRow => !!x);
  if (items.length !== ids.length) throw Errors.notFound("Work item");
  const importId = items[0]!.import_id;
  if (items.some((i) => i.import_id !== importId)) throw Errors.validation("Items must belong to the same import.");
  if (items.some((i) => i.timesheet_id)) throw Errors.invalidState("Cannot merge items that already have timesheets.");
  await getImport(ctx, importId);
  const first = items[0]!;
  const totalMin = items.reduce((a, i) => a + ((JSON.parse(i.duration_json) as { value: number }).value || 0), 0);
  const evidence = items.flatMap((i) => JSON.parse(i.evidence_json) as { message_id: string; reason: string }[]);
  const row: WorkItemRow = {
    ...first, id: uuid(), title: title?.trim() || first.title, description: items.map((i) => i.description).join("\n\n"),
    duration_json: JSON.stringify({ value: totalMin, source: "inferred", confidence: 0.5, reason: `Sum of ${items.length} merged items. Please review.` }),
    evidence_json: JSON.stringify(evidence), assumptions_json: JSON.stringify([{ key: "duration", label: "Duration", state: "inferred", summary: `${totalMin} min`, reasoning: "Sum of merged items." }]),
    review_status: "PENDING", timesheet_id: null, created_at: nowIso(), updated_at: nowIso(), confidence: Math.min(...items.map((i) => i.confidence)),
  };
  await ctx.repos.analyses.insertWorkItem(row);
  for (const i of items) await ctx.repos.analyses.updateWorkItem(i.id, { review_status: "MERGED", updated_at: nowIso() });
  await audit(ctx, { entity_type: "work_item", entity_id: row.id, action: "merged", after: { from: ids } });
  return row.id;
}

/** Accept every pending item of an import as-is (bulk "Create drafts"). */
export async function acceptAllPending(ctx: AppContext, importId: string): Promise<{ created: number; references: string[] }> {
  await getImport(ctx, importId);
  const items = (await ctx.repos.analyses.workItems(importId)).filter((w) => w.review_status === "PENDING" && w.is_mine && !w.timesheet_id);
  const refs: string[] = [];
  for (const w of items) { const r = await acceptWorkItem(ctx, w.id); refs.push(r.reference); }
  const remaining = (await ctx.repos.analyses.workItems(importId)).some((w) => w.review_status === "PENDING" && w.is_mine);
  if (!remaining) await ctx.repos.imports.update(importId, { status: "COMPLETED", updated_at: nowIso() });
  return { created: refs.length, references: refs };
}

export async function markImportCompleteIfDone(ctx: AppContext, importId: string): Promise<void> {
  const pending = (await ctx.repos.analyses.workItems(importId)).some((w) => w.review_status === "PENDING" && w.is_mine);
  if (!pending) await ctx.repos.imports.update(importId, { status: "COMPLETED", updated_at: nowIso() });
}
