import type { Capability, ModelCategory, ModelDefinition, ModelStatus, ModelTag } from "@raisai/shared";
import type { Env } from "../env";
import { BaseRepository } from "./base";
import { nowIso } from "../db/client";

export interface ModelRow {
  id: string;
  provider: string;
  hosting: "workers-ai" | "third-party";
  display_name: string;
  description: string;
  category: ModelCategory;
  task: string;
  capabilities_json: string;
  input_schema_json: string;
  output_schema_json: string;
  parameter_schema_json: string;
  limits_json: string;
  status: ModelStatus;
  tags_json: string;
  doc_url: string | null;
  sort_order: number;
  version: string;
  discovered_at: string;
  updated_at: string;
}

export interface ModelQuery {
  /** Customers only ever see `enabled` models (§125). */
  statuses?: ModelStatus[];
  task?: string;
  category?: ModelCategory;
  capabilities?: Capability[];
  tag?: ModelTag;
  search?: string;
}

export function rowToDefinition(row: ModelRow): ModelDefinition {
  return {
    id: row.id,
    provider: "cloudflare",
    hosting: row.hosting,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    task: row.task,
    capabilities: JSON.parse(row.capabilities_json) as ModelDefinition["capabilities"],
    inputs: JSON.parse(row.input_schema_json) as ModelDefinition["inputs"],
    outputs: JSON.parse(row.output_schema_json) as ModelDefinition["outputs"],
    parameters: JSON.parse(row.parameter_schema_json) as ModelDefinition["parameters"],
    limits: JSON.parse(row.limits_json) as ModelDefinition["limits"],
    status: row.status,
    tags: JSON.parse(row.tags_json) as ModelDefinition["tags"],
    docUrl: row.doc_url ?? undefined,
    version: row.version,
    sortOrder: row.sort_order,
  };
}

export class ModelRepository extends BaseRepository {
  constructor(env: Pick<Env, "DB">) {
    super(env);
  }

  async upsert(model: ModelDefinition): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO models (id, provider, hosting, display_name, description, category, task,
            capabilities_json, input_schema_json, output_schema_json, parameter_schema_json, limits_json,
            status, tags_json, doc_url, sort_order, version, updated_at)
         VALUES (?, 'cloudflare', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            hosting = excluded.hosting, display_name = excluded.display_name,
            description = excluded.description, category = excluded.category, task = excluded.task,
            capabilities_json = excluded.capabilities_json, input_schema_json = excluded.input_schema_json,
            output_schema_json = excluded.output_schema_json, parameter_schema_json = excluded.parameter_schema_json,
            limits_json = excluded.limits_json, status = excluded.status, tags_json = excluded.tags_json,
            doc_url = excluded.doc_url, sort_order = excluded.sort_order, version = excluded.version,
            updated_at = excluded.updated_at`,
      )
      .bind(
        model.id, model.hosting, model.displayName, model.description, model.category, model.task,
        JSON.stringify(model.capabilities), JSON.stringify(model.inputs), JSON.stringify(model.outputs),
        JSON.stringify(model.parameters), JSON.stringify(model.limits), model.status,
        JSON.stringify(model.tags), model.docUrl ?? null, model.sortOrder, model.version, nowIso(),
      )
      .run();
  }

  async findById(id: string): Promise<ModelDefinition | null> {
    const row = await this.db.prepare(`SELECT * FROM models WHERE id = ?`).bind(id).first<ModelRow>();
    return row ? rowToDefinition(row) : null;
  }

  async list(query: ModelQuery = {}): Promise<ModelDefinition[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (query.statuses?.length) {
      where.push(`status IN (${query.statuses.map(() => "?").join(",")})`);
      params.push(...query.statuses);
    }
    if (query.task) {
      where.push("task = ?");
      params.push(query.task);
    }
    if (query.category) {
      where.push("category = ?");
      params.push(query.category);
    }
    if (query.search) {
      where.push("(lower(display_name) LIKE ? OR lower(description) LIKE ? OR lower(id) LIKE ?)");
      const like = `%${query.search.toLowerCase()}%`;
      params.push(like, like, like);
    }
    // Capabilities and tags are JSON arrays; D1 has no array ops, so filter in TS
    // after the indexed columns have already narrowed the set.
    const sql = `SELECT * FROM models ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY sort_order ASC, display_name ASC`;
    const { results } = await this.db.prepare(sql).bind(...params).all<ModelRow>();

    let models = results.map(rowToDefinition);
    if (query.capabilities?.length) {
      models = models.filter((m) => query.capabilities!.every((c) => m.capabilities.includes(c)));
    }
    if (query.tag) {
      models = models.filter((m) => m.tags.includes(query.tag!));
    }
    return models;
  }

  async setStatus(id: string, status: ModelStatus): Promise<void> {
    await this.db.prepare(`UPDATE models SET status = ?, updated_at = ? WHERE id = ?`).bind(status, nowIso(), id).run();
  }
}
