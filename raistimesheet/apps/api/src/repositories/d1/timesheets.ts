import type { PgDatabase } from "../../db/pg-adapter";
import type { TimesheetRepository } from "../interfaces";
import type { ApprovalRow, Page, Sort, TimesheetFilter, TimesheetJoined, TimesheetRow } from "../types";
import { all, insertStatement, one, placeholders, run, updateStatement } from "./base";

const SELECT = `SELECT t.*, u.name AS user_name, p.code AS project_code, p.name AS project_name, p.client_id AS client_id,
  a.name AS approved_by_name, l.jira_issue_key AS jira_issue_key
  FROM timesheets t
  JOIN users u ON u.id = t.user_id
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a ON a.id = t.approved_by
  LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id`;

const SORTABLE: Record<string, string> = {
  work_date: "t.work_date", created_at: "t.created_at", duration_minutes: "t.duration_minutes", title: "t.title", status: "t.status", updated_at: "t.updated_at", reference: "t.reference",
};

function buildWhere(f: TimesheetFilter): { where: string; params: unknown[] } {
  const w: string[] = [];
  const p: unknown[] = [];
  if (f.user_id) { w.push("t.user_id = ?"); p.push(f.user_id); }
  if (f.project_id) { w.push("t.project_id = ?"); p.push(f.project_id); }
  if (f.client_id) { w.push("p.client_id = ?"); p.push(f.client_id); }
  if (f.status) { const s = Array.isArray(f.status) ? f.status : [f.status]; w.push(`t.status IN (${placeholders(s.length)})`); p.push(...s); }
  if (f.jira_sync_status) { const s = Array.isArray(f.jira_sync_status) ? f.jira_sync_status : [f.jira_sync_status]; w.push(`t.jira_sync_status IN (${placeholders(s.length)})`); p.push(...s); }
  if (f.work_status) { w.push("t.work_status = ?"); p.push(f.work_status); }
  if (f.date_from) { w.push("t.work_date >= ?"); p.push(f.date_from); }
  if (f.date_to) { w.push("t.work_date <= ?"); p.push(f.date_to); }
  if (f.ids && f.ids.length) { w.push(`t.id IN (${placeholders(f.ids.length)})`); p.push(...f.ids); }
  if (f.search) { w.push("(t.title ILIKE ? OR t.description ILIKE ? OR t.reference ILIKE ? OR l.jira_issue_key ILIKE ?)"); const like = `%${f.search}%`; p.push(like, like, like, like); }
  return { where: w.length ? " WHERE " + w.join(" AND ") : "", params: p };
}

export class D1TimesheetRepository implements TimesheetRepository {
  constructor(private readonly db: PgDatabase) {}

  async nextReference(year: number): Promise<string> {
    // Upsert the sequence row, then increment atomically and read it back.
    await run(this.db, "INSERT INTO timesheet_sequences (year, next_value) VALUES (?, 1) ON CONFLICT(year) DO NOTHING", year);
    const row = await one<{ next_value: number }>(this.db, "UPDATE timesheet_sequences SET next_value = next_value + 1 WHERE year = ? RETURNING next_value", year);
    const n = (row?.next_value ?? 2) - 1;
    return `TS-${year}-${String(n).padStart(5, "0")}`;
  }

  async create(t: TimesheetRow) { const s = insertStatement("timesheets", t as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  findById(id: string) { return one<TimesheetJoined>(this.db, `${SELECT} WHERE t.id = ?`, id); }
  findByReference(ref: string) { return one<TimesheetJoined>(this.db, `${SELECT} WHERE t.reference = ?`, ref); }

  async list(filter: TimesheetFilter, page: Page, sort?: Sort) {
    const { where, params } = buildWhere(filter);
    const col = SORTABLE[sort?.column ?? "work_date"] ?? "t.work_date";
    const dir = sort?.direction === "asc" ? "ASC" : "DESC";
    const [items, total] = await Promise.all([
      all<TimesheetJoined>(this.db, `${SELECT}${where} ORDER BY ${col} ${dir}, t.created_at DESC LIMIT ? OFFSET ?`, ...params, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id${where}`, ...params),
    ]);
    return { items, total: total?.c ?? 0 };
  }

  async update(id: string, patch: Partial<TimesheetRow>) { const s = updateStatement("timesheets", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }

  async addApproval(a: ApprovalRow) { const s = insertStatement("timesheet_approvals", a as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  approvals(timesheetId: string) {
    return all<ApprovalRow>(this.db, "SELECT ap.*, u.name AS actor_name FROM timesheet_approvals ap JOIN users u ON u.id = ap.actor_id WHERE ap.timesheet_id = ? ORDER BY ap.created_at", timesheetId);
  }

  async summary(filter: TimesheetFilter) {
    const { where, params } = buildWhere(filter);
    const r = await one<{ count: number; minutes: number; projects: number; completed: number; approved: number; jira_pending: number }>(
      this.db,
      `SELECT count(*) AS count, coalesce(sum(t.duration_minutes),0) AS minutes, count(DISTINCT t.project_id) AS projects,
        sum(CASE WHEN t.work_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        sum(CASE WHEN t.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
        sum(CASE WHEN t.status = 'APPROVED' AND t.jira_sync_status NOT IN ('SYNCED','LINKED') THEN 1 ELSE 0 END) AS jira_pending
       FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id${where}`,
      ...params,
    );
    return { count: r?.count ?? 0, minutes: r?.minutes ?? 0, projects: r?.projects ?? 0, completed: r?.completed ?? 0, approved: r?.approved ?? 0, jira_pending: r?.jira_pending ?? 0 };
  }

  minutesByDay(filter: TimesheetFilter) {
    const { where, params } = buildWhere(filter);
    return all<{ date: string; minutes: number }>(this.db, `SELECT t.work_date AS date, sum(t.duration_minutes) AS minutes FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id${where} GROUP BY t.work_date ORDER BY t.work_date`, ...params);
  }

  minutesByProject(filter: TimesheetFilter) {
    const { where, params } = buildWhere(filter);
    return all<{ project: string; minutes: number }>(this.db, `SELECT p.code AS project, sum(t.duration_minutes) AS minutes FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id${where} GROUP BY p.code ORDER BY minutes DESC`, ...params);
  }

  countBy(filter: TimesheetFilter, column: "status" | "work_status" | "jira_sync_status") {
    const { where, params } = buildWhere(filter);
    return all<{ key: string; count: number }>(this.db, `SELECT t.${column} AS key, count(*) AS count FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id${where} GROUP BY t.${column}`, ...params);
  }
}
