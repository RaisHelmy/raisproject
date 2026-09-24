import { AppError, newId, type AuthContext, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { MovieService, type MovieRow } from "./movie-service";
import { GenerationService } from "./generation-service";
import { ModelService } from "./model-service";
import { cuesFromText, toSrt, toVtt, type Cue } from "../engine/nodes/media";
import { AssetService } from "./asset-service";
import type { AIProvider } from "../providers/types";

export interface DialogueLine {
  character: string;
  line: string;
}

export interface VoicedLine {
  sceneId: string;
  sceneNumber: number;
  character: string;
  line: string;
  assetId: string | null;
  chargedSen: Sen;
  error?: string;
}

/**
 * Voice for a movie's dialogue (§43, §44).
 *
 * Each character carries its own voice configuration, so the same character
 * sounds the same in every scene. Lines are generated per line rather than per
 * scene, which is what allows one line to be redone without repaying for the
 * rest.
 */
export class MovieAudioService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  async setVoice(auth: AuthContext, characterId: string, voice: { modelId?: string; lang?: string; notes?: string }): Promise<void> {
    const character = await this.env.DB
      .prepare(`SELECT id FROM characters WHERE id = ? AND org_id = ?`)
      .bind(characterId, auth.orgId)
      .first<{ id: string }>();
    if (!character) throw new AppError("not_found", "Character not found.");

    await this.env.DB
      .prepare(`UPDATE characters SET voice_json = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(voice), nowIso(), characterId)
      .run();
  }

  /** Generates every unvoiced line in a movie, stopping at a budget if given. */
  async generateDialogue(
    auth: AuthContext,
    movieId: string,
    options: { maxCostSen?: Sen; provider?: AIProvider } = {},
  ): Promise<{ lines: VoicedLine[]; totalChargedSen: Sen }> {
    const movies = new MovieService(this.env);
    const movie = await movies.require(auth, movieId);
    const scenes = await movies.scenes(auth, movieId);

    const voices = await this.voicesByCharacter(movie);
    const generations = new GenerationService(this.env);
    const lines: VoicedLine[] = [];
    let totalChargedSen = 0;

    for (const scene of scenes) {
      const dialogue = JSON.parse(scene.dialogue_json) as DialogueLine[];
      for (const entry of dialogue) {
        if (!entry.line.trim()) continue;

        // The budget is checked before each line, so a long script stops rather
        // than overshooting (§139).
        if (options.maxCostSen !== undefined && totalChargedSen >= options.maxCostSen) break;

        const voice = voices.get(entry.character);
        const modelId = voice?.modelId ?? (await this.defaultVoiceModel());

        try {
          const result = await generations.create(auth, {
            modelId,
            prompt: entry.line,
            projectId: movie.project_id,
            parameters: voice?.lang ? { lang: voice.lang } : {},
            provider: options.provider,
          });
          const asset = result.outputs.audio as { assetId: string } | undefined;
          const chargedSen = result.generation.actual_cost_sen ?? 0;
          totalChargedSen += chargedSen;

          lines.push({
            sceneId: scene.id, sceneNumber: scene.number, character: entry.character,
            line: entry.line, assetId: asset?.assetId ?? null, chargedSen,
            ...(result.generation.status !== "completed"
              ? { error: result.generation.error_message ?? "The line could not be voiced." }
              : {}),
          });
        } catch (error) {
          // One line failing must not lose the ones already recorded.
          lines.push({
            sceneId: scene.id, sceneNumber: scene.number, character: entry.character,
            line: entry.line, assetId: null, chargedSen: 0,
            error: error instanceof AppError ? error.message : "The line could not be voiced.",
          });
        }
      }
    }

    await this.env.DB
      .prepare(`UPDATE movies SET status='audio', updated_at=? WHERE id=?`)
      .bind(nowIso(), movieId)
      .run();

    return { lines, totalChargedSen };
  }

  /**
   * Subtitles for the whole movie, timed from each shot's duration so they line
   * up with the cut rather than with an assumed reading speed (§45).
   */
  async generateSubtitles(auth: AuthContext, movieId: string, format: "srt" | "vtt" = "srt"): Promise<{ assetId: string; content: string }> {
    const movies = new MovieService(this.env);
    const movie = await movies.require(auth, movieId);
    const scenes = await movies.scenes(auth, movieId);

    const cues: Cue[] = [];
    let cursor = 0;

    for (const scene of scenes) {
      const dialogue = JSON.parse(scene.dialogue_json) as DialogueLine[];
      const sceneDuration = scene.shots.reduce((sum, shot) => sum + shot.duration_s, 0);

      if (dialogue.length === 0) {
        cursor += sceneDuration;
        continue;
      }
      // Dialogue is spread across the scene it belongs to, so a subtitle never
      // runs past its own cut.
      const perLine = sceneDuration / dialogue.length;
      for (const entry of dialogue) {
        cues.push({ start: cursor, end: cursor + perLine, text: `${entry.character}: ${entry.line}` });
        cursor += perLine;
      }
    }

    if (cues.length === 0) {
      throw new AppError("invalid_input", "This movie has no dialogue to subtitle.", {
        action: "Add dialogue to a scene first.",
      });
    }

    const content = format === "vtt" ? toVtt(cues) : toSrt(cues);
    const asset = await new AssetService(this.env).create(auth, {
      projectId: movie.project_id,
      name: `${movie.title}.${format}`,
      mime: format === "vtt" ? "text/vtt" : "application/x-subrip",
      bytes: new TextEncoder().encode(content).buffer as ArrayBuffer,
      source: "generation",
    });
    return { assetId: asset.id, content };
  }

  private async voicesByCharacter(movie: MovieRow): Promise<Map<string, { modelId?: string; lang?: string }>> {
    const { results } = await this.env.DB
      .prepare(`SELECT name, voice_json FROM characters WHERE project_id = ?`)
      .bind(movie.project_id)
      .all<{ name: string; voice_json: string }>();
    return new Map(results.map((r) => [r.name, JSON.parse(r.voice_json) as { modelId?: string; lang?: string }]));
  }

  private async defaultVoiceModel(): Promise<string> {
    const models = await new ModelService(this.env).findCompatible(["text-to-speech"]);
    if (models.length === 0) {
      throw new AppError("model_not_enabled", "No voice model is available.", {
        action: "Ask an administrator to enable a text-to-speech model.",
      });
    }
    return models[0]!.id;
  }
}

export { cuesFromText };
