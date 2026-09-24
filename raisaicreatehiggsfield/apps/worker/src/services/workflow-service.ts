import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { emptyDocument, hashDocument, workflowDocumentSchema, type WorkflowDocument } from "../engine/document";

export interface WorkflowRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  description: string | null;
  current_version: number;
  visibility: "private" | "unlisted" | "public";
  is_system: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkflowWithDocument {
  workflow: WorkflowRow;
  document: WorkflowDocument;
  /** True when the draft differs from the newest frozen version. */
  hasUnsavedChanges: boolean;
}

/**
 * Workflow definitions and their drafts.
 *
 * Editing writes to `workflow_drafts` continuously (autosave, §84). A version
 * is only frozen when the workflow runs or is published, and versions are
 * immutable so a historical run always means what it meant (§118).
 */
export class WorkflowService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async create(auth: AuthContext, input: { name: string; projectId: string; description?: string; document?: WorkflowDocument }): Promise<WorkflowWithDocument> {
    const name = input.name.trim();
    if (!name) throw new AppError("invalid_input", "Give the workflow a name.");
    const id = newId();
    const now = nowIso();
    const document = input.document ? workflowDocumentSchema.parse(input.document) : emptyDocument();

    await this.env.DB
      .prepare(
        `INSERT INTO workflows (id, org_id, project_id, name, description, current_version, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,0,?,?,?)`,
      )
      .bind(id, auth.orgId, input.projectId, name, input.description ?? null, auth.userId, now, now)
      .run();
    await this.saveDraft(auth, id, document);
    return this.get(auth, id);
  }

  async get(auth: AuthContext, workflowId: string): Promise<WorkflowWithDocument> {
    const workflow = await this.require(auth, workflowId);
    const draft = await this.env.DB
      .prepare(`SELECT document_json FROM workflow_drafts WHERE workflow_id = ?`)
      .bind(workflowId)
      .first<{ document_json: string }>();

    const latest = await this.env.DB
      .prepare(`SELECT document_json, document_hash FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC LIMIT 1`)
      .bind(workflowId)
      .first<{ document_json: string; document_hash: string }>();

    const raw = draft?.document_json ?? latest?.document_json;
    const document = raw ? workflowDocumentSchema.parse(JSON.parse(raw)) : emptyDocument();
    const hasUnsavedChanges = latest ? (await hashDocument(document)) !== latest.document_hash : true;
    return { workflow, document, hasUnsavedChanges };
  }

  async list(auth: AuthContext, projectId?: string): Promise<WorkflowRow[]> {
    const where = ["org_id = ?", "deleted_at IS NULL", "is_system = 0"];
    const params: unknown[] = [auth.orgId];
    if (projectId) {
      where.push("project_id = ?");
      params.push(projectId);
    }
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM workflows WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`)
      .bind(...params)
      .all<WorkflowRow>();
    return results;
  }

  /** Autosave target. Cheap and frequent; never creates a version. */
  async saveDraft(auth: AuthContext, workflowId: string, document: WorkflowDocument): Promise<void> {
    await this.require(auth, workflowId);
    const parsed = workflowDocumentSchema.parse(document);
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO workflow_drafts (workflow_id, document_json, updated_at) VALUES (?,?,?)
         ON CONFLICT(workflow_id) DO UPDATE SET document_json = excluded.document_json, updated_at = excluded.updated_at`,
      )
      .bind(workflowId, JSON.stringify(parsed), now)
      .run();
    await this.env.DB
      .prepare(`UPDATE workflows SET updated_at = ? WHERE id = ?`)
      .bind(now, workflowId)
      .run();
  }

  async rename(auth: AuthContext, workflowId: string, patch: { name?: string; description?: string }): Promise<WorkflowRow> {
    const workflow = await this.require(auth, workflowId);
    await this.env.DB
      .prepare(`UPDATE workflows SET name = ?, description = ?, updated_at = ? WHERE id = ?`)
      .bind(patch.name?.trim() || workflow.name, patch.description ?? workflow.description, nowIso(), workflowId)
      .run();
    return this.require(auth, workflowId);
  }

  /**
   * Freezes the current draft into an immutable version, reusing the newest one
   * when nothing meaningful changed. Node positions are excluded from the hash,
   * so dragging a node around does not pile up versions.
   */
  async freezeVersion(auth: AuthContext, workflowId: string, document?: WorkflowDocument): Promise<{ versionId: string; version: number; document: WorkflowDocument }> {
    const workflow = await this.require(auth, workflowId);
    const doc = document ? workflowDocumentSchema.parse(document) : (await this.get(auth, workflowId)).document;
    const hash = await hashDocument(doc);

    const existing = await this.env.DB
      .prepare(`SELECT id, version FROM workflow_versions WHERE workflow_id = ? AND document_hash = ? ORDER BY version DESC LIMIT 1`)
      .bind(workflowId, hash)
      .first<{ id: string; version: number }>();
    if (existing) return { versionId: existing.id, version: existing.version, document: doc };

    const versionId = newId();
    const version = workflow.current_version + 1;
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO workflow_versions (id, workflow_id, version, document_json, document_hash, created_by, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(versionId, workflowId, version, JSON.stringify(doc), hash, auth.userId, now)
      .run();
    await this.env.DB
      .prepare(`UPDATE workflows SET current_version = ?, updated_at = ? WHERE id = ?`)
      .bind(version, now, workflowId)
      .run();
    return { versionId, version, document: doc };
  }

  async softDelete(auth: AuthContext, workflowId: string): Promise<void> {
    await this.require(auth, workflowId);
    await this.env.DB
      .prepare(`UPDATE workflows SET deleted_at = ? WHERE id = ? AND org_id = ?`)
      .bind(nowIso(), workflowId, auth.orgId)
      .run();
  }

  async require(auth: AuthContext, workflowId: string): Promise<WorkflowRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM workflows WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
      .bind(workflowId, auth.orgId)
      .first<WorkflowRow>();
    if (!row) throw new AppError("not_found", "Workflow not found.");
    return row;
  }
}
