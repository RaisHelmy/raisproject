import type { Repositories } from "./interfaces";
import type { PgDatabase } from "../db/pg-adapter";
import { D1SessionRepository, D1UserRepository } from "./d1/identity";
import { D1ClientRepository, D1ProjectRepository } from "./d1/org";
import { D1AnalysisRepository, D1ImportRepository } from "./d1/imports";
import { D1TimesheetRepository } from "./d1/timesheets";
import { D1JiraRepository } from "./d1/jira";
import { D1AuditRepository, D1NotificationRepository, D1RateLimitRepository, D1ReportRepository, D1SettingsRepository } from "./d1/misc";
import { all } from "./d1/base";

export type { Repositories } from "./interfaces";

/**
 * Factory — the only place that knows the concrete storage. Classes keep their
 * historical `D1*` names (the repository shape and SQL are unchanged; only the
 * driver underneath — Postgres via `PgDatabase` — is new) to keep this diff
 * reviewable; a follow-up rename is a cheap, purely-cosmetic cleanup.
 */
export function createRepositories(db: PgDatabase): Repositories {
  return {
    users: new D1UserRepository(db),
    sessions: new D1SessionRepository(db),
    clients: new D1ClientRepository(db),
    projects: new D1ProjectRepository(db),
    imports: new D1ImportRepository(db),
    analyses: new D1AnalysisRepository(db),
    timesheets: new D1TimesheetRepository(db),
    jira: new D1JiraRepository(db),
    notifications: new D1NotificationRepository(db),
    audit: new D1AuditRepository(db),
    reports: new D1ReportRepository(db),
    settings: new D1SettingsRepository(db),
    rateLimits: new D1RateLimitRepository(db),
    async search(q, userId, isApprover) {
      const like = `%${q}%`;
      const scope = isApprover ? "" : " AND t.user_id = ?";
      const scopeParams = isApprover ? [] : [userId];
      const [ts, issues, imports, projects] = await Promise.all([
        all<{ id: string; reference: string; title: string; work_date: string; code: string }>(db, `SELECT t.id, t.reference, t.title, t.work_date, p.code FROM timesheets t JOIN projects p ON p.id = t.project_id WHERE (t.title ILIKE ? OR t.description ILIKE ? OR t.reference ILIKE ? OR t.work_date ILIKE ?)${scope} ORDER BY t.work_date DESC LIMIT 8`, like, like, like, like, ...scopeParams),
        all<{ issue_key: string; summary: string; status: string }>(db, "SELECT issue_key, summary, status FROM jira_issues WHERE issue_key ILIKE ? OR summary ILIKE ? LIMIT 6", like, like),
        all<{ id: string; filename: string; created_at: string }>(db, `SELECT id, filename, created_at FROM imports WHERE filename ILIKE ?${isApprover ? "" : " AND user_id = ?"} LIMIT 5`, like, ...scopeParams),
        all<{ id: string; name: string; code: string }>(db, "SELECT id, name, code FROM projects WHERE name ILIKE ? OR code ILIKE ? LIMIT 4", like, like),
      ]);
      return [
        ...ts.map((t) => ({ type: "timesheet", id: t.id, title: `${t.reference} · ${t.title}`, subtitle: `${t.code} · ${t.work_date}` })),
        ...issues.map((i) => ({ type: "jira", id: i.issue_key, title: `${i.issue_key} · ${i.summary}`, subtitle: i.status })),
        ...imports.map((i) => ({ type: "import", id: i.id, title: `WhatsApp Import — ${i.filename}`, subtitle: i.created_at.slice(0, 10) })),
        ...projects.map((p) => ({ type: "project", id: p.id, title: p.name, subtitle: p.code })),
      ];
    },
  };
}
