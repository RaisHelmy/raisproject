import { AppError, newId, type AuthContext, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { workflowDocumentSchema, type WorkflowDocument } from "../engine/document";
import type { AssetHandle } from "../engine/values";
import { WorkflowExecutionService } from "./workflow-execution-service";
import { ProjectService } from "./project-service";
import { ModelPreferenceService } from "./model-preference-service";
import { ModelService } from "./model-service";
import type { ModelDefinition } from "@raisai/shared";
import type { AIProvider } from "../providers/types";

export interface CreateGenerationInput {
  modelId: string;
  prompt?: string;
  negativePrompt?: string;
  imageAssetIds?: string[];
  parameters?: Record<string, unknown>;
  projectId?: string;
  idempotencyKey?: string;
  provider?: AIProvider;
}

export interface GenerationRow {
  id: string;
  model_id: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  input_json: string;
  parameters_json: string;
  estimated_cost_sen: number;
  actual_cost_sen: number | null;
  cost_basis: "actual" | "estimated";
  error_code: string | null;
  error_message: string | null;
  project_id: string;
  workflow_run_id: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface GenerationResult {
  generation: GenerationRow;
  outputs: Record<string, unknown>;
  balanceAfterSen: Sen;
}

const SYSTEM_WORKFLOW_NAME = "Quick Create";

/**
 * Quick Create runs on the same engine as everything else (ADR-004): the
 * request is wrapped in a hidden single-node workflow, so estimation,
 * reservation, retries, caching, history and "open in workflow" all behave
 * identically for beginners and power users.
 */
export class GenerationService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "RAIS_WORKFLOW_RUN">>) {}

  async create(auth: AuthContext, input: CreateGenerationInput): Promise<GenerationResult> {
    const projects = new ProjectService(this.env);
    const project = input.projectId
      ? await projects.require(auth, input.projectId)
      : await projects.getOrCreateDefault(auth);

    // Fails early with a clear message if the model is unknown or disabled.
    const model = await new ModelService(this.env).getEnabled(input.modelId);
    this.assertReferencesAreUsable(model, input.imageAssetIds ?? []);

    const doc = this.buildDocument(input, model.category);
    const result = await this.runDocument(auth, doc, project.id, { idempotencyKey: input.idempotencyKey, provider: input.provider });

    // "Recently used" is recorded from what actually ran, not from a history
    // query, and never blocks the result someone has already paid for.
    await new ModelPreferenceService(this.env).recordUse(auth, input.modelId);
    return result;
  }

  /**
   * Runs a hidden single-purpose document on the project's system workflow
   * and returns the generation it produced. Quick Create and the studio pages
   * both come through here, so a studio run is a generation like any other:
   * same reservation, same history row, same "open in workflow".
   */
  async runDocument(
    auth: AuthContext,
    doc: WorkflowDocument,
    projectId: string,
    options: { idempotencyKey?: string; provider?: AIProvider } = {},
  ): Promise<GenerationResult> {
    const { workflowId, workflowVersionId } = await this.systemWorkflow(auth, projectId, doc);

    const execution = new WorkflowExecutionService(this.env);
    const run = await execution.start(auth, {
      doc,
      workflowId,
      workflowVersionId,
      projectId,
      variables: {},
      trigger: auth.actorType === "user" ? "ui" : auth.actorType === "mcp" ? "mcp" : "api",
      idempotencyKey: options.idempotencyKey,
      provider: options.provider,
    });

    const generation = await this.env.DB
      .prepare(`SELECT * FROM generations WHERE workflow_run_id = ? ORDER BY created_at DESC LIMIT 1`)
      .bind(run.id)
      .first<GenerationRow>();

    if (!generation) {
      throw new AppError("internal", "The generation did not produce a record.", {
        action: "Try again; nothing was charged if no output was produced.",
      });
    }

    const balance = await this.env.DB
      .prepare(`SELECT available_sen FROM balances WHERE org_id = ?`)
      .bind(auth.orgId)
      .first<{ available_sen: number }>();

    return { generation, outputs: run.outputs, balanceAfterSen: balance?.available_sen ?? 0 };
  }

  async get(auth: AuthContext, generationId: string): Promise<{ generation: GenerationRow; outputs: Record<string, unknown> }> {
    const generation = await this.env.DB
      .prepare(`SELECT * FROM generations WHERE id = ? AND org_id = ?`)
      .bind(generationId, auth.orgId)
      .first<GenerationRow>();
    if (!generation) throw new AppError("not_found", "Generation not found.");
    return { generation, outputs: await this.outputsFor(generationId) };
  }

  async list(
    auth: AuthContext,
    query: { projectId?: string; modelId?: string; status?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: { generation: GenerationRow; outputs: Record<string, unknown> }[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const where = ["org_id = ?"];
    const params: unknown[] = [auth.orgId];
    if (query.projectId) { where.push("project_id = ?"); params.push(query.projectId); }
    if (query.modelId) { where.push("model_id = ?"); params.push(query.modelId); }
    if (query.status) { where.push("status = ?"); params.push(query.status); }
    if (query.cursor) { where.push("id < ?"); params.push(query.cursor); }

    const { results } = await this.env.DB
      .prepare(`SELECT * FROM generations WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`)
      .bind(...params, limit + 1)
      .all<GenerationRow>();

    const page = results.slice(0, limit);
    const items = await Promise.all(
      page.map(async (generation) => ({ generation, outputs: await this.outputsFor(generation.id) })),
    );
    return { items, nextCursor: results.length > limit ? (page[page.length - 1]?.id ?? null) : null };
  }

  /**
   * Checks the reference images against the model before anything is built.
   *
   * Caught here rather than during graph validation so the message names the
   * model and what to do, instead of talking about ports and connections. And
   * caught before a generation row exists, because a request that never
   * reached a provider does not belong in history.
   */
  private assertReferencesAreUsable(model: ModelDefinition, imageAssetIds: string[]): void {
    if (imageAssetIds.length === 0) return;

    if (!model.capabilities.includes("image-input")) {
      throw new AppError("model_incompatible", `${model.displayName} does not support image references.`, {
        action: "Choose a model that supports image input, or remove the reference.",
      });
    }
    const max = model.limits.maxReferenceImages
      ?? (model.capabilities.includes("multiple-images") || model.capabilities.includes("start-end-frame") ? undefined : 1);

    if (max !== undefined && imageAssetIds.length > max) {
      throw new AppError(
        "model_incompatible",
        `${model.displayName} accepts at most ${max} reference image${max === 1 ? "" : "s"}. You gave ${imageAssetIds.length}.`,
        { action: "Remove the extra images, or pick a model that takes more." },
      );
    }
  }

  private async outputsFor(generationId: string): Promise<Record<string, unknown>> {
    const { results } = await this.env.DB
      .prepare(
        `SELECT go.port, go.value_json, go.asset_id, a.mime, a.width, a.height, a.duration_ms, a.current_version, a.name
         FROM generation_outputs go LEFT JOIN assets a ON a.id = go.asset_id
         WHERE go.generation_id = ?`,
      )
      .bind(generationId)
      .all<{
        port: string; value_json: string | null; asset_id: string | null; mime: string | null;
        width: number | null; height: number | null; duration_ms: number | null;
        current_version: number | null; name: string | null;
      }>();

    const outputs: Record<string, unknown> = {};
    for (const row of results) {
      if (row.asset_id && row.mime) {
        outputs[row.port] = {
          assetId: row.asset_id, mime: row.mime, version: row.current_version ?? 1, name: row.name ?? undefined,
          width: row.width ?? undefined, height: row.height ?? undefined, durationMs: row.duration_ms ?? undefined,
        } satisfies AssetHandle;
      } else if (row.value_json) {
        outputs[row.port] = JSON.parse(row.value_json);
      }
    }
    return outputs;
  }

  /** The hidden single-node graph a Quick Create request becomes. */
  private buildDocument(input: CreateGenerationInput, category: string): WorkflowDocument {
    const parameters = { ...(input.parameters ?? {}) };
    const hasImages = (input.imageAssetIds ?? []).length > 0;

    const nodes: WorkflowDocument["nodes"] = [
      {
        id: "prompt", type: "prompt", version: 1,
        config: { template: input.prompt ?? "" }, position: { x: 0, y: 0 },
      },
      {
        id: "ai", type: "ai.model", version: 1,
        config: { modelId: input.modelId, parameters }, position: { x: 240, y: 0 },
      },
      {
        id: "output", type: "output", version: 1,
        config: { name: outputPortFor(category) }, position: { x: 480, y: 0 },
      },
    ];
    const edges: WorkflowDocument["edges"] = [
      { id: "e-prompt", from: { node: "prompt", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e-out", from: { node: "ai", port: outputPortFor(category) }, to: { node: "output", port: "value" } },
    ];

    (input.imageAssetIds ?? []).forEach((assetId, index) => {
      nodes.push({
        id: `image${index}`, type: "input.image", version: 1,
        config: { assetId, mime: "image/png" }, position: { x: 0, y: 120 + index * 100 },
      });
      edges.push({
        id: `e-image${index}`,
        from: { node: `image${index}`, port: "image" },
        to: { node: "ai", port: "images" },
      });
    });

    if (input.negativePrompt) {
      nodes.push({
        id: "negative", type: "input.text", version: 1,
        config: { value: input.negativePrompt }, position: { x: 0, y: 240 },
      });
      edges.push({
        id: "e-negative",
        from: { node: "negative", port: "text" },
        to: { node: "ai", port: "negativePrompt" },
      });
    }

    return workflowDocumentSchema.parse({
      version: 1, nodes, edges, variables: [],
      settings: { cache: false, maxParallel: 1 },
      meta: { name: SYSTEM_WORKFLOW_NAME },
    });
  }

  /**
   * One hidden system workflow per project holds Quick Create runs, with a new
   * immutable version per distinct request, so history keeps pointing at the
   * exact graph that ran (§118).
   */
  private async systemWorkflow(
    auth: AuthContext,
    projectId: string,
    doc: WorkflowDocument,
  ): Promise<{ workflowId: string; workflowVersionId: string }> {
    const existing = await this.env.DB
      .prepare(`SELECT id, current_version FROM workflows WHERE org_id = ? AND project_id = ? AND is_system = 1 LIMIT 1`)
      .bind(auth.orgId, projectId)
      .first<{ id: string; current_version: number }>();

    const now = nowIso();
    let workflowId: string;
    let nextVersion: number;

    if (existing) {
      workflowId = existing.id;
      nextVersion = existing.current_version + 1;
    } else {
      workflowId = newId();
      nextVersion = 1;
      await this.env.DB
        .prepare(
          `INSERT INTO workflows (id, org_id, project_id, name, description, current_version, is_system, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,0,1,?,?,?)`,
        )
        .bind(workflowId, auth.orgId, projectId, SYSTEM_WORKFLOW_NAME, "Runs created from the Create page.", auth.userId, now, now)
        .run();
    }

    const versionId = newId();
    const execution = new WorkflowExecutionService(this.env);
    await this.env.DB
      .prepare(
        `INSERT INTO workflow_versions (id, workflow_id, version, document_json, document_hash, created_by, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(versionId, workflowId, nextVersion, JSON.stringify(doc), await execution.hashOf(doc), auth.userId, now)
      .run();

    await this.env.DB
      .prepare(`UPDATE workflows SET current_version = ?, updated_at = ? WHERE id = ?`)
      .bind(nextVersion, now, workflowId)
      .run();

    return { workflowId, workflowVersionId: versionId };
  }
}

function outputPortFor(category: string): string {
  switch (category) {
    case "image": return "image";
    case "video": return "video";
    case "audio": return "audio";
    default: return "text";
  }
}
