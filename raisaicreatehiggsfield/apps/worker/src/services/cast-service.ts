import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { AssetService } from "./asset-service";

export interface CharacterRow {
  id: string;
  project_id: string;
  name: string;
  age: string | null;
  description: string | null;
  appearance: string | null;
  personality: string | null;
  voice_json: string;
  reference_asset_ids_json: string;
  updated_at: string;
}

export interface LocationRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  style: string | null;
  lighting: string | null;
  reference_asset_ids_json: string;
  updated_at: string;
}

export interface CharacterPatch {
  name?: string;
  age?: string;
  description?: string;
  appearance?: string;
  personality?: string;
  voice?: { modelId?: string; lang?: string; notes?: string };
  referenceAssetIds?: string[];
}

export interface LocationPatch {
  name?: string;
  description?: string;
  style?: string;
  lighting?: string;
  referenceAssetIds?: string[];
}

/**
 * The cast and the places (§33, §35).
 *
 * Both live at project level so a second movie in the same project reuses
 * them, and both carry reference images, which is the actual mechanism behind
 * character consistency: those images are what gets passed to a model that can
 * take them (§34).
 */
export class CastService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS">) {}

  async listCharacters(auth: AuthContext, projectId: string): Promise<CharacterRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM characters WHERE project_id = ? AND org_id = ? ORDER BY name`)
      .bind(projectId, auth.orgId)
      .all<CharacterRow>();
    return results;
  }

  async listLocations(auth: AuthContext, projectId: string): Promise<LocationRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM locations WHERE project_id = ? AND org_id = ? ORDER BY name`)
      .bind(projectId, auth.orgId)
      .all<LocationRow>();
    return results;
  }

  async createCharacter(auth: AuthContext, projectId: string, patch: CharacterPatch): Promise<CharacterRow> {
    const name = patch.name?.trim();
    if (!name) throw new AppError("invalid_input", "Give the character a name.");

    const id = newId();
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO characters (id, project_id, org_id, name, age, description, appearance, personality,
            voice_json, reference_asset_ids_json, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id, projectId, auth.orgId, name, patch.age ?? null, patch.description ?? null,
        patch.appearance ?? null, patch.personality ?? null,
        JSON.stringify(patch.voice ?? {}), JSON.stringify(await this.verifyAssets(auth, patch.referenceAssetIds ?? [])),
        now, now,
      )
      .run();
    return this.requireCharacter(auth, id);
  }

  async updateCharacter(auth: AuthContext, id: string, patch: CharacterPatch): Promise<CharacterRow> {
    const current = await this.requireCharacter(auth, id);
    const references = patch.referenceAssetIds
      ? await this.verifyAssets(auth, patch.referenceAssetIds)
      : (JSON.parse(current.reference_asset_ids_json) as string[]);

    await this.env.DB
      .prepare(
        `UPDATE characters SET name=?, age=?, description=?, appearance=?, personality=?,
            voice_json=?, reference_asset_ids_json=?, updated_at=? WHERE id=? AND org_id=?`,
      )
      .bind(
        patch.name?.trim() || current.name,
        patch.age ?? current.age,
        patch.description ?? current.description,
        patch.appearance ?? current.appearance,
        patch.personality ?? current.personality,
        JSON.stringify(patch.voice ?? (JSON.parse(current.voice_json) as unknown)),
        JSON.stringify(references),
        nowIso(), id, auth.orgId,
      )
      .run();
    return this.requireCharacter(auth, id);
  }

  async createLocation(auth: AuthContext, projectId: string, patch: LocationPatch): Promise<LocationRow> {
    const name = patch.name?.trim();
    if (!name) throw new AppError("invalid_input", "Give the location a name.");

    const id = newId();
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO locations (id, project_id, org_id, name, description, style, lighting,
            reference_asset_ids_json, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id, projectId, auth.orgId, name, patch.description ?? null, patch.style ?? null, patch.lighting ?? null,
        JSON.stringify(await this.verifyAssets(auth, patch.referenceAssetIds ?? [])), now, now,
      )
      .run();
    return this.requireLocation(auth, id);
  }

  async updateLocation(auth: AuthContext, id: string, patch: LocationPatch): Promise<LocationRow> {
    const current = await this.requireLocation(auth, id);
    const references = patch.referenceAssetIds
      ? await this.verifyAssets(auth, patch.referenceAssetIds)
      : (JSON.parse(current.reference_asset_ids_json) as string[]);

    await this.env.DB
      .prepare(
        `UPDATE locations SET name=?, description=?, style=?, lighting=?, reference_asset_ids_json=?, updated_at=?
          WHERE id=? AND org_id=?`,
      )
      .bind(
        patch.name?.trim() || current.name,
        patch.description ?? current.description,
        patch.style ?? current.style,
        patch.lighting ?? current.lighting,
        JSON.stringify(references), nowIso(), id, auth.orgId,
      )
      .run();
    return this.requireLocation(auth, id);
  }

  async requireCharacter(auth: AuthContext, id: string): Promise<CharacterRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM characters WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<CharacterRow>();
    if (!row) throw new AppError("not_found", "Character not found.");
    return row;
  }

  async requireLocation(auth: AuthContext, id: string): Promise<LocationRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM locations WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<LocationRow>();
    if (!row) throw new AppError("not_found", "Location not found.");
    return row;
  }

  async deleteCharacter(auth: AuthContext, id: string): Promise<void> {
    await this.requireCharacter(auth, id);
    await this.env.DB.prepare(`DELETE FROM characters WHERE id = ? AND org_id = ?`).bind(id, auth.orgId).run();
  }

  async deleteLocation(auth: AuthContext, id: string): Promise<void> {
    await this.requireLocation(auth, id);
    await this.env.DB.prepare(`DELETE FROM locations WHERE id = ? AND org_id = ?`).bind(id, auth.orgId).run();
  }

  /**
   * Keeps only references the caller actually owns.
   *
   * A reference id is written into a row and later handed to a model, so an id
   * from another workspace would be a way to read someone else's file.
   */
  private async verifyAssets(auth: AuthContext, assetIds: string[]): Promise<string[]> {
    if (assetIds.length === 0) return [];
    const assets = new AssetService(this.env);
    const owned: string[] = [];
    for (const id of assetIds.slice(0, 8)) {
      const asset = await assets.findById(auth, id);
      if (!asset) {
        throw new AppError("not_found", "One of those reference images is not in your assets.", {
          action: "Pick the images again.",
        });
      }
      owned.push(asset.id);
    }
    return owned;
  }
}
