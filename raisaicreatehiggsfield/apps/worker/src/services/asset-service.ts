import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, runBatch } from "../db/client";
import { assetKey, assetKindFor, extensionFor } from "../storage/keys";

export interface AssetRow {
  id: string;
  org_id: string;
  project_id: string;
  kind: "image" | "video" | "audio" | "document" | "reference";
  name: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  current_version: number;
  source: "upload" | "generation";
  generation_id: string | null;
  thumbnail_key: string | null;
  tags_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AssetVersionRow {
  id: string;
  asset_id: string;
  version: number;
  r2_key: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  generation_id: string | null;
  created_at: string;
}

export interface CreateAssetInput {
  projectId: string;
  name: string;
  mime: string;
  bytes: ArrayBuffer;
  source: "upload" | "generation";
  generationId?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  tags?: string[];
}

export interface ListAssetsQuery {
  projectId?: string;
  kind?: AssetRow["kind"];
  limit?: number;
  cursor?: string;
}

const MAX_INLINE_BYTES = 100 * 1024 * 1024; // 100 MB, matches the workflow limit
export const FEATURED_TAG = "featured";

/**
 * Assets are R2 objects plus D1 metadata (§47, §68). Binary content never
 * enters D1. Every asset keeps its history: a new version is added rather than
 * overwriting, so a regenerated shot can always fall back (§41).
 */
export class AssetService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS">) {}

  async create(ctx: AuthContext, input: CreateAssetInput): Promise<AssetRow> {
    if (input.bytes.byteLength > MAX_INLINE_BYTES) {
      throw new AppError("invalid_input", "That file is larger than 100 MB.", { action: "Upload a smaller file." });
    }
    await this.assertProjectAccess(ctx, input.projectId);

    const assetId = newId();
    const version = 1;
    const key = assetKey(ctx.orgId, input.projectId, assetId, version, extensionFor(input.mime));
    await this.env.ASSETS.put(key, input.bytes, { httpMetadata: { contentType: input.mime } });

    const now = nowIso();
    await runBatch(this.env.DB, [
      {
        sql: `INSERT INTO assets (id, org_id, project_id, kind, name, mime, size_bytes, width, height, duration_ms,
                current_version, source, generation_id, tags_json, created_by, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          assetId, ctx.orgId, input.projectId, assetKindFor(input.mime), input.name, input.mime,
          input.bytes.byteLength, input.width ?? null, input.height ?? null, input.durationMs ?? null,
          version, input.source, input.generationId ?? null, JSON.stringify(input.tags ?? []),
          ctx.userId, now, now,
        ],
      },
      {
        sql: `INSERT INTO asset_versions (id, asset_id, version, r2_key, mime, size_bytes, width, height, duration_ms, generation_id, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          newId(), assetId, version, key, input.mime, input.bytes.byteLength,
          input.width ?? null, input.height ?? null, input.durationMs ?? null, input.generationId ?? null, now,
        ],
      },
    ]);

    const created = await this.findById(ctx, assetId);
    if (!created) throw new AppError("internal", "Asset could not be read back after creation.");
    return created;
  }

