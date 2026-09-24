import { AppError, newId, type AuthContext, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, runBatch } from "../db/client";
import { ProjectService } from "./project-service";
import { GenerationService } from "./generation-service";
import { ModelService } from "./model-service";
import { extractJson, storyPrompt, storySchema, type Story } from "./story-schema";
import type { AIProvider } from "../providers/types";

export interface MovieRow {
  id: string;
  project_id: string;
  org_id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  idea: string | null;
  style_json: string;
  status: string;
  target_duration_s: number | null;
  created_at: string;
  updated_at: string;
}

export interface SceneRow {
  id: string;
  movie_id: string;
  number: number;
  title: string;
  location_id: string | null;
  time_of_day: string | null;
  characters_json: string;
  action: string | null;
  dialogue_json: string;
  duration_s: number | null;
}

export interface ShotRow {
  id: string;
  scene_id: string;
  number: number;
  shot_type: string | null;
  camera_movement: string | null;
  description: string;
  duration_s: number;
  cinematic_json: string;
  image_asset_id: string | null;
  video_asset_id: string | null;
  status: string;
  cost_sen: number;
}

/**
 * Movie production (§30-§42).
 *
 * The movie is structured data the user can edit, and generation happens shot
 * by shot so a single take can be redone without paying for the rest again.
 */
export class MovieService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  async create(auth: AuthContext, input: { title: string; idea?: string; projectId?: string; targetDurationSeconds?: number }): Promise<MovieRow> {
    const projects = new ProjectService(this.env);
    const project = input.projectId
      ? await projects.require(auth, input.projectId)
      : await projects.create(auth, { name: input.title.trim() || "Untitled movie", kind: "movie" });

