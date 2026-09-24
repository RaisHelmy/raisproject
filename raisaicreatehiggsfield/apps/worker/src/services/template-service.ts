import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { workflowDocumentSchema, type VariableDef, type WorkflowDocument } from "../engine/document";
import { WorkflowExecutionService, type RunSummary } from "./workflow-execution-service";
import type { AIProvider } from "../providers/types";

export interface TemplateRow {
  id: string;
  org_id: string;
  author_user_id: string;
  workflow_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags_json: string;
  preview_asset_id: string | null;
  visibility: "private" | "unlisted" | "public";
  current_version: number;
  usage_count: number;
  estimated_cost_sen: number | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version: number;
  workflow_version_id: string;
  variables_json: string;
  model_preferences_json: string;
  changelog: string | null;
  published_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  doc: WorkflowDocument;
  projectId: string;
  visibility?: "private" | "unlisted" | "public";
}

/**
 * Templates are published, versioned workflows (§49, §54). Executing one always
 * binds to a specific template version, so publishing an update never changes
 * what an earlier run meant.
 */
export class TemplateService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "RAIS_WORKFLOW_RUN">>) {}

  async create(auth: AuthContext, input: CreateTemplateInput): Promise<{ template: TemplateRow; version: TemplateVersionRow }> {
    const doc = workflowDocumentSchema.parse(input.doc);
    const name = input.name.trim();
    if (!name) throw new AppError("invalid_input", "Give the template a name.");

    const execution = new WorkflowExecutionService(this.env);
    // Structure only: a template's required inputs are filled in when it runs.
    const preview = await execution.preview(auth, doc, defaultsFor(doc.variables), input.projectId, {
      checkVariables: false,
    });
    if (!preview.valid) {
      throw new AppError("workflow_invalid", "This workflow cannot be saved as a template yet.", {
        action: preview.errors[0]?.action ?? "Fix the highlighted problems first.",
        details: { errors: preview.errors },
      });
    }

    const templateId = newId();
    const workflowId = newId();
    const workflowVersionId = newId();
    const now = nowIso();
    const slug = await this.uniqueSlug(name);

    await this.env.DB
      .prepare(
        `INSERT INTO workflows (id, org_id, project_id, name, description, current_version, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,1,?,?,?)`,
      )
      .bind(workflowId, auth.orgId, input.projectId, name, input.description ?? null, auth.userId, now, now)
      .run();
    await this.env.DB
      .prepare(
        `INSERT INTO workflow_versions (id, workflow_id, version, document_json, document_hash, created_by, created_at)
         VALUES (?,?,1,?,?,?,?)`,
      )
      .bind(workflowVersionId, workflowId, JSON.stringify(doc), await execution.hashOf(doc), auth.userId, now)
      .run();

    await this.env.DB
      .prepare(
        `INSERT INTO templates (id, org_id, author_user_id, workflow_id, name, slug, description, category,
            tags_json, visibility, current_version, usage_count, estimated_cost_sen, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,0,?,?,?)`,
      )
      .bind(
        templateId, auth.orgId, auth.userId, workflowId, name, slug, input.description ?? null,
        input.category ?? null, JSON.stringify(input.tags ?? []), input.visibility ?? "private",
        preview.estimatedSen, now, now,
      )
      .run();

    const version = await this.insertVersion(templateId, 1, workflowVersionId, doc.variables, auth, "Initial version");
    return { template: (await this.requireTemplate(auth, templateId)).template, version };
  }

  /** A new version leaves earlier ones untouched, including runs bound to them. */
  async publishVersion(auth: AuthContext, templateId: string, doc: WorkflowDocument, changelog?: string): Promise<TemplateVersionRow> {
    const { template } = await this.requireTemplate(auth, templateId);
    if (template.author_user_id !== auth.userId && !auth.isAdmin) {
      throw new AppError("forbidden", "Only the author can publish a new version.");
    }
    const parsed = workflowDocumentSchema.parse(doc);
    const execution = new WorkflowExecutionService(this.env);
    const now = nowIso();
    const nextVersion = template.current_version + 1;
    const workflowVersionId = newId();

    await this.env.DB
      .prepare(
        `INSERT INTO workflow_versions (id, workflow_id, version, document_json, document_hash, created_by, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(workflowVersionId, template.workflow_id, nextVersion, JSON.stringify(parsed), await execution.hashOf(parsed), auth.userId, now)
      .run();
    await this.env.DB
      .prepare(`UPDATE workflows SET current_version = ?, updated_at = ? WHERE id = ?`)
      .bind(nextVersion, now, template.workflow_id)
      .run();
    await this.env.DB
      .prepare(`UPDATE templates SET current_version = ?, updated_at = ? WHERE id = ?`)
      .bind(nextVersion, now, templateId)
      .run();

    return this.insertVersion(templateId, nextVersion, workflowVersionId, parsed.variables, auth, changelog);
  }

  async execute(
    auth: AuthContext,
    templateId: string,
    variables: Record<string, unknown>,
    options: { projectId: string; versionId?: string; provider?: AIProvider },
  ): Promise<RunSummary> {
    const { template } = await this.requireTemplate(auth, templateId);
    const version = options.versionId
      ? await this.versionById(templateId, options.versionId)
      : await this.currentVersion(templateId);

    const workflowVersion = await this.env.DB
      .prepare(`SELECT document_json FROM workflow_versions WHERE id = ?`)
      .bind(version.workflow_version_id)
      .first<{ document_json: string }>();
    if (!workflowVersion) throw new AppError("not_found", "The template's workflow version is missing.");

    const doc = workflowDocumentSchema.parse(JSON.parse(workflowVersion.document_json));
    const declared = JSON.parse(version.variables_json) as VariableDef[];
    const resolved = { ...defaultsFor(declared), ...variables };

    const missing = declared.filter((v) => v.required && resolved[v.name] === undefined);
    if (missing.length > 0) {
      throw new AppError("invalid_input", `Missing ${missing.map((v) => v.label ?? v.name).join(", ")}.`, {
        action: "Fill in every required input.",
        details: { missing: missing.map((v) => v.name) },
      });
    }

    const run = await new WorkflowExecutionService(this.env).start(auth, {
      doc,
      workflowId: template.workflow_id,
      workflowVersionId: version.workflow_version_id,
      templateVersionId: version.id,
      projectId: options.projectId,
      variables: resolved,
      trigger: "template",
      provider: options.provider,
    });

    await this.env.DB
      .prepare(`UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?`)
      .bind(templateId)
      .run();
    return run;
  }

  async list(
    auth: AuthContext,
    options: { includePublic?: boolean; category?: string; search?: string; sort?: "recent" | "popular" } = {},
  ): Promise<TemplateRow[]> {
    const where = options.includePublic
      ? ["(org_id = ? OR visibility = 'public')", "deleted_at IS NULL"]
      : ["org_id = ?", "deleted_at IS NULL"];
    const params: unknown[] = [auth.orgId];

    if (options.category) {
      where.push("category = ?");
      params.push(options.category);
    }
    if (options.search?.trim()) {
      where.push("(lower(name) LIKE ? OR lower(COALESCE(description,'')) LIKE ? OR lower(tags_json) LIKE ?)");
      const like = `%${options.search.trim().toLowerCase()}%`;
      params.push(like, like, like);
    }

    const order = options.sort === "popular" ? "usage_count DESC, updated_at DESC" : "updated_at DESC";
    // The author's display name rides along so a public card can say who
    // made it without a second round trip per template.
    const { results } = await this.env.DB
      .prepare(
        `SELECT t.*, u.name AS author_name FROM templates t
           LEFT JOIN users u ON u.id = t.author_user_id
          WHERE ${where.map((w) => w.replace(/\b(org_id|visibility|deleted_at|category|name|description|tags_json)\b/g, "t.$1")).join(" AND ")}
          ORDER BY ${order.replace(/\b(usage_count|updated_at)\b/g, "t.$1")}`,
      )
      .bind(...params)
      .all<TemplateRow & { author_name: string | null }>();
    return results;
  }

  /** Preview image version of a public template, for unauthenticated gallery cards. */
  async publicPreviewVersion(templateId: string): Promise<{ r2_key: string; mime: string; size_bytes: number } | null> {
    return this.env.DB
      .prepare(
        `SELECT v.r2_key, v.mime, v.size_bytes FROM templates t
           JOIN assets a ON a.id = t.preview_asset_id
           JOIN asset_versions v ON v.asset_id = a.id AND v.version = a.current_version
          WHERE t.id = ? AND t.visibility = 'public' AND t.deleted_at IS NULL AND a.deleted_at IS NULL`,
      )
      .bind(templateId)
      .first<{ r2_key: string; mime: string; size_bytes: number }>();
  }

  /** Sets the preview image; the asset must belong to the template's org. */
  async setPreview(auth: AuthContext, templateId: string, assetId: string | null): Promise<TemplateRow> {
    const { template } = await this.requireTemplate(auth, templateId);
    if (template.author_user_id !== auth.userId && !auth.isAdmin) {
      throw new AppError("forbidden", "Only the author can change the preview.");
    }
    if (assetId) {
      const owned = await this.env.DB
        .prepare(`SELECT id FROM assets WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
        .bind(assetId, template.org_id)
        .first<{ id: string }>();
      if (!owned) throw new AppError("not_found", "That asset is not in this workspace.");
    }
    await this.env.DB
      .prepare(`UPDATE templates SET preview_asset_id = ?, updated_at = ? WHERE id = ?`)
      .bind(assetId, nowIso(), templateId)
      .run();
    return (await this.requireTemplate(auth, templateId)).template;
  }

  /** The categories that actually have templates, so the filter never lies. */
  async categories(auth: AuthContext): Promise<{ category: string; count: number }[]> {
    const { results } = await this.env.DB
      .prepare(
        `SELECT category, COUNT(*) AS count FROM templates
          WHERE (org_id = ? OR visibility = 'public') AND deleted_at IS NULL AND category IS NOT NULL
          GROUP BY category ORDER BY count DESC`,
      )
      .bind(auth.orgId)
      .all<{ category: string; count: number }>();
    return results;
  }

  async setVisibility(auth: AuthContext, templateId: string, visibility: "private" | "unlisted" | "public"): Promise<TemplateRow> {
    const { template } = await this.requireTemplate(auth, templateId);
    if (template.org_id !== auth.orgId) throw new AppError("forbidden", "Only the author can change this.");
    // Publishing without a version would put a broken card in front of people.
    if (visibility === "public" && template.current_version < 1) {
      throw new AppError("invalid_input", "Publish a version before making the template public.");
    }
    await this.env.DB
      .prepare(`UPDATE templates SET visibility = ?, updated_at = ? WHERE id = ? AND org_id = ?`)
      .bind(visibility, nowIso(), templateId, auth.orgId)
      .run();
    return (await this.requireTemplate(auth, templateId)).template;
  }

  /** Copies a template into the caller's workspace so they can change it (§53). */
  async duplicate(auth: AuthContext, templateId: string, projectId: string): Promise<TemplateRow> {
    const { template } = await this.requireTemplate(auth, templateId);
    const version = await this.currentVersion(templateId);
    const workflowVersion = await this.env.DB
      .prepare(`SELECT document_json FROM workflow_versions WHERE id = ?`)
      .bind(version.workflow_version_id)
      .first<{ document_json: string }>();
    if (!workflowVersion) throw new AppError("not_found", "The template's workflow is missing.");

    const created = await this.create(auth, {
      name: `${template.name} (copy)`,
      description: template.description ?? undefined,
      category: template.category ?? undefined,
      tags: JSON.parse(template.tags_json) as string[],
      projectId,
      doc: workflowDocumentSchema.parse(JSON.parse(workflowVersion.document_json)),
    });
    return created.template;
  }

  async requireTemplate(
    auth: AuthContext,
    templateId: string,
  ): Promise<{ template: TemplateRow; variables: VariableDef[]; steps: TemplateStep[] }> {
    const template = await this.env.DB
      .prepare(`SELECT * FROM templates WHERE id = ? AND deleted_at IS NULL`)
      .bind(templateId)
      .first<TemplateRow>();
    if (!template) throw new AppError("not_found", "Template not found.");
    // A public template is readable by anyone; a private one only by its workspace.
    if (template.org_id !== auth.orgId && template.visibility === "private") {
      throw new AppError("not_found", "Template not found.");
    }
    const version = await this.currentVersion(templateId);
    return {
      template,
      variables: JSON.parse(version.variables_json) as VariableDef[],
      steps: summarize(await this.documentOf(version)),
    };
  }

  /** The workflow document a template version points at. */
  private async documentOf(version: TemplateVersionRow): Promise<string> {
    const row = await this.env.DB
      .prepare(`SELECT document_json FROM workflow_versions WHERE id = ?`)
      .bind(version.workflow_version_id)
      .first<{ document_json: string }>();
    return row?.document_json ?? "{}";
  }

  private async currentVersion(templateId: string): Promise<TemplateVersionRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM template_versions WHERE template_id = ? ORDER BY version DESC LIMIT 1`)
      .bind(templateId)
      .first<TemplateVersionRow>();
    if (!row) throw new AppError("not_found", "This template has no published version.");
    return row;
  }

  private async versionById(templateId: string, versionId: string): Promise<TemplateVersionRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM template_versions WHERE id = ? AND template_id = ?`)
      .bind(versionId, templateId)
      .first<TemplateVersionRow>();
    if (!row) throw new AppError("not_found", "That template version does not exist.");
    return row;
  }

  private async insertVersion(
    templateId: string,
    version: number,
    workflowVersionId: string,
    variables: VariableDef[],
    auth: AuthContext,
    changelog?: string,
  ): Promise<TemplateVersionRow> {
    const id = newId();
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO template_versions (id, template_id, version, workflow_version_id, variables_json,
            model_preferences_json, changelog, published_by, published_at)
         VALUES (?,?,?,?,?,'{}',?,?,?)`,
      )
      .bind(id, templateId, version, workflowVersionId, JSON.stringify(variables), changelog ?? null, auth.userId, now)
      .run();
    return {
      id, template_id: templateId, version, workflow_version_id: workflowVersionId,
      variables_json: JSON.stringify(variables), model_preferences_json: "{}",
      changelog: changelog ?? null, published_at: now,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "template";
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${newId().slice(-6).toLowerCase()}`;
      const clash = await this.env.DB.prepare(`SELECT id FROM templates WHERE slug = ?`).bind(slug).first();
      if (!clash) return slug;
    }
    return `${base}-${newId().toLowerCase()}`;
  }
}

