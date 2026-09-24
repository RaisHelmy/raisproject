import type {
  AuditLogDTO, ImportDTO, ImportMessageDTO, JiraIssueDTO, JiraLinkDTO, JiraSyncState, NotificationDTO, ProjectDTO, ReportJobDTO, SyncErrorDTO,
  TimesheetApprovalDTO, TimesheetDTO, TimesheetStatus, UserDTO, WorkItemDTO, WorkStatus, Role, MatchType, ReportType, ReportFormat, ReportParams,
} from "@rais/shared-types";
import type * as T from "../repositories/types";
import { classifyDelay } from "../lib/delay";

export function toUserDTO(u: T.UserRow, roles: string[]): UserDTO {
  return {
    id: u.id, email: u.email, name: u.name, roles: roles as Role[], timezone: u.timezone,
    whatsapp_aliases: safeJson<string[]>(u.whatsapp_aliases, []), jira_account_id: u.jira_account_id,
    is_active: !!u.is_active, onboarding_completed: !!u.onboarding_completed, created_at: u.created_at,
  };
}

export function toProjectDTO(p: T.ProjectRow & { client_name: string }): ProjectDTO {
  return {
    id: p.id, client_id: p.client_id, client_name: p.client_name, name: p.name, code: p.code, jira_project_key: p.jira_project_key,
    jira_url: p.jira_url, default_issue_type: p.default_issue_type, default_assignee_account_id: p.default_assignee_account_id,
    timezone: p.timezone, working_hours_start: p.working_hours_start, working_hours_end: p.working_hours_end, is_active: !!p.is_active,
  };
}

export function toTimesheetDTO(t: T.TimesheetJoined): TimesheetDTO {
  return {
    id: t.id, reference: t.reference, user_id: t.user_id, user_name: t.user_name, project_id: t.project_id, project_code: t.project_code,
    project_name: t.project_name, work_date: t.work_date, title: t.title, description: t.description, start_time: t.start_time, end_time: t.end_time,
    duration_minutes: t.duration_minutes, status: t.status as TimesheetStatus, work_status: t.work_status as WorkStatus,
    jira_sync_status: t.jira_sync_status as JiraSyncState, jira_issue_key: t.jira_issue_key ?? null, source_import_id: t.source_import_id,
    source_work_item_id: t.source_work_item_id, confidence: t.confidence, ai_generated: !!t.ai_generated, submitted_at: t.submitted_at,
    approved_at: t.approved_at, approved_by_name: t.approved_by_name ?? null, rejection_reason: t.rejection_reason, created_at: t.created_at, updated_at: t.updated_at,
  };
}

export function toApprovalDTO(a: T.ApprovalRow): TimesheetApprovalDTO {
  return { id: a.id, timesheet_id: a.timesheet_id, action: a.action as TimesheetApprovalDTO["action"], actor_name: a.actor_name ?? "", reason: a.reason, created_at: a.created_at };
}

export function toAuditDTO(a: T.AuditRow): AuditLogDTO {
  return {
    id: a.id, actor_name: a.actor_name ?? null, entity_type: a.entity_type, entity_id: a.entity_id, action: a.action,
    before: a.before_json ? safeJson(a.before_json, null) : null, after: a.after_json ? safeJson(a.after_json, null) : null,
    reason: a.reason, source: a.source, created_at: a.created_at,
  };
}

export function toImportDTO(i: T.ImportRow & { project_code: string }): ImportDTO {
  return {
    id: i.id, user_id: i.user_id, project_id: i.project_id, project_code: i.project_code, filename: i.filename, file_size: i.file_size,
    status: i.status as ImportDTO["status"], message_count: i.message_count, messages_processed: i.messages_processed, tasks_detected: i.tasks_detected,
    ai_provider: i.ai_provider, error_message: i.error_message, created_at: i.created_at, updated_at: i.updated_at,
  };
}

