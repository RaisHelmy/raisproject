/**
 * Repository interfaces. Business logic depends on these, never on D1 SQL directly,
 * so a PostgreSQL implementation can be swapped in later.
 */
import type * as T from "./types";

export interface UserRepository {
  findById(id: string): Promise<T.UserRow | null>;
  findByEmail(email: string): Promise<T.UserRow | null>;
  list(): Promise<T.UserRow[]>;
  create(u: T.UserRow): Promise<void>;
  update(id: string, patch: Partial<T.UserRow>): Promise<void>;
  rolesFor(userId: string): Promise<string[]>;
  setRoles(userId: string, roles: string[]): Promise<void>;
  rolesForMany(userIds: string[]): Promise<Map<string, string[]>>;
}

export interface SessionRepository {
  create(s: T.SessionRow): Promise<void>;
  findByTokenHash(hash: string): Promise<T.SessionRow | null>;
  deleteByTokenHash(hash: string): Promise<void>;
  deleteExpired(now: string): Promise<number>;
  createApiToken(t: T.ApiTokenRow): Promise<void>;
  findApiTokenByHash(hash: string): Promise<T.ApiTokenRow | null>;
  touchApiToken(id: string, when: string): Promise<void>;
  listApiTokens(userId: string): Promise<T.ApiTokenRow[]>;
  deleteApiToken(id: string, userId: string): Promise<void>;
}

export interface ClientRepository {
  list(): Promise<T.ClientRow[]>;
  findById(id: string): Promise<T.ClientRow | null>;
  create(c: T.ClientRow): Promise<void>;
  update(id: string, patch: Partial<T.ClientRow>): Promise<void>;
}

export interface ProjectRepository {
  list(opts?: { active_only?: boolean; user_id?: string }): Promise<(T.ProjectRow & { client_name: string })[]>;
  findById(id: string): Promise<(T.ProjectRow & { client_name: string }) | null>;
  findByJiraKey(key: string): Promise<T.ProjectRow | null>;
  create(p: T.ProjectRow): Promise<void>;
  update(id: string, patch: Partial<T.ProjectRow>): Promise<void>;
  isMember(projectId: string, userId: string): Promise<boolean>;
  setMembers(projectId: string, userIds: string[]): Promise<void>;
  members(projectId: string): Promise<string[]>;
}

export interface ImportRepository {
  create(i: T.ImportRow): Promise<void>;
  findById(id: string): Promise<(T.ImportRow & { project_code: string }) | null>;
  list(filter: { user_id?: string }, page: T.Page): Promise<{ items: (T.ImportRow & { project_code: string })[]; total: number }>;
  update(id: string, patch: Partial<T.ImportRow>): Promise<void>;
  replaceMessages(importId: string, messages: T.ImportMessageRow[]): Promise<void>;
  messages(importId: string): Promise<T.ImportMessageRow[]>;
  messagesByIds(ids: string[]): Promise<T.ImportMessageRow[]>;
  olderThan(iso: string, withRaw: boolean): Promise<T.ImportRow[]>;
}

export interface AnalysisRepository {
  create(a: T.AnalysisRow): Promise<void>;
  update(id: string, patch: Partial<T.AnalysisRow>): Promise<void>;
  latestForImport(importId: string): Promise<T.AnalysisRow | null>;
  replaceWorkItems(analysisId: string, items: T.WorkItemRow[]): Promise<void>;
  /** Remove items of earlier analyses that were never accepted (keeps ACCEPTED items and their timesheets). */
  deleteUnreviewedWorkItems(importId: string, keepAnalysisId: string): Promise<number>;
  workItems(importId: string): Promise<T.WorkItemRow[]>;
  workItem(id: string): Promise<T.WorkItemRow | null>;
  updateWorkItem(id: string, patch: Partial<T.WorkItemRow>): Promise<void>;
  insertWorkItem(item: T.WorkItemRow): Promise<void>;
  countPendingReview(userId: string): Promise<number>;
}

export interface TimesheetRepository {
  nextReference(year: number): Promise<string>;
  create(t: T.TimesheetRow): Promise<void>;
  findById(id: string): Promise<T.TimesheetJoined | null>;
  findByReference(ref: string): Promise<T.TimesheetJoined | null>;
  list(filter: T.TimesheetFilter, page: T.Page, sort?: T.Sort): Promise<{ items: T.TimesheetJoined[]; total: number }>;
  update(id: string, patch: Partial<T.TimesheetRow>): Promise<void>;
  addApproval(a: T.ApprovalRow): Promise<void>;
  approvals(timesheetId: string): Promise<T.ApprovalRow[]>;
  summary(filter: T.TimesheetFilter): Promise<{ count: number; minutes: number; projects: number; completed: number; approved: number; jira_pending: number }>;
  minutesByDay(filter: T.TimesheetFilter): Promise<{ date: string; minutes: number }[]>;
  minutesByProject(filter: T.TimesheetFilter): Promise<{ project: string; minutes: number }[]>;
  countBy(filter: T.TimesheetFilter, column: "status" | "work_status" | "jira_sync_status"): Promise<{ key: string; count: number }[]>;
}

