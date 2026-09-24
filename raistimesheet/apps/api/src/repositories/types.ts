/** Persistence row shapes (storage-neutral). JSON columns are strings. */

export interface UserRow {
  id: string; email: string; name: string; password_hash: string; timezone: string;
  whatsapp_aliases: string; jira_account_id: string | null; is_active: number;
  onboarding_completed: number; created_at: string; updated_at: string; created_by?: string | null; updated_by?: string | null;
}
export interface SessionRow { id: string; user_id: string; token_hash: string; expires_at: string; created_at: string; user_agent: string | null }
export interface ApiTokenRow { id: string; user_id: string; name: string; token_hash: string; created_at: string; last_used_at: string | null }
export interface ClientRow { id: string; name: string; code: string; is_active: number; created_at: string; updated_at: string }
export interface ProjectRow {
  id: string; client_id: string; name: string; code: string; jira_project_key: string | null; jira_url: string | null;
  default_issue_type: string; default_assignee_account_id: string | null; timezone: string;
  working_hours_start: string; working_hours_end: string; is_active: number; created_at: string; updated_at: string;
}
export interface ImportRow {
  id: string; user_id: string; project_id: string; filename: string; file_size: number; content_type: string | null;
  r2_key_original: string | null; r2_key_normalized: string | null; r2_key_analysis: string | null; status: string;
  message_count: number; messages_processed: number; tasks_detected: number; ai_provider: string | null;
  error_message: string | null; correlation_id: string | null; raw_deleted_at: string | null; created_at: string; updated_at: string; created_by?: string | null; updated_by?: string | null;
}
export interface ImportMessageRow {
  id: string; import_id: string; seq: number; timestamp: string; sender: string; message: string;
  is_system: number; is_attachment: number; is_deleted: number;
}
export interface AnalysisRow {
  id: string; import_id: string; provider: string; model: string | null; is_demo: number; status: string;
  summary_json: string; started_at: string; completed_at: string | null; error_message: string | null;
}
export interface WorkItemRow {
  id: string; analysis_id: string; import_id: string; title: string; description: string; executor: string; is_mine: number;
  work_date_json: string; duration_json: string; start_time_json: string; end_time_json: string; work_status_json: string;
  jira_candidates_json: string; explicit_jira_key: string | null; confidence: number; evidence_json: string;
  assumptions_json: string; review_status: string; timesheet_id: string | null; sort_order: number; created_at: string; updated_at: string;
}
export interface TimesheetRow {
  id: string; reference: string; user_id: string; project_id: string; work_date: string; title: string; description: string;
  start_time: string | null; end_time: string | null; duration_minutes: number; status: string; work_status: string;
  jira_sync_status: string; source_import_id: string | null; source_work_item_id: string | null; confidence: number | null;
  ai_generated: number; submitted_at: string | null; approved_at: string | null; approved_by: string | null;
  rejection_reason: string | null; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null;
}
export interface TimesheetJoined extends TimesheetRow {
  user_name: string; project_code: string; project_name: string; client_id: string; approved_by_name: string | null; jira_issue_key: string | null;
}
export interface ApprovalRow { id: string; timesheet_id: string; action: string; actor_id: string; reason: string | null; created_at: string; actor_name?: string }
export interface JiraConnectionRow {
  id: string; auth_type: string; site_url: string; cloud_id: string | null; account_id: string | null; account_name: string | null;
  account_email: string | null; access_token_enc: string | null; refresh_token_enc: string | null; api_token_enc: string | null;
  token_expires_at: string | null; status: string; last_sync_at: string | null; last_ok_at: string | null; last_error: string | null;
  is_active: number; created_at: string; updated_at: string; created_by?: string | null; updated_by?: string | null;
}
export interface JiraIssueRow {
  id: string; issue_key: string; issue_id: string | null; project_key: string; summary: string; description: string | null; status: string;
  status_category: string; issue_type: string; assignee_account_id: string | null; assignee_name: string | null; priority: string | null;
  due_date: string | null; resolved_at: string | null; jira_created_at: string | null; jira_updated_at: string | null; url: string | null;
  is_demo: number; synced_at: string;
}
export interface JiraLinkRow {
  id: string; timesheet_id: string; jira_issue_key: string; match_type: string; match_confidence: number | null; linked_at: string;
  linked_by: string | null; sync_status: string; last_sync_at: string | null; sync_error: string | null; idempotency_key: string;
  created_at: string; updated_at: string; linked_by_name?: string | null;
}
export interface MatchCandidateRow { id: string; timesheet_id: string; jira_issue_key: string; result: string; confidence: number; reason: string; status: string; created_at: string }
export interface SyncJobRow {
  id: string; type: string; timesheet_id: string | null; payload_json: string; status: string; attempts: number; max_attempts: number;
  next_run_at: string | null; idempotency_key: string; correlation_id: string; last_error: string | null; result_json: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export interface SyncErrorRow {
  id: string; sync_job_id: string | null; timesheet_id: string | null; error_code: string; error_message: string; reference: string;
  retry_count: number; correlation_id: string | null; resolved_at: string | null; created_at: string; timesheet_reference?: string;
}
export interface NotificationRow { id: string; user_id: string; type: string; title: string; body: string; link: string; is_read: number; created_at: string }
export interface AuditRow {
  id: string; actor_id: string | null; entity_type: string; entity_id: string; action: string; before_json: string | null;
  after_json: string | null; reason: string | null; source: string; correlation_id: string | null; created_at: string; actor_name?: string | null;
}
export interface ReportJobRow {
  id: string; user_id: string; type: string; format: string; params_json: string; status: string; r2_key: string | null;
  row_count: number | null; error_message: string | null; created_at: string; completed_at: string | null;
}

export interface TimesheetFilter {
  user_id?: string;
  project_id?: string;
  client_id?: string;
  status?: string | string[];
  jira_sync_status?: string | string[];
  work_status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  ids?: string[];
}
export interface Page { offset: number; limit: number }
export interface Sort { column: string; direction: "asc" | "desc" }
