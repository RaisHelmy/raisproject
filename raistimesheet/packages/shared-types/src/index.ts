/**
 * Shared domain types for Rais Timesheet.
 * Used by the Cloudflare Worker API and the React web app.
 * Nothing in here may contain secrets or Jira/AI implementation details.
 */

// ---------- Enumerations ----------

export const ROLES = ["ADMIN", "APPROVER", "USER"] as const;
export type Role = (typeof ROLES)[number];

/** Approval lifecycle of a timesheet entry. */
export const TIMESHEET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

/** Work completion status of the underlying task. */
export const WORK_STATUSES = ["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

/** Jira synchronisation state — independent of approval state. */
export const JIRA_SYNC_STATES = [
  "NOT_LINKED",
  "MATCH_SUGGESTED",
  "LINKED",
  "READY_TO_PUSH",
  "PUSHING",
  "SYNCED",
  "SYNC_FAILED",
] as const;
export type JiraSyncState = (typeof JIRA_SYNC_STATES)[number];

export const MATCH_TYPES = ["EXACT", "AI_SUGGESTED", "MANUAL", "CREATED"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_RESULTS = ["EXACT_MATCH", "SUGGESTED_MATCH", "NO_MATCH", "POTENTIAL_DUPLICATE"] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number];

export const IMPORT_STATUSES = ["UPLOADED", "QUEUED", "PARSING", "ANALYSING", "READY_FOR_REVIEW", "COMPLETED", "FAILED"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const WORK_ITEM_REVIEW_STATUSES = ["PENDING", "ACCEPTED", "IGNORED", "MERGED"] as const;
export type WorkItemReviewStatus = (typeof WORK_ITEM_REVIEW_STATUSES)[number];

export const AI_SOURCES = ["explicit", "inferred", "assumed", "unknown"] as const;
export type AISource = (typeof AI_SOURCES)[number];

export const DELAY_STATES = ["ON_TIME", "DELAYED", "AT_RISK", "BLOCKED", "NO_DUE_DATE", "OPEN"] as const;
export type DelayState = (typeof DELAY_STATES)[number];

export const REPORT_TYPES = ["TIMESHEET_SUMMARY", "DETAILED_TIMESHEET", "JIRA_RECONCILIATION", "DELAYED_TASKS", "PROJECT_WORKLOAD", "HR_TIMESHEET"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_FORMATS = ["XLSX", "PDF", "HTML"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const PARTICIPANT_ROLES = ["requester", "executor", "observer", "commenter", "other"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

// ---------- AI transparency ----------

/** Every AI-extracted field carries its provenance. Never a bare value. */
export interface AIField<T> {
  value: T;
  source: AISource;
  confidence: number; // 0..1
  reason: string;
}

export interface Evidence {
  message_id: string;
  reason: string;
}

export interface AIAssumption {
  key: string; // e.g. "work_date", "duration", "jira_issue", "completion"
  label: string;
  state: "confirmed" | "inferred" | "assumed" | "unknown";
  summary: string;
  reasoning: string;
}

export interface ParticipantSummary {
  name: string;
  message_count: number;
  role: ParticipantRole;
  is_me: boolean;
}

// ---------- Entities (API DTOs) ----------

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  timezone: string;
  whatsapp_aliases: string[];
  jira_account_id: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface ClientDTO {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ProjectDTO {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  code: string;
  jira_project_key: string | null;
  jira_url: string | null;
  default_issue_type: string;
  default_assignee_account_id: string | null;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  is_active: boolean;
}

export interface TimesheetDTO {
  id: string;
  reference: string;
  user_id: string;
  user_name: string;
  project_id: string;
  project_code: string;
  project_name: string;
  work_date: string; // YYYY-MM-DD
  title: string;
  description: string;
  start_time: string | null; // HH:MM
  end_time: string | null;
  duration_minutes: number;
  status: TimesheetStatus;
  work_status: WorkStatus;
  jira_sync_status: JiraSyncState;
  jira_issue_key: string | null;
  source_import_id: string | null;
  source_work_item_id: string | null;
  confidence: number | null;
  ai_generated: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimesheetApprovalDTO {
  id: string;
  timesheet_id: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "RETURNED_TO_DRAFT";
  actor_name: string;
  reason: string | null;
  created_at: string;
}

export interface AuditLogDTO {
  id: string;
  actor_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  source: string;
  created_at: string;
}

export interface ImportDTO {
  id: string;
  user_id: string;
  project_id: string;
  project_code: string;
  filename: string;
  file_size: number;
  status: ImportStatus;
  message_count: number;
  messages_processed: number;
  tasks_detected: number;
  ai_provider: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportMessageDTO {
  id: string;
  seq: number;
  timestamp: string; // ISO
  sender: string;
  message: string;
  is_system: boolean;
  is_attachment: boolean;
  is_deleted: boolean;
}

export interface JiraCandidateDTO {
  issue_key: string;
  summary: string;
  confidence: number;
  reason: string;
  result: MatchResult;
}

export interface WorkItemDTO {
  id: string;
  import_id: string;
  title: string;
  description: string;
  executor: string;
  work_date: AIField<string>;
  duration_minutes: AIField<number>;
  start_time: AIField<string | null>;
  end_time: AIField<string | null>;
  work_status: AIField<WorkStatus>;
  jira_candidates: JiraCandidateDTO[];
  explicit_jira_key: string | null;
  confidence: number;
  evidence: Evidence[];
  assumptions: AIAssumption[];
  review_status: WorkItemReviewStatus;
  timesheet_id: string | null;
  is_mine: boolean;
}

export interface AnalysisSummaryDTO {
  provider: string;
  model: string | null;
  is_demo: boolean;
  participants: ParticipantSummary[];
  message_count: number;
  work_message_count: number;
  noise_message_count: number;
  task_count: number;
  warnings: string[];
}

export interface JiraIssueDTO {
  issue_key: string;
  summary: string;
  project_key: string;
  status: string;
  status_category: "new" | "indeterminate" | "done" | "unknown";
  issue_type: string;
  assignee_name: string | null;
  assignee_account_id: string | null;
  priority: string | null;
  due_date: string | null;
  resolved_at: string | null;
  url: string | null;
  timesheet_id: string | null;
  timesheet_reference: string | null;
  work_date: string | null;
  delay: DelayInfo;
}

export interface DelayInfo {
  state: DelayState;
  days: number | null;
  message: string;
}

export interface JiraLinkDTO {
  id: string;
  timesheet_id: string;
  jira_issue_key: string;
  match_type: MatchType;
  match_confidence: number | null;
  linked_at: string;
  linked_by_name: string | null;
  sync_status: JiraSyncState;
  last_sync_at: string | null;
  sync_error: string | null;
}

export interface ReconciliationRowDTO {
  timesheet: TimesheetDTO;
  result: MatchResult;
  candidates: JiraCandidateDTO[];
  link: JiraLinkDTO | null;
  sync_error: SyncErrorDTO | null;
}

export interface SyncErrorDTO {
  id: string;
  timesheet_id: string;
  timesheet_reference: string;
  error_code: string;
  error_message: string;
  reference: string;
  retry_count: number;
  created_at: string;
}

export interface JiraConnectionDTO {
  configured: boolean;
  demo_mode: boolean;
  status: "HEALTHY" | "DEGRADED" | "DISCONNECTED" | "DEMO";
  auth_type: "OAUTH" | "API_TOKEN" | "DEMO" | null;
  site_url: string | null;
  account_name: string | null;
  account_id: string | null;
  project_keys: string[];
  last_sync_at: string | null;
  last_successful_connection_at: string | null;
  last_error: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardDTO {
  greeting_name: string;
  is_approver: boolean;
  kpis: {
    pending_approval: number;
    pending_hours_minutes: number;
    jira_pending: number;
    delayed_tasks: number;
    hours_this_month_minutes: number;
    drafts: number;
    ai_review_pending: number;
    sync_errors: number;
  };
  attention: AttentionItem[];
  charts: {
    hours_by_day: { date: string; minutes: number }[];
    hours_by_project: { project: string; minutes: number }[];
    task_status: { status: string; count: number }[];
    jira_sync_status: { status: string; count: number }[];
    delayed_tasks: { key: string; days: number; summary: string }[];
  };
  all_synced: boolean;
}

export interface AttentionItem {
  key: string;
  severity: "info" | "warning" | "danger";
  title: string;
  count: number;
  action_label: string;
  link: string;
}

export interface ReportJobDTO {
  id: string;
  type: ReportType;
  format: ReportFormat;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  params: ReportParams;
  row_count: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  download_available: boolean;
}

export interface ReportParams {
  type: ReportType;
  date_from: string;
  date_to: string;
  project_id?: string | null;
  client_id?: string | null;
  user_id?: string | null;
  status?: TimesheetStatus | null;
  jira_sync_status?: JiraSyncState | null;
  delayed_only?: boolean;
  /** HR timesheet only: anonymised public/audit view. */
  simplified?: boolean;
}

export interface ReportPreviewDTO {
  period: { from: string; to: string };
  entries: number;
  total_minutes: number;
  projects: number;
  delayed: number;
  jira_pending: number;
  completed: number;
  approved: number;
}

export interface HealthDTO {
  status: "ok" | "degraded";
  checks: Record<string, { status: "healthy" | "degraded" | "unconfigured"; detail?: string; last_ok_at?: string | null }>;
  demo_mode: { ai: boolean; jira: boolean };
  version: string;
}

export interface SearchResultDTO {
  type: "timesheet" | "jira" | "import" | "project" | "user";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

// ---------- API envelope ----------

export interface ApiSuccess<T> {
  success: true;
  data: T;
  warnings?: string[];
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; reference?: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ---------- Helpers ----------

export function formatMinutes(total: number | null | undefined): string {
  if (total === null || total === undefined || Number.isNaN(total)) return "—";
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}
export * from "./audit";