  /** Adds a version without destroying the previous one (§41). */
  async addVersion(ctx: AuthContext, assetId: string, input: Omit<CreateAssetInput, "projectId" | "name" | "source">): Promise<AssetRow> {
    const asset = await this.findById(ctx, assetId);
    if (!asset) throw new AppError("not_found", "Asset not found.");

    const version = asset.current_version + 1;
    const key = assetKey(ctx.orgId, asset.project_id, assetId, version, extensionFor(input.mime));
    await this.env.ASSETS.put(key, input.bytes, { httpMetadata: { contentType: input.mime } });

    const now = nowIso();
    await runBatch(this.env.DB, [
      {
        sql: `INSERT INTO asset_versions (id, asset_id, version, r2_key, mime, size_bytes, width, height, duration_ms, generation_id, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        params: [
          newId(), assetId, version, key, input.mime, input.bytes.byteLength,
          input.width ?? null, input.height ?? null, input.durationMs ?? null, input.generationId ?? null, now,
        ],
      },
      {
        sql: `UPDATE assets SET current_version = ?, mime = ?, size_bytes = ?, width = ?, height = ?, duration_ms = ?, updated_at = ? WHERE id = ?`,
        params: [
          version, input.mime, input.bytes.byteLength, input.width ?? null, input.height ?? null,
          input.durationMs ?? null, now, assetId,
        ],
      },
    ]);

    const updated = await this.findById(ctx, assetId);
    if (!updated) throw new AppError("internal", "Asset could not be read back.");
    return updated;
  }

  async findById(ctx: AuthContext, assetId: string): Promise<AssetRow | null> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM assets WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
      .bind(assetId, ctx.orgId)
      .first<AssetRow>();
    return row ?? null;
  }

  /** Ownership is enforced here, not at the route, so MCP and API get it too (§109). */
  async require(ctx: AuthContext, assetId: string): Promise<AssetRow> {
    const asset = await this.findById(ctx, assetId);
    if (!asset) throw new AppError("not_found", "Asset not found.", { action: "Pick a file from your assets." });
    return asset;
  }

  async getVersion(ctx: AuthContext, assetId: string, version?: number): Promise<AssetVersionRow> {
    const asset = await this.require(ctx, assetId);
    const wanted = version ?? asset.current_version;
    const row = await this.env.DB
      .prepare(`SELECT * FROM asset_versions WHERE asset_id = ? AND version = ?`)
      .bind(assetId, wanted)
      .first<AssetVersionRow>();
    if (!row) throw new AppError("not_found", `Version ${wanted} of this asset does not exist.`);
    return row;
  }

  async readBytes(ctx: AuthContext, assetId: string, version?: number): Promise<{ bytes: ArrayBuffer; mime: string }> {
    const v = await this.getVersion(ctx, assetId, version);
    const object = await this.env.ASSETS.get(v.r2_key);
    if (!object) throw new AppError("not_found", "The stored file is missing.");
    return { bytes: await object.arrayBuffer(), mime: v.mime };
  }

  async list(ctx: AuthContext, query: ListAssetsQuery = {}): Promise<{ items: AssetRow[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const where = ["org_id = ?", "deleted_at IS NULL"];
    const params: unknown[] = [ctx.orgId];
    if (query.projectId) {
      where.push("project_id = ?");
      params.push(query.projectId);
    }
    if (query.kind) {
      where.push("kind = ?");
      params.push(query.kind);
    }
    if (query.cursor) {
      where.push("id < ?");
      params.push(query.cursor);
    }
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM assets WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`)
      .bind(...params, limit + 1)
      .all<AssetRow>();

    const items = results.slice(0, limit);
    return { items, nextCursor: results.length > limit ? (items[items.length - 1]?.id ?? null) : null };
  }

  /**
   * Featuring puts an asset on the public landing page. It is a tag rather
   * than a column so no migration is needed, and it is admin-only because
   * it publishes a customer's output to the world (routes enforce that).
   * The prompt and studio are stored beside the tag so the public card can
   * say what made the picture without a join into private history.
   */
  async setFeatured(assetId: string, featured: boolean, meta: { prompt?: string; studio?: string } = {}): Promise<void> {
    const row = await this.env.DB
      .prepare(`SELECT tags_json FROM assets WHERE id = ? AND deleted_at IS NULL`)
      .bind(assetId)
      .first<{ tags_json: string }>();
    if (!row) throw new AppError("not_found", "Asset not found.");
    const tags = (JSON.parse(row.tags_json) as string[]).filter((t) => t !== FEATURED_TAG && !t.startsWith(`${FEATURED_TAG}:`));
    if (featured) {
      tags.push(FEATURED_TAG);
      if (meta.prompt) tags.push(`${FEATURED_TAG}:prompt:${meta.prompt.slice(0, 300)}`);
      if (meta.studio) tags.push(`${FEATURED_TAG}:studio:${meta.studio.slice(0, 40)}`);
    }
    await this.env.DB
      .prepare(`UPDATE assets SET tags_json = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(tags), nowIso(), assetId)
      .run();
  }

  /** Featured assets across every org, newest first. Public, so no auth context. */
  async listFeatured(limit = 48): Promise<(AssetRow & { prompt: string | null; studio: string | null })[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM assets WHERE deleted_at IS NULL AND tags_json LIKE ? ORDER BY updated_at DESC LIMIT ?`)
      .bind(`%"${FEATURED_TAG}"%`, Math.min(Math.max(limit, 1), 100))
      .all<AssetRow>();
    return results
      .filter((a) => (JSON.parse(a.tags_json) as string[]).includes(FEATURED_TAG))
      .map((a) => {
        const tags = JSON.parse(a.tags_json) as string[];
        const pick = (key: string) => tags.find((t) => t.startsWith(`${FEATURED_TAG}:${key}:`))?.slice(FEATURED_TAG.length + key.length + 2) ?? null;
        return { ...a, prompt: pick("prompt"), studio: pick("studio") };
      });
  }

  /** The current version of a featured asset, or null when it is not featured. */
  async featuredVersion(assetId: string): Promise<AssetVersionRow | null> {
    const asset = await this.env.DB
      .prepare(`SELECT tags_json, current_version FROM assets WHERE id = ? AND deleted_at IS NULL`)
      .bind(assetId)
      .first<{ tags_json: string; current_version: number }>();
    if (!asset || !(JSON.parse(asset.tags_json) as string[]).includes(FEATURED_TAG)) return null;
    return this.env.DB
      .prepare(`SELECT * FROM asset_versions WHERE asset_id = ? AND version = ?`)
      .bind(assetId, asset.current_version)
      .first<AssetVersionRow>();
  }

  /** Soft delete: history stays intact and R2 objects are reclaimed by a sweeper. */
  async softDelete(ctx: AuthContext, assetId: string): Promise<void> {
    await this.require(ctx, assetId);
    await this.env.DB
      .prepare(`UPDATE assets SET deleted_at = ? WHERE id = ? AND org_id = ?`)
      .bind(nowIso(), assetId, ctx.orgId)
      .run();
  }

  private async assertProjectAccess(ctx: AuthContext, projectId: string): Promise<void> {
    const row = await this.env.DB
      .prepare(`SELECT id FROM projects WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
      .bind(projectId, ctx.orgId)
      .first<{ id: string }>();
    if (!row) throw new AppError("not_found", "Project not found.", { action: "Pick one of your projects." });
  }
}
