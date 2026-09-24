import { AppError, newId, type AuthContext, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { MovieService, type MovieRow, type SceneRow, type ShotRow } from "./movie-service";
import { GenerationService } from "./generation-service";
import { ModelService } from "./model-service";
import { PricingService } from "./pricing-service";
import type { AIProvider } from "../providers/types";

export interface ShotGenerationResult {
  shotId: string;
  status: ShotRow["status"];
  assetId: string | null;
  chargedSen: Sen;
  error?: string;
}

/**
 * Turns a written shot into a picture, then into moving footage (§39-§42).
 *
 * The prompt is assembled from the shot, its scene, the location and any
 * characters in it, so a shot generated on its own still looks like it belongs
 * to the same film. Reference images from characters and locations are passed
 * to models that can take them, which is what keeps a character recognisable
 * from shot to shot (§34).
 */
export class ShotService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  /** What this shot will cost before anyone commits to it. */
  async estimate(auth: AuthContext, shotId: string, kind: "image" | "video", modelId?: string): Promise<{ estimatedSen: Sen; modelId: string }> {
    const { shot } = await new MovieService(this.env).requireShot(auth, shotId);
    const model = await this.pickModel(kind, modelId);
    const estimate = await new PricingService(this.env).estimate(model, {
      prompt: shot.description,
      ...(kind === "video" ? { durationSeconds: shot.duration_s } : {}),
    });
    return { estimatedSen: estimate.estimatedSen, modelId: model.id };
  }

  async generateImage(
    auth: AuthContext,
    shotId: string,
    options: { modelId?: string; provider?: AIProvider } = {},
  ): Promise<ShotGenerationResult> {
    const movies = new MovieService(this.env);
    const { shot, scene, movie } = await movies.requireShot(auth, shotId);
    const model = await this.pickModel("image", options.modelId);

    const prompt = await this.buildPrompt(shot, scene, movie);
    const references = model.capabilities.includes("image-input")
      ? await this.referenceAssets(scene, movie, model.limits.maxReferenceImages ?? 1)
      : [];

    try {
      const result = await new GenerationService(this.env).create(auth, {
        modelId: model.id,
        prompt,
        imageAssetIds: references,
        projectId: movie.project_id,
        provider: options.provider,
      });

      if (result.generation.status !== "completed") {
        await this.markFailed(shot.id);
        return {
          shotId: shot.id, status: "failed", assetId: null, chargedSen: 0,
          error: result.generation.error_message ?? "The image could not be generated.",
        };
      }

      const asset = result.outputs.image as { assetId: string } | undefined;
      const chargedSen = result.generation.actual_cost_sen ?? 0;

      const version = await this.recordTake(shot.id, "image", {
        assetId: asset?.assetId ?? null,
        generationId: result.generation.id,
        modelId: model.id,
        prompt,
        costSen: chargedSen,
      });

      await this.env.DB
        .prepare(
          `UPDATE shots SET image_asset_id=?, selected_image_version=?, status='image_ready',
              cost_sen = cost_sen + ?, updated_at=? WHERE id=?`,
        )
        .bind(asset?.assetId ?? null, version, chargedSen, nowIso(), shot.id)
        .run();

      return { shotId: shot.id, status: "image_ready", assetId: asset?.assetId ?? null, chargedSen };
    } catch (error) {
      await this.markFailed(shot.id);
      throw error;
    }
  }

  async generateVideo(
    auth: AuthContext,
    shotId: string,
    options: { modelId?: string; provider?: AIProvider } = {},
  ): Promise<ShotGenerationResult> {
    const movies = new MovieService(this.env);
    const { shot, scene, movie } = await movies.requireShot(auth, shotId);

    // Image first, then motion: it is the cheaper order, and the still can be
    // judged before paying for video (§42).
    if (!shot.image_asset_id) {
      throw new AppError("invalid_input", "Generate the shot's image first.", {
        action: "Generate the storyboard image, then animate it.",
      });
    }

    const model = await this.pickModel("video", options.modelId);
    const prompt = await this.buildPrompt(shot, scene, movie);
    const useReference = model.capabilities.includes("image-to-video") || model.capabilities.includes("image-input");

    const result = await new GenerationService(this.env).create(auth, {
      modelId: model.id,
      prompt,
      imageAssetIds: useReference ? [shot.image_asset_id] : [],
      projectId: movie.project_id,
      parameters: { duration: Math.round(shot.duration_s) },
      provider: options.provider,
    });

    if (result.generation.status !== "completed") {
      return {
        shotId: shot.id, status: "image_ready", assetId: shot.image_asset_id, chargedSen: 0,
        error: result.generation.error_message ?? "The video could not be generated.",
      };
    }

    const asset = result.outputs.video as { assetId: string } | undefined;
    const chargedSen = result.generation.actual_cost_sen ?? 0;
    const version = await this.recordTake(shot.id, "video", {
      assetId: asset?.assetId ?? null,
      generationId: result.generation.id,
      modelId: model.id,
      prompt,
      costSen: chargedSen,
    });

    await this.env.DB
      .prepare(
        `UPDATE shots SET video_asset_id=?, selected_video_version=?, status='video_ready',
            cost_sen = cost_sen + ?, updated_at=? WHERE id=?`,
      )
      .bind(asset?.assetId ?? null, version, chargedSen, nowIso(), shot.id)
      .run();

    return { shotId: shot.id, status: "video_ready", assetId: asset?.assetId ?? null, chargedSen };
  }

  /**
   * Keeps a take and returns its version number (§41).
   *
   * Numbered per shot and per kind so "image 3" means the third picture of
   * that shot, which is how someone comparing takes actually thinks about it.
   */
  private async recordTake(
    shotId: string,
    kind: "image" | "video",
    take: { assetId: string | null; generationId: string; modelId: string; prompt: string; costSen: number },
  ): Promise<number> {
    const last = await this.env.DB
      .prepare(`SELECT MAX(version) AS v FROM shot_takes WHERE shot_id = ? AND kind = ?`)
      .bind(shotId, kind)
      .first<{ v: number | null }>();
    const version = (last?.v ?? 0) + 1;

    await this.env.DB
      .prepare(
        `INSERT INTO shot_takes (id, shot_id, kind, version, asset_id, generation_id, model_id, prompt, cost_sen, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(newId(), shotId, kind, version, take.assetId, take.generationId, take.modelId, take.prompt, take.costSen, nowIso())
      .run();
    return version;
  }

  /** Every take of a shot, newest first. */
  async listTakes(auth: AuthContext, shotId: string): Promise<ShotTake[]> {
    await new MovieService(this.env).requireShot(auth, shotId);
    const { results } = await this.env.DB
      .prepare(
        `SELECT id, kind, version, asset_id, model_id, cost_sen, created_at
           FROM shot_takes WHERE shot_id = ? ORDER BY kind, version DESC`,
      )
      .bind(shotId)
      .all<{ id: string; kind: "image" | "video"; version: number; asset_id: string | null; model_id: string | null; cost_sen: number; created_at: string }>();
    return (results ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      version: row.version,
      assetId: row.asset_id,
      modelId: row.model_id,
      costSen: row.cost_sen,
      createdAt: row.created_at,
    }));
  }

  /**
   * Points the shot back at an earlier take.
   *
   * Nothing is deleted and nothing is regenerated, so changing your mind twice
   * costs nothing (§41).
   */
  async selectTake(auth: AuthContext, shotId: string, takeId: string): Promise<ShotTake> {
    await new MovieService(this.env).requireShot(auth, shotId);
    const take = await this.env.DB
      .prepare(`SELECT id, kind, version, asset_id, model_id, cost_sen, created_at FROM shot_takes WHERE id = ? AND shot_id = ?`)
      .bind(takeId, shotId)
      .first<{ id: string; kind: "image" | "video"; version: number; asset_id: string | null; model_id: string | null; cost_sen: number; created_at: string }>();
    if (!take) throw new AppError("not_found", "That version does not exist.");

    const column = take.kind === "image" ? "image_asset_id" : "video_asset_id";
    const versionColumn = take.kind === "image" ? "selected_image_version" : "selected_video_version";
    await this.env.DB
      .prepare(`UPDATE shots SET ${column}=?, ${versionColumn}=?, updated_at=? WHERE id=?`)
      .bind(take.asset_id, take.version, nowIso(), shotId)
      .run();

    return {
      id: take.id, kind: take.kind, version: take.version, assetId: take.asset_id,
      modelId: take.model_id, costSen: take.cost_sen, createdAt: take.created_at,
    };
  }

  /**
   * The full prompt for a shot: what the camera does, what is in frame, where
   * it is, and how the film looks. Assembled rather than stored so editing the
   * scene updates every shot under it.
   */
  async buildPrompt(shot: ShotRow, scene: SceneRow, movie: MovieRow): Promise<string> {
    const style = (JSON.parse(movie.style_json) as { visualStyle?: string }).visualStyle;
    const location = scene.location_id
      ? await this.env.DB.prepare(`SELECT name, description, lighting FROM locations WHERE id = ?`)
          .bind(scene.location_id)
          .first<{ name: string; description: string | null; lighting: string | null }>()
      : null;

    const characterNames = JSON.parse(scene.characters_json) as string[];
    const characters = characterNames.length
      ? await this.env.DB
          .prepare(
            `SELECT name, appearance FROM characters WHERE project_id = ? AND name IN (${characterNames.map(() => "?").join(",")})`,
          )
          .bind(movie.project_id, ...characterNames)
          .all<{ name: string; appearance: string | null }>()
      : { results: [] };

    const parts = [
      shot.description,
      shot.shot_type ? `${shot.shot_type} shot` : null,
      shot.camera_movement && shot.camera_movement !== "static" ? `camera ${shot.camera_movement}` : null,
      location ? `Location: ${location.name}${location.description ? `, ${location.description}` : ""}` : null,
      location?.lighting ? `Lighting: ${location.lighting}` : null,
      scene.time_of_day ? `Time: ${scene.time_of_day}` : null,
      ...characters.results.map((c) => (c.appearance ? `${c.name}: ${c.appearance}` : null)),
      ...cinematicParts(shot.cinematic_json),
      style ? `Style: ${style}` : null,
    ];
    return parts.filter(Boolean).join(". ");
  }

  /**
   * Edits a shot (§38, §40).
   *
   * Cinematic settings are merged rather than replaced, so setting the lens
   * does not silently clear the lighting someone chose earlier.
   */
  async updateShot(
    auth: AuthContext,
    shotId: string,
    patch: {
      description?: string;
      durationS?: number;
      shotType?: string | null;
      cameraMovement?: string | null;
      cinematic?: Record<string, string | null>;
    },
  ): Promise<ShotRow> {
    const { shot } = await new MovieService(this.env).requireShot(auth, shotId);

    if (patch.durationS !== undefined && (!(patch.durationS > 0) || patch.durationS > 60)) {
      throw new AppError("invalid_input", "A shot lasts between 0 and 60 seconds.", {
        action: "Enter a length in seconds.",
      });
    }

    const current = JSON.parse(shot.cinematic_json) as Record<string, string>;
    const merged = { ...current };
    for (const [key, value] of Object.entries(patch.cinematic ?? {})) {
      // An empty value clears the setting rather than storing a blank.
      if (value === null || value === "") delete merged[key];
      else merged[key] = value;
    }

    await this.env.DB
      .prepare(
        `UPDATE shots SET description=?, duration_s=?, shot_type=?, camera_movement=?, cinematic_json=?, updated_at=?
          WHERE id=?`,
      )
      .bind(
        patch.description ?? shot.description,
        patch.durationS ?? shot.duration_s,
        patch.shotType === undefined ? shot.shot_type : patch.shotType || null,
        patch.cameraMovement === undefined ? shot.camera_movement : patch.cameraMovement || null,
        JSON.stringify(merged),
        nowIso(),
        shotId,
      )
      .run();

    return (await new MovieService(this.env).requireShot(auth, shotId)).shot;
  }

  /** Character and location references, capped by what the model accepts (§34). */
  private async referenceAssets(scene: SceneRow, movie: MovieRow, max: number): Promise<string[]> {
    const ids: string[] = [];
    const characterNames = JSON.parse(scene.characters_json) as string[];

    if (characterNames.length > 0) {
      const { results } = await this.env.DB
        .prepare(
          `SELECT reference_asset_ids_json FROM characters
            WHERE project_id = ? AND name IN (${characterNames.map(() => "?").join(",")})`,
        )
        .bind(movie.project_id, ...characterNames)
        .all<{ reference_asset_ids_json: string }>();
      for (const row of results) ids.push(...(JSON.parse(row.reference_asset_ids_json) as string[]));
    }

    if (scene.location_id) {
      const location = await this.env.DB
        .prepare(`SELECT reference_asset_ids_json FROM locations WHERE id = ?`)
        .bind(scene.location_id)
        .first<{ reference_asset_ids_json: string }>();
      if (location) ids.push(...(JSON.parse(location.reference_asset_ids_json) as string[]));
    }
    return ids.slice(0, max);
  }

  private async markFailed(shotId: string): Promise<void> {
    await this.env.DB
      .prepare(`UPDATE shots SET status='failed', updated_at=? WHERE id=?`)
      .bind(nowIso(), shotId)
      .run();
  }

  private async pickModel(kind: "image" | "video", modelId?: string) {
    const models = new ModelService(this.env);
    if (modelId) return models.getEnabled(modelId);

    const candidates = await models.list({ category: kind });
    const preferred =
      candidates.find((m) => m.tags.includes("cinematic")) ??
      candidates.find((m) => m.tags.includes("quality")) ??
      candidates[0];

    if (!preferred) {
      throw new AppError("model_not_enabled", `No ${kind} model is available.`, {
        action: kind === "video"
          ? "Ask an administrator to enable a video model."
          : "Ask an administrator to enable an image model.",
      });
    }
    return preferred;
  }
}

export interface ShotTake {
  id: string;
  kind: "image" | "video";
  version: number;
  assetId: string | null;
  modelId: string | null;
  costSen: number;
  createdAt: string;
}

/** Camera settings written into the prompt, in the order a director says them. */
const CINEMATIC_ORDER = ["lens", "focalLength", "depthOfField", "aperture", "lighting", "timeOfDay", "composition", "framing", "motion"] as const;

export const CINEMATIC_FIELDS: { name: string; label: string; options: string[] }[] = [
  { name: "lens", label: "Lens", options: ["wide", "standard", "telephoto", "macro", "anamorphic"] },
  { name: "focalLength", label: "Focal length", options: ["14mm", "24mm", "35mm", "50mm", "85mm", "135mm"] },
  { name: "depthOfField", label: "Depth of field", options: ["shallow", "medium", "deep"] },
  { name: "aperture", label: "Aperture", options: ["f/1.4", "f/2.8", "f/4", "f/8", "f/16"] },
  { name: "lighting", label: "Lighting", options: ["natural", "soft", "hard", "backlit", "low key", "high key", "neon"] },
  { name: "timeOfDay", label: "Time of day", options: ["dawn", "morning", "noon", "golden hour", "dusk", "night"] },
  { name: "composition", label: "Composition", options: ["rule of thirds", "centred", "symmetrical", "leading lines"] },
  { name: "framing", label: "Framing", options: ["tight", "loose", "over the shoulder", "two shot"] },
  { name: "motion", label: "Motion", options: ["still", "slow", "fast", "handheld", "locked off"] },
];

function cinematicParts(cinematicJson: string): (string | null)[] {
  try {
    const values = JSON.parse(cinematicJson) as Record<string, string>;
    return CINEMATIC_ORDER.map((key) => {
      const value = values[key];
      if (!value) return null;
      const field = CINEMATIC_FIELDS.find((f) => f.name === key);
      return `${field?.label ?? key}: ${value}`;
    });
  } catch {
    return [];
  }
}
