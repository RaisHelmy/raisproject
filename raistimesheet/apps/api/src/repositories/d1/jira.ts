import type { PgDatabase } from "../../db/pg-adapter";
import type { JiraRepository } from "../interfaces";
import type { JiraConnectionRow, JiraIssueRow, JiraLinkRow, MatchCandidateRow, Page, SyncErrorRow, SyncJobRow } from "../types";
import { all, batchAll, insertStatement, one, placeholders, run, updateStatement } from "./base";

export class D1JiraRepository implements JiraRepository {
  constructor(private readonly db: PgDatabase) {}

  // ---- connection ----
  activeConnection() { return one<JiraConnectionRow>(this.db, "SELECT * FROM jira_connections WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1"); }
  async saveConnection(c: JiraConnectionRow) { const s = insertStatement("jira_connections", c as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async updateConnection(id: string, patch: Partial<JiraConnectionRow>) { const s = updateStatement("jira_connections", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  async deactivateConnections() { await run(this.db, "UPDATE jira_connections SET is_active = 0"); }
  async saveOauthState(state: string, userId: string, createdAt: string) { await run(this.db, "INSERT INTO jira_oauth_states (state, user_id, created_at) VALUES (?, ?, ?)", state, userId, createdAt); }
  async consumeOauthState(state: string) {
    const r = await one<{ user_id: string; created_at: string }>(this.db, "SELECT user_id, created_at FROM jira_oauth_states WHERE state = ?", state);
    if (r) await run(this.db, "DELETE FROM jira_oauth_states WHERE state = ?", state);
    return r;
  }

  // ---- issues cache ----
  async upsertIssues(issues: JiraIssueRow[]) {
    const stmts = issues.map((i) =>
      this.db
        .prepare(
          `INSERT INTO jira_issues (id, issue_key, issue_id, project_key, summary, description, status, status_category, issue_type, assignee_account_id, assignee_name, priority, due_date, resolved_at, jira_created_at, jira_updated_at, url, is_demo, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(issue_key) DO UPDATE SET issue_id=excluded.issue_id, project_key=excluded.project_key, summary=excluded.summary, description=excluded.description, status=excluded.status,
             status_category=excluded.status_category, issue_type=excluded.issue_type, assignee_account_id=excluded.assignee_account_id, assignee_name=excluded.assignee_name, priority=excluded.priority,
             due_date=excluded.due_date, resolved_at=excluded.resolved_at, jira_created_at=excluded.jira_created_at, jira_updated_at=excluded.jira_updated_at, url=excluded.url, is_demo=excluded.is_demo, synced_at=excluded.synced_at`,
        )
        .bind(i.id, i.issue_key, i.issue_id, i.project_key, i.summary, i.description, i.status, i.status_category, i.issue_type, i.assignee_account_id, i.assignee_name, i.priority, i.due_date, i.resolved_at, i.jira_created_at, i.jira_updated_at, i.url, i.is_demo, i.synced_at),
    );
    await batchAll(this.db, stmts);
  }
  findIssue(key: string) { return one<JiraIssueRow>(this.db, "SELECT * FROM jira_issues WHERE issue_key = ?", key); }

  async listIssues(filter: { project_keys?: string[]; assignee_account_id?: string; search?: string; status_category?: string; is_demo?: boolean }, page: Page) {
    const w: string[] = [];
    const p: unknown[] = [];
    if (filter.project_keys?.length) { w.push(`project_key IN (${placeholders(filter.project_keys.length)})`); p.push(...filter.project_keys); }
    if (filter.assignee_account_id) { w.push("assignee_account_id = ?"); p.push(filter.assignee_account_id); }
    if (filter.status_category) { w.push("status_category = ?"); p.push(filter.status_category); }
    if (filter.is_demo !== undefined) { w.push("is_demo = ?"); p.push(filter.is_demo ? 1 : 0); }
    if (filter.search) { w.push("(issue_key ILIKE ? OR summary ILIKE ?)"); p.push(`%${filter.search}%`, `%${filter.search}%`); }
    const where = w.length ? " WHERE " + w.join(" AND ") : "";
    const [items, total] = await Promise.all([
      all<JiraIssueRow>(this.db, `SELECT * FROM jira_issues${where} ORDER BY jira_updated_at DESC, issue_key DESC LIMIT ? OFFSET ?`, ...p, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM jira_issues${where}`, ...p),
    ]);
    return { items, total: total?.c ?? 0 };
  }
  allIssues(projectKeys?: string[]) {
    if (projectKeys?.length) return all<JiraIssueRow>(this.db, `SELECT * FROM jira_issues WHERE project_key IN (${placeholders(projectKeys.length)}) ORDER BY issue_key`, ...projectKeys);
    return all<JiraIssueRow>(this.db, "SELECT * FROM jira_issues ORDER BY issue_key");
  }
  async deleteDemoIssues() { await run(this.db, "DELETE FROM jira_issues WHERE is_demo = 1"); }

  // ---- links ----
  async upsertLink(l: JiraLinkRow) {
    await run(
      this.db,
      `INSERT INTO timesheet_jira_links (id, timesheet_id, jira_issue_key, match_type, match_confidence, linked_at, linked_by, sync_status, last_sync_at, sync_error, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(timesheet_id) DO UPDATE SET jira_issue_key=excluded.jira_issue_key, match_type=excluded.match_type, match_confidence=excluded.match_confidence, linked_at=excluded.linked_at,
         linked_by=excluded.linked_by, sync_status=excluded.sync_status, last_sync_at=excluded.last_sync_at, sync_error=excluded.sync_error, updated_at=excluded.updated_at`,
      l.id, l.timesheet_id, l.jira_issue_key, l.match_type, l.match_confidence, l.linked_at, l.linked_by, l.sync_status, l.last_sync_at, l.sync_error, l.idempotency_key, l.created_at, l.updated_at,
    );
  }
  linkForTimesheet(timesheetId: string) {
    return one<JiraLinkRow>(this.db, "SELECT l.*, u.name AS linked_by_name FROM timesheet_jira_links l LEFT JOIN users u ON u.id = l.linked_by WHERE l.timesheet_id = ?", timesheetId);
  }
  async linksForTimesheets(ids: string[]) {
    const m = new Map<string, JiraLinkRow>();
    if (!ids.length) return m;
    const rows = await all<JiraLinkRow>(this.db, `SELECT l.*, u.name AS linked_by_name FROM timesheet_jira_links l LEFT JOIN users u ON u.id = l.linked_by WHERE l.timesheet_id IN (${placeholders(ids.length)})`, ...ids);
    for (const r of rows) m.set(r.timesheet_id, r);
    return m;
  }
  linksForIssue(key: string) { return all<JiraLinkRow>(this.db, "SELECT * FROM timesheet_jira_links WHERE jira_issue_key = ?", key); }
  async updateLink(id: string, patch: Partial<JiraLinkRow>) { const s = updateStatement("timesheet_jira_links", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  async deleteLink(timesheetId: string) { await run(this.db, "DELETE FROM timesheet_jira_links WHERE timesheet_id = ?", timesheetId); }

  // ---- candidates ----
  async replaceCandidates(timesheetId: string, c: MatchCandidateRow[]) {
    const stmts = [this.db.prepare("DELETE FROM jira_match_candidates WHERE timesheet_id = ?").bind(timesheetId)];
    for (const x of c) { const s = insertStatement("jira_match_candidates", x as unknown as Record<string, unknown>); stmts.push(this.db.prepare(s.sql).bind(...s.params)); }
    await this.db.batch(stmts);
  }
  candidates(timesheetId: string) { return all<MatchCandidateRow>(this.db, "SELECT * FROM jira_match_candidates WHERE timesheet_id = ? ORDER BY confidence DESC", timesheetId); }
  async candidatesForTimesheets(ids: string[]) {
    const m = new Map<string, MatchCandidateRow[]>();
    if (!ids.length) return m;
    const rows = await all<MatchCandidateRow>(this.db, `SELECT * FROM jira_match_candidates WHERE timesheet_id IN (${placeholders(ids.length)}) ORDER BY confidence DESC`, ...ids);
    for (const r of rows) m.set(r.timesheet_id, [...(m.get(r.timesheet_id) ?? []), r]);
    return m;
  }
  async updateCandidates(timesheetId: string, status: string) { await run(this.db, "UPDATE jira_match_candidates SET status = ? WHERE timesheet_id = ?", status, timesheetId); }

  // ---- sync jobs ----
  async createSyncJob(j: SyncJobRow) { const s = insertStatement("sync_jobs", j as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  findSyncJob(id: string) { return one<SyncJobRow>(this.db, "SELECT * FROM sync_jobs WHERE id = ?", id); }
  findSyncJobByKey(key: string) { return one<SyncJobRow>(this.db, "SELECT * FROM sync_jobs WHERE idempotency_key = ?", key); }
  async updateSyncJob(id: string, patch: Partial<SyncJobRow>) { const s = updateStatement("sync_jobs", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  dueSyncJobs(now: string, limit: number) {
    return all<SyncJobRow>(this.db, "SELECT * FROM sync_jobs WHERE status IN ('PENDING','FAILED') AND attempts < max_attempts AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY created_at LIMIT ?", now, limit);
  }

  // ---- sync errors ----
  async createSyncError(e: SyncErrorRow) { const s = insertStatement("sync_errors", e as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async openSyncErrors(page: Page, timesheetId?: string) {
    const where = timesheetId ? " AND e.timesheet_id = ?" : "";
    const params = timesheetId ? [timesheetId] : [];
    const [items, total] = await Promise.all([
      all<SyncErrorRow>(this.db, `SELECT e.*, t.reference AS timesheet_reference FROM sync_errors e LEFT JOIN timesheets t ON t.id = e.timesheet_id WHERE e.resolved_at IS NULL${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`, ...params, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM sync_errors e WHERE e.resolved_at IS NULL${where}`, ...params),
    ]);
    return { items, total: total?.c ?? 0 };
  }
  async resolveSyncErrors(timesheetId: string, when: string) { await run(this.db, "UPDATE sync_errors SET resolved_at = ? WHERE timesheet_id = ? AND resolved_at IS NULL", when, timesheetId); }
}