export interface JiraRepository {
  activeConnection(): Promise<T.JiraConnectionRow | null>;
  saveConnection(c: T.JiraConnectionRow): Promise<void>;
  updateConnection(id: string, patch: Partial<T.JiraConnectionRow>): Promise<void>;
  deactivateConnections(): Promise<void>;
  saveOauthState(state: string, userId: string, createdAt: string): Promise<void>;
  consumeOauthState(state: string): Promise<{ user_id: string; created_at: string } | null>;

  upsertIssues(issues: T.JiraIssueRow[]): Promise<void>;
  findIssue(key: string): Promise<T.JiraIssueRow | null>;
  listIssues(filter: { project_keys?: string[]; assignee_account_id?: string; search?: string; status_category?: string; is_demo?: boolean }, page: T.Page): Promise<{ items: T.JiraIssueRow[]; total: number }>;
  allIssues(projectKeys?: string[]): Promise<T.JiraIssueRow[]>;
  deleteDemoIssues(): Promise<void>;

  upsertLink(l: T.JiraLinkRow): Promise<void>;
  linkForTimesheet(timesheetId: string): Promise<T.JiraLinkRow | null>;
  linksForTimesheets(ids: string[]): Promise<Map<string, T.JiraLinkRow>>;
  linksForIssue(key: string): Promise<T.JiraLinkRow[]>;
  updateLink(id: string, patch: Partial<T.JiraLinkRow>): Promise<void>;
  deleteLink(timesheetId: string): Promise<void>;

  replaceCandidates(timesheetId: string, c: T.MatchCandidateRow[]): Promise<void>;
  candidates(timesheetId: string): Promise<T.MatchCandidateRow[]>;
  candidatesForTimesheets(ids: string[]): Promise<Map<string, T.MatchCandidateRow[]>>;
  updateCandidates(timesheetId: string, status: string): Promise<void>;

  createSyncJob(j: T.SyncJobRow): Promise<void>;
  findSyncJob(id: string): Promise<T.SyncJobRow | null>;
  findSyncJobByKey(key: string): Promise<T.SyncJobRow | null>;
  updateSyncJob(id: string, patch: Partial<T.SyncJobRow>): Promise<void>;
  dueSyncJobs(now: string, limit: number): Promise<T.SyncJobRow[]>;

  createSyncError(e: T.SyncErrorRow): Promise<void>;
  openSyncErrors(page: T.Page, timesheetId?: string): Promise<{ items: T.SyncErrorRow[]; total: number }>;
  resolveSyncErrors(timesheetId: string, when: string): Promise<void>;
}

export interface NotificationRepository {
  create(n: T.NotificationRow): Promise<void>;
  list(userId: string, page: T.Page, unreadOnly?: boolean): Promise<{ items: T.NotificationRow[]; total: number; unread: number }>;
  markRead(userId: string, ids: string[] | "all"): Promise<void>;
}

export interface AuditRepository {
  append(a: T.AuditRow): Promise<void>;
  forEntity(entityType: string, entityId: string): Promise<T.AuditRow[]>;
  list(filter: { entity_type?: string; actor_id?: string; action?: string; from?: string; to?: string }, page: T.Page): Promise<{ items: T.AuditRow[]; total: number }>;
  deleteOlderThan(iso: string): Promise<number>;
}

export interface ReportRepository {
  create(r: T.ReportJobRow): Promise<void>;
  findById(id: string): Promise<T.ReportJobRow | null>;
  update(id: string, patch: Partial<T.ReportJobRow>): Promise<void>;
  list(userId: string | null, page: T.Page): Promise<{ items: T.ReportJobRow[]; total: number }>;
  olderThan(iso: string): Promise<T.ReportJobRow[]>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, updatedBy: string | null): Promise<void>;
  all(): Promise<Record<string, unknown>>;
}

export interface RateLimitRepository {
  hit(key: string, windowSeconds: number, now: Date): Promise<number>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  clients: ClientRepository;
  projects: ProjectRepository;
  imports: ImportRepository;
  analyses: AnalysisRepository;
  timesheets: TimesheetRepository;
  jira: JiraRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  reports: ReportRepository;
  settings: SettingsRepository;
  rateLimits: RateLimitRepository;
  /** Global text search across entities (returns ids/titles only). */
  search(q: string, userId: string, isApprover: boolean): Promise<{ type: string; id: string; title: string; subtitle: string }[]>;
}