export function toMessageDTO(m: T.ImportMessageRow): ImportMessageDTO {
  return { id: m.id, seq: m.seq, timestamp: m.timestamp, sender: m.sender, message: m.message, is_system: !!m.is_system, is_attachment: !!m.is_attachment, is_deleted: !!m.is_deleted };
}

export function toWorkItemDTO(w: T.WorkItemRow): WorkItemDTO {
  return {
    id: w.id, import_id: w.import_id, title: w.title, description: w.description, executor: w.executor,
    work_date: safeJson(w.work_date_json, { value: "", source: "unknown", confidence: 0, reason: "" }),
    duration_minutes: safeJson(w.duration_json, { value: 0, source: "unknown", confidence: 0, reason: "" }),
    start_time: safeJson(w.start_time_json, { value: null, source: "unknown", confidence: 0, reason: "" }),
    end_time: safeJson(w.end_time_json, { value: null, source: "unknown", confidence: 0, reason: "" }),
    work_status: safeJson(w.work_status_json, { value: "UNKNOWN", source: "unknown", confidence: 0, reason: "" }),
    jira_candidates: safeJson(w.jira_candidates_json, []), explicit_jira_key: w.explicit_jira_key, confidence: w.confidence,
    evidence: safeJson(w.evidence_json, []), assumptions: safeJson(w.assumptions_json, []),
    review_status: w.review_status as WorkItemDTO["review_status"], timesheet_id: w.timesheet_id, is_mine: !!w.is_mine,
  };
}

export function toJiraIssueDTO(i: T.JiraIssueRow, today: string, link?: { timesheet_id: string; reference: string; work_date: string } | null): JiraIssueDTO {
  const cat = (["new", "indeterminate", "done"].includes(i.status_category) ? i.status_category : "unknown") as JiraIssueDTO["status_category"];
  return {
    issue_key: i.issue_key, summary: i.summary, project_key: i.project_key, status: i.status, status_category: cat, issue_type: i.issue_type,
    assignee_name: i.assignee_name, assignee_account_id: i.assignee_account_id, priority: i.priority, due_date: i.due_date, resolved_at: i.resolved_at, url: i.url,
    timesheet_id: link?.timesheet_id ?? null, timesheet_reference: link?.reference ?? null, work_date: link?.work_date ?? null,
    delay: classifyDelay({ due_date: i.due_date, resolved_at: i.resolved_at, status_category: cat, status: i.status, today }),
  };
}

export function toJiraLinkDTO(l: T.JiraLinkRow): JiraLinkDTO {
  return {
    id: l.id, timesheet_id: l.timesheet_id, jira_issue_key: l.jira_issue_key, match_type: l.match_type as MatchType, match_confidence: l.match_confidence,
    linked_at: l.linked_at, linked_by_name: l.linked_by_name ?? null, sync_status: l.sync_status as JiraSyncState, last_sync_at: l.last_sync_at, sync_error: l.sync_error,
  };
}

export function toSyncErrorDTO(e: T.SyncErrorRow): SyncErrorDTO {
  return { id: e.id, timesheet_id: e.timesheet_id ?? "", timesheet_reference: e.timesheet_reference ?? "", error_code: e.error_code, error_message: e.error_message, reference: e.reference, retry_count: e.retry_count, created_at: e.created_at };
}

export function toNotificationDTO(n: T.NotificationRow): NotificationDTO {
  return { id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, is_read: !!n.is_read, created_at: n.created_at };
}

export function toReportJobDTO(r: T.ReportJobRow): ReportJobDTO {
  return {
    id: r.id, type: r.type as ReportType, format: r.format as ReportFormat, status: r.status as ReportJobDTO["status"], params: safeJson<ReportParams>(r.params_json, { type: r.type as ReportType, date_from: "", date_to: "" }),
    row_count: r.row_count, error: r.error_message, created_at: r.created_at, completed_at: r.completed_at, download_available: r.status === "COMPLETED" && !!r.r2_key,
  };
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
