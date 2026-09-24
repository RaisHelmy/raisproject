import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  kind: "general" | "movie";
  cover_asset_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const DEFAULT_PROJECT_NAME = "My first project";

/**
 * Everything belongs to a project (§69). Beginners never have to create one:
 * a default project is made with the account and used unless another is chosen.
 */
export class ProjectService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async create(ctx: AuthContext, input: { name: string; description?: string; kind?: "general" | "movie" }): Promise<ProjectRow> {
    const name = input.name.trim();
    if (!name) throw new AppError("invalid_input", "Give the project a name.");
    const id = newId();
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO projects (id, org_id, name, description, kind, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(id, ctx.orgId, name, input.description ?? null, input.kind ?? "general", ctx.userId, now, now)
      .run();
    const created = await this.findById(ctx, id);
    if (!created) throw new AppError("internal", "Project could not be read back.");
    return created;
  }

  async findById(ctx: AuthContext, id: string): Promise<ProjectRow | null> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM projects WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
      .bind(id, ctx.orgId)
      .first<ProjectRow>();
    return row ?? null;
  }

  async require(ctx: AuthContext, id: string): Promise<ProjectRow> {
    const project = await this.findById(ctx, id);
    if (!project) throw new AppError("not_found", "Project not found.", { action: "Pick one of your projects." });
    return project;
  }

  async list(ctx: AuthContext): Promise<ProjectRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM projects WHERE org_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`)
      .bind(ctx.orgId)
      .all<ProjectRow>();
    return results;
  }

  /** The project a request falls back to when the caller names none. */
  async getOrCreateDefault(ctx: AuthContext): Promise<ProjectRow> {
    const existing = await this.env.DB
      .prepare(`SELECT * FROM projects WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`)
      .bind(ctx.orgId)
      .first<ProjectRow>();
    if (existing) return existing;
    return this.create(ctx, { name: DEFAULT_PROJECT_NAME });
  }

  async update(ctx: AuthContext, id: string, patch: { name?: string; description?: string }): Promise<ProjectRow> {
    const project = await this.require(ctx, id);
    await this.env.DB
      .prepare(`UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
      .bind(patch.name?.trim() || project.name, patch.description ?? project.description, nowIso(), id, ctx.orgId)
      .run();
    return (await this.findById(ctx, id))!;
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    await this.require(ctx, id);
    await this.env.DB
      .prepare(`UPDATE projects SET deleted_at = ? WHERE id = ? AND org_id = ?`)
      .bind(nowIso(), id, ctx.orgId)
      .run();
  }
}
