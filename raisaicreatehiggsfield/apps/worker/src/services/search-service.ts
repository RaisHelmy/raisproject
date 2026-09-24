import type { AuthContext } from "@raisai/shared";
import type { Env } from "../env";

export type SearchKind = "project" | "generation" | "asset" | "template" | "workflow" | "movie" | "character" | "scene";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  /** Where the UI should send someone who picks this. */
  href: string;
  updatedAt: string | null;
}

/**
 * One search across everything a workspace has made (§103).
 *
 * Every query is scoped to the caller's organization in SQL rather than
 * filtered afterwards, so a result from another workspace cannot reach the
 * response even by mistake.
 */
export class SearchService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async search(auth: AuthContext, query: string, options: { limit?: number; kinds?: SearchKind[] } = {}): Promise<SearchHit[]> {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];

    const like = `%${term}%`;
    const perKind = Math.min(Math.max(options.limit ?? 5, 1), 20);
    const wanted = (kind: SearchKind) => !options.kinds || options.kinds.includes(kind);
    const hits: SearchHit[] = [];

    if (wanted("project")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, name, description, updated_at FROM projects
            WHERE org_id = ? AND deleted_at IS NULL AND (lower(name) LIKE ? OR lower(COALESCE(description,'')) LIKE ?)
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, like, perKind)
        .all<{ id: string; name: string; description: string | null; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "project" as const, id: r.id, title: r.name, subtitle: r.description,
        href: `/projects`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("generation")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, model_id, input_json, created_at FROM generations
            WHERE org_id = ? AND lower(input_json) LIKE ?
            ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, perKind)
        .all<{ id: string; model_id: string; input_json: string; created_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "generation" as const,
        id: r.id,
        title: (JSON.parse(r.input_json) as { prompt?: string }).prompt || "(no prompt)",
        subtitle: r.model_id.split("/").pop() ?? r.model_id,
        href: `/history`,
        updatedAt: r.created_at,
      })));
    }

    if (wanted("asset")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, name, kind, updated_at FROM assets
            WHERE org_id = ? AND deleted_at IS NULL AND lower(name) LIKE ?
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, perKind)
        .all<{ id: string; name: string; kind: string; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "asset" as const, id: r.id, title: r.name, subtitle: r.kind,
        href: `/assets`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("template")) {
      // Public templates are searchable too: finding someone else's is the
      // point of publishing one.
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, name, description, updated_at FROM templates
            WHERE (org_id = ? OR visibility = 'public') AND deleted_at IS NULL
              AND (lower(name) LIKE ? OR lower(COALESCE(description,'')) LIKE ? OR lower(tags_json) LIKE ?)
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, like, like, perKind)
        .all<{ id: string; name: string; description: string | null; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "template" as const, id: r.id, title: r.name, subtitle: r.description,
        href: `/templates`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("workflow")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, name, description, updated_at FROM workflows
            WHERE org_id = ? AND deleted_at IS NULL AND is_system = 0
              AND (lower(name) LIKE ? OR lower(COALESCE(description,'')) LIKE ?)
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, like, perKind)
        .all<{ id: string; name: string; description: string | null; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "workflow" as const, id: r.id, title: r.name, subtitle: r.description,
        href: `/workflows/${r.id}`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("movie")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, title, logline, updated_at FROM movies
            WHERE org_id = ? AND deleted_at IS NULL
              AND (lower(title) LIKE ? OR lower(COALESCE(logline,'')) LIKE ? OR lower(COALESCE(idea,'')) LIKE ?)
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, like, like, perKind)
        .all<{ id: string; title: string; logline: string | null; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "movie" as const, id: r.id, title: r.title, subtitle: r.logline,
        href: `/movies/${r.id}`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("character")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT id, name, description, updated_at FROM characters
            WHERE org_id = ? AND (lower(name) LIKE ? OR lower(COALESCE(description,'')) LIKE ?)
            ORDER BY updated_at DESC LIMIT ?`,
        )
        .bind(auth.orgId, like, like, perKind)
        .all<{ id: string; name: string; description: string | null; updated_at: string }>();
      hits.push(...results.map((r) => ({
        kind: "character" as const, id: r.id, title: r.name, subtitle: r.description,
        href: `/movies`, updatedAt: r.updated_at,
      })));
    }

    if (wanted("scene")) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT s.id, s.title, s.action, s.movie_id FROM scenes s
             JOIN movies m ON m.id = s.movie_id
            WHERE m.org_id = ? AND m.deleted_at IS NULL
              AND (lower(s.title) LIKE ? OR lower(COALESCE(s.action,'')) LIKE ?)
            ORDER BY s.number LIMIT ?`,
        )
        .bind(auth.orgId, like, like, perKind)
        .all<{ id: string; title: string; action: string | null; movie_id: string }>();
      hits.push(...results.map((r) => ({
        kind: "scene" as const, id: r.id, title: r.title, subtitle: r.action,
        href: `/movies/${r.movie_id}`, updatedAt: null,
      })));
    }

    // An exact title match is almost always what was meant, so it leads.
    return hits.sort((a, b) => {
      const aExact = a.title.toLowerCase() === term ? 0 : 1;
      const bExact = b.title.toLowerCase() === term ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
  }
}