function defaultsFor(variables: VariableDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const variable of variables) if (variable.default !== undefined) out[variable.name] = variable.default;
  return out;
}

export interface TemplateStep {
  label: string;
  type: string;
  modelId: string | null;
}

/**
 * What a template does, in the order it does it (§51, §52).
 *
 * Enough to decide whether to run something before paying for it, without
 * handing out the document itself: someone browsing a public template should
 * see the shape of the work, not a copy they could take without duplicating.
 */
function summarize(documentJson: string): TemplateStep[] {
  try {
    const doc = JSON.parse(documentJson) as {
      nodes?: { id: string; type: string; label?: string; config?: { modelId?: unknown } }[];
      edges?: { source: string; target: string }[];
    };
    const nodes = doc.nodes ?? [];
    const edges = doc.edges ?? [];

    // Ordered by how the graph flows rather than how it was stored, so the
    // list reads like the pipeline it describes.
    const incoming = new Map(nodes.map((n) => [n.id, 0]));
    for (const edge of edges) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);

    const ordered: typeof nodes = [];
    const ready = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
    const seen = new Set<string>();
    while (ready.length > 0) {
      const node = ready.shift()!;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      ordered.push(node);
      for (const edge of edges.filter((e) => e.source === node.id)) {
        const left = (incoming.get(edge.target) ?? 1) - 1;
        incoming.set(edge.target, left);
        const next = nodes.find((n) => n.id === edge.target);
        if (left === 0 && next) ready.push(next);
      }
    }
    // A cycle would leave nodes unvisited; show them rather than lose them.
    for (const node of nodes) if (!seen.has(node.id)) ordered.push(node);

    return ordered.map((node) => ({
      label: node.label ?? node.type,
      type: node.type,
      modelId: typeof node.config?.modelId === "string" ? node.config.modelId : null,
    }));
  } catch {
    return [];
  }
}