    const id = newId();
    const now = nowIso();
    await this.env.DB
      .prepare(
        `INSERT INTO movies (id, project_id, org_id, title, idea, target_duration_s, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(id, project.id, auth.orgId, input.title.trim() || "Untitled movie", input.idea ?? null,
            input.targetDurationSeconds ?? 600, auth.userId, now, now)
      .run();
    return this.require(auth, id);
  }

  async require(auth: AuthContext, movieId: string): Promise<MovieRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM movies WHERE id = ? AND org_id = ? AND deleted_at IS NULL`)
      .bind(movieId, auth.orgId)
      .first<MovieRow>();
    if (!row) throw new AppError("not_found", "Movie not found.");
    return row;
  }

  async list(auth: AuthContext): Promise<MovieRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM movies WHERE org_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`)
      .bind(auth.orgId)
      .all<MovieRow>();
    return results;
  }

  /**
   * Turns an idea into a treatment, then stores it as editable rows.
   *
   * The model is asked for JSON and the reply is parsed against a schema. A
   * reply that does not fit is refused rather than half-imported, because a
   * partly-written movie is worse than none.
   */
  async generateStory(
    auth: AuthContext,
    movieId: string,
    options: { modelId?: string; provider?: AIProvider } = {},
  ): Promise<{ story: Story; chargedSen: Sen }> {
    const movie = await this.require(auth, movieId);
    if (!movie.idea?.trim()) {
      throw new AppError("invalid_input", "Describe the movie you want before generating a story.", {
        action: "Write a sentence or two about the idea.",
      });
    }

    const modelId = options.modelId ?? (await this.defaultTextModel());
    const generation = await new GenerationService(this.env).create(auth, {
      modelId,
      prompt: storyPrompt(movie.idea, movie.target_duration_s ?? 600),
      projectId: movie.project_id,
      parameters: { maxTokens: 4096 },
      provider: options.provider,
    });

    if (generation.generation.status !== "completed") {
      throw new AppError("provider_error", generation.generation.error_message ?? "The story could not be written.", {
        action: "Try again, or pick a different text model.",
      });
    }

    const text = typeof generation.outputs.text === "string" ? generation.outputs.text : "";
    const parsed = storySchema.safeParse(extractJson(text));
    if (!parsed.success) {
      throw new AppError("provider_error", "The model did not return a usable story.", {
        action: "Try again, or choose a stronger text model.",
        details: { issues: parsed.error.issues.slice(0, 5).map((i) => i.message) },
      });
    }

    await this.applyStory(auth, movie, parsed.data);
    return { story: parsed.data, chargedSen: generation.generation.actual_cost_sen ?? 0 };
  }

  /** Writes a treatment into rows: characters, locations, scenes and shots. */
  async applyStory(auth: AuthContext, movie: MovieRow, story: Story): Promise<void> {
    const now = nowIso();
    const characterIds = new Map<string, string>();
    const locationIds = new Map<string, string>();

    for (const character of story.characters) {
      const id = newId();
      characterIds.set(character.name, id);
      await this.env.DB
        .prepare(
          `INSERT INTO characters (id, project_id, org_id, name, age, description, appearance, personality, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(id, movie.project_id, auth.orgId, character.name, character.age ?? null,
              character.description, character.appearance, character.personality, now, now)
        .run();
    }

    for (const location of story.locations) {
      const id = newId();
      locationIds.set(location.name, id);
      await this.env.DB
        .prepare(
          `INSERT INTO locations (id, project_id, org_id, name, description, lighting, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(id, movie.project_id, auth.orgId, location.name, location.description, location.lighting, now, now)
        .run();
    }

    for (const scene of story.scenes) {
      const sceneId = newId();
      await this.env.DB
        .prepare(
          `INSERT INTO scenes (id, movie_id, number, title, location_id, time_of_day, characters_json,
              action, dialogue_json, visual_style, duration_s, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          sceneId, movie.id, scene.number, scene.title, locationIds.get(scene.location) ?? null,
          scene.timeOfDay, JSON.stringify(scene.characters), scene.action,
          JSON.stringify(scene.dialogue), story.visualStyle,
          scene.shots.reduce((sum, s) => sum + s.durationSeconds, 0), now, now,
        )
        .run();

      for (const shot of scene.shots) {
        await this.env.DB
          .prepare(
            `INSERT INTO shots (id, scene_id, number, shot_type, camera_movement, description, duration_s, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
          )
          .bind(newId(), sceneId, shot.number, shot.shotType, shot.cameraMovement, shot.description, shot.durationSeconds, now, now)
          .run();
      }
    }

    await this.env.DB
      .prepare(`UPDATE movies SET title=?, logline=?, synopsis=?, style_json=?, status='story', updated_at=? WHERE id=?`)
      .bind(story.title, story.logline, story.synopsis, JSON.stringify({ visualStyle: story.visualStyle }), now, movie.id)
      .run();
  }

  async scenes(auth: AuthContext, movieId: string): Promise<(SceneRow & { shots: ShotRow[] })[]> {
    await this.require(auth, movieId);
    const { results: scenes } = await this.env.DB
      .prepare(`SELECT * FROM scenes WHERE movie_id = ? ORDER BY number`)
      .bind(movieId)
      .all<SceneRow>();

    const withShots = await Promise.all(
      scenes.map(async (scene) => {
        const { results: shots } = await this.env.DB
          .prepare(`SELECT * FROM shots WHERE scene_id = ? ORDER BY number`)
          .bind(scene.id)
          .all<ShotRow>();
        return { ...scene, shots };
      }),
    );
    return withShots;
  }

  async requireShot(auth: AuthContext, shotId: string): Promise<{ shot: ShotRow; scene: SceneRow; movie: MovieRow }> {
    const row = await this.env.DB
      .prepare(
        `SELECT s.*, sc.movie_id AS scene_movie_id FROM shots s
           JOIN scenes sc ON sc.id = s.scene_id
           JOIN movies m ON m.id = sc.movie_id
          WHERE s.id = ? AND m.org_id = ?`,
      )
      .bind(shotId, auth.orgId)
      .first<ShotRow & { scene_movie_id: string }>();
    if (!row) throw new AppError("not_found", "Shot not found.");

    const scene = await this.env.DB.prepare(`SELECT * FROM scenes WHERE id = ?`).bind(row.scene_id).first<SceneRow>();
    const movie = await this.require(auth, row.scene_movie_id);
    return { shot: row, scene: scene!, movie };
  }

  /** Deletes a movie and everything under it, in one transaction. */
  async remove(auth: AuthContext, movieId: string): Promise<void> {
    const movie = await this.require(auth, movieId);
    await runBatch(this.env.DB, [
      { sql: `DELETE FROM timeline_items WHERE track_id IN (SELECT id FROM timeline_tracks WHERE movie_id = ?)`, params: [movie.id] },
      { sql: `DELETE FROM timeline_tracks WHERE movie_id = ?`, params: [movie.id] },
      { sql: `DELETE FROM shots WHERE scene_id IN (SELECT id FROM scenes WHERE movie_id = ?)`, params: [movie.id] },
      { sql: `DELETE FROM scenes WHERE movie_id = ?`, params: [movie.id] },
      { sql: `UPDATE movies SET deleted_at = ? WHERE id = ?`, params: [nowIso(), movie.id] },
    ]);
  }

  private async defaultTextModel(): Promise<string> {
    const models = await new ModelService(this.env).list({ category: "text" });
    const recommended = models.find((m) => m.tags.includes("recommended")) ?? models[0];
    if (!recommended) {
      throw new AppError("model_not_enabled", "No text model is available to write the story.", {
        action: "Ask an administrator to enable one.",
      });
    }
    return recommended.id;
  }
}
