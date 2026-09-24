import type { PgDatabase } from "../../db/pg-adapter";
import type { ClientRepository, ProjectRepository } from "../interfaces";
import type { ClientRow, ProjectRow } from "../types";
import { all, insertStatement, one, run, updateStatement } from "./base";

export class D1ClientRepository implements ClientRepository {
  constructor(private readonly db: PgDatabase) {}
  list() { return all<ClientRow>(this.db, "SELECT * FROM clients ORDER BY name"); }
  findById(id: string) { return one<ClientRow>(this.db, "SELECT * FROM clients WHERE id = ?", id); }
  async create(c: ClientRow) { const s = insertStatement("clients", c as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async update(id: string, patch: Partial<ClientRow>) { const s = updateStatement("clients", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
}

type ProjectJoined = ProjectRow & { client_name: string };
const SELECT = "SELECT p.*, c.name AS client_name FROM projects p JOIN clients c ON c.id = p.client_id";

export class D1ProjectRepository implements ProjectRepository {
  constructor(private readonly db: PgDatabase) {}

  list(opts: { active_only?: boolean; user_id?: string } = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.active_only) where.push("p.is_active = 1");
    if (opts.user_id) { where.push("EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)"); params.push(opts.user_id); }
    return all<ProjectJoined>(this.db, `${SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY c.name, p.name`, ...params);
  }
  findById(id: string) { return one<ProjectJoined>(this.db, `${SELECT} WHERE p.id = ?`, id); }
  findByJiraKey(key: string) { return one<ProjectRow>(this.db, "SELECT * FROM projects WHERE jira_project_key = ?", key); }
  async create(p: ProjectRow) { const s = insertStatement("projects", p as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async update(id: string, patch: Partial<ProjectRow>) { const s = updateStatement("projects", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  async isMember(projectId: string, userId: string) {
    const r = await one<{ c: number }>(this.db, "SELECT count(*) AS c FROM project_members WHERE project_id = ? AND user_id = ?", projectId, userId);
    return (r?.c ?? 0) > 0;
  }
  async setMembers(projectId: string, userIds: string[]) {
    const stmts = [this.db.prepare("DELETE FROM project_members WHERE project_id = ?").bind(projectId)];
    for (const u of userIds) stmts.push(this.db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)").bind(projectId, u));
    await this.db.batch(stmts);
  }
  async members(projectId: string) {
    const rows = await all<{ user_id: string }>(this.db, "SELECT user_id FROM project_members WHERE project_id = ?", projectId);
    return rows.map((r) => r.user_id);
  }
}
