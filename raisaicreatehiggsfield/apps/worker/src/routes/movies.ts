import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { rateLimit, DEFAULT_RULES } from "../middleware/rate-limit";
import { MovieService, type MovieRow, type SceneRow, type ShotRow } from "../services/movie-service";
import { ShotService, CINEMATIC_FIELDS } from "../services/shot-service";
import { MovieAudioService } from "../services/movie-audio-service";
import { TimelineService } from "../services/timeline-service";
import { ExportService } from "../services/export-service";

export const movies = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function movieDTO(row: MovieRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    logline: row.logline,
    synopsis: row.synopsis,
    idea: row.idea,
    style: JSON.parse(row.style_json) as Record<string, unknown>,
    status: row.status,
    targetDurationSeconds: row.target_duration_s,
    updatedAt: row.updated_at,
  };
}

function shotDTO(row: ShotRow) {
  return {
    id: row.id,
    number: row.number,
    shotType: row.shot_type,
    cameraMovement: row.camera_movement,
    description: row.description,
    durationSeconds: row.duration_s,
    imageAssetId: row.image_asset_id,
    videoAssetId: row.video_asset_id,
    status: row.status,
    costSen: row.cost_sen,
  };
}

function sceneDTO(row: SceneRow & { shots: ShotRow[] }) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    timeOfDay: row.time_of_day,
    characters: JSON.parse(row.characters_json) as string[],
    action: row.action,
    dialogue: JSON.parse(row.dialogue_json) as { character: string; line: string }[],
    durationSeconds: row.duration_s,
    shots: row.shots.map(shotDTO),
  };
}

movies.get("/movies", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read movies.");
  return c.json({ items: (await new MovieService(c.env).list(auth)).map(movieDTO) });
});

movies.post("/movies", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot create movies.");
  const body = z
    .object({
      title: z.string().min(1),
      idea: z.string().optional(),
      projectId: z.string().optional(),
      targetDurationSeconds: z.number().int().min(30).max(7200).optional(),
    })
    .parse(await c.req.json());
  return c.json(movieDTO(await new MovieService(c.env).create(auth, body)), 201);
});

movies.get("/movies/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read movies.");
  const service = new MovieService(c.env);
  const movie = await service.require(auth, c.req.param("id"));
  const scenes = await service.scenes(auth, movie.id);
  return c.json({ ...movieDTO(movie), scenes: scenes.map(sceneDTO) });
});

/** Writing a story runs a text model, so it is rate limited like a generation. */
movies.post("/movies/:id/story", ...guarded, rateLimit(DEFAULT_RULES.generations), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot generate.");
  const body = z.object({ modelId: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
  const result = await new MovieService(c.env).generateStory(auth, c.req.param("id"), { modelId: body.modelId });
  return c.json({ story: result.story, chargedSen: result.chargedSen, currency: "MYR" }, 201);
});

movies.post("/shots/:id/image", ...guarded, rateLimit(DEFAULT_RULES.generations), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot generate.");
  const body = z.object({ modelId: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
  return c.json(await new ShotService(c.env).generateImage(auth, c.req.param("id"), body), 201);
});

movies.post("/shots/:id/video", ...guarded, rateLimit(DEFAULT_RULES.generations), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot generate.");
  const body = z.object({ modelId: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
  return c.json(await new ShotService(c.env).generateVideo(auth, c.req.param("id"), body), 201);
});

movies.get("/shots/:id/estimate", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "models:read")) throw new AppError("insufficient_scope", "This token cannot read models.");
  const kind = c.req.query("kind") === "video" ? "video" : "image";
  return c.json({ ...(await new ShotService(c.env).estimate(auth, c.req.param("id"), kind)), currency: "MYR" });
});

movies.post("/movies/:id/dialogue", ...guarded, rateLimit(DEFAULT_RULES.generations), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot generate.");
  const body = z.object({ maxCostSen: z.number().int().positive().optional() }).parse(await c.req.json().catch(() => ({})));
  const result = await new MovieAudioService(c.env).generateDialogue(auth, c.req.param("id"), body);
  return c.json({ ...result, currency: "MYR" }, 201);
});

movies.post("/movies/:id/subtitles", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "generations:write")) throw new AppError("insufficient_scope", "This token cannot generate.");
  const format = c.req.query("format") === "vtt" ? "vtt" : "srt";
  return c.json(await new MovieAudioService(c.env).generateSubtitles(auth, c.req.param("id"), format), 201);
});

movies.get("/movies/:id/timeline", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read movies.");
  return c.json(await new TimelineService(c.env).get(auth, c.req.param("id")));
});

movies.post("/movies/:id/timeline", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  return c.json(await new TimelineService(c.env).build(auth, c.req.param("id")), 201);
});

movies.patch("/movies/:id/timeline/items/:itemId", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  const body = z
    .object({
      startMs: z.number().int().min(0).optional(),
      trimInMs: z.number().int().min(0).optional(),
      trimOutMs: z.number().int().min(0).optional(),
      volume: z.number().min(0).max(2).optional(),
      fadeInMs: z.number().int().min(0).optional(),
      fadeOutMs: z.number().int().min(0).optional(),
    })
    .parse(await c.req.json());

  const timeline = await new TimelineService(c.env).updateItem(auth, c.req.param("id"), c.req.param("itemId"), {
    ...(body.startMs !== undefined ? { start_ms: body.startMs } : {}),
    ...(body.trimInMs !== undefined ? { trim_in_ms: body.trimInMs } : {}),
    ...(body.trimOutMs !== undefined ? { trim_out_ms: body.trimOutMs } : {}),
    ...(body.volume !== undefined ? { volume: body.volume } : {}),
    ...(body.fadeInMs !== undefined ? { fade_in_ms: body.fadeInMs } : {}),
    ...(body.fadeOutMs !== undefined ? { fade_out_ms: body.fadeOutMs } : {}),
  });
  return c.json(timeline);
});

/** Cut, copy and move clips (§46). None of these generate anything. */
movies.post("/movies/:id/timeline/items/:itemId/split", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  const { atMs } = z.object({ atMs: z.number().int().min(0) }).parse(await c.req.json());
  return c.json(await new TimelineService(c.env).splitItem(auth, c.req.param("id"), c.req.param("itemId"), atMs));
});

movies.post("/movies/:id/timeline/items/:itemId/duplicate", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  return c.json(await new TimelineService(c.env).duplicateItem(auth, c.req.param("id"), c.req.param("itemId")));
});

movies.post("/movies/:id/timeline/items/:itemId/move", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  const body = z.object({ startMs: z.number().int().min(0).optional(), trackId: z.string().optional() }).parse(await c.req.json());
  return c.json(await new TimelineService(c.env).moveItem(auth, c.req.param("id"), c.req.param("itemId"), body));
});

movies.delete("/movies/:id/timeline/items/:itemId", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit movies.");
  const ripple = c.req.query("ripple") !== "false";
  return c.json(await new TimelineService(c.env).removeItem(auth, c.req.param("id"), c.req.param("itemId"), { ripple }));
});

movies.post("/movies/:id/export", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot export movies.");
  const baseUrl = new URL(c.req.url).origin;
  return c.json(await new ExportService(c.env).export(auth, c.req.param("id"), { baseUrl }), 201);
});

movies.delete("/movies/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot delete movies.");
  await new MovieService(c.env).remove(auth, c.req.param("id"));
  return c.body(null, 204);
});

/**
 * Editing a shot, and the takes it has produced (§38, §40, §41).
 *
 * A shot can be regenerated as often as someone likes; every take is kept, and
 * going back to an earlier one costs nothing.
 */
movies.patch("/shots/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot change shots.");
  const body = z
    .object({
      description: z.string().optional(),
      durationS: z.number().optional(),
      shotType: z.string().nullable().optional(),
      cameraMovement: z.string().nullable().optional(),
      cinematic: z.record(z.string().nullable()).optional(),
    })
    .parse(await c.req.json());
  const shot = await new ShotService(c.env).updateShot(auth, c.req.param("id"), body);
  return c.json({
    id: shot.id,
    description: shot.description,
    durationS: shot.duration_s,
    shotType: shot.shot_type,
    cameraMovement: shot.camera_movement,
    cinematic: JSON.parse(shot.cinematic_json) as Record<string, string>,
  });
});

movies.get("/shots/:id/takes", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read shots.");
  const { shot } = await new MovieService(c.env).requireShot(auth, c.req.param("id"));
  return c.json({
    items: await new ShotService(c.env).listTakes(auth, c.req.param("id")),
    // The current camera settings and the fields available travel with the
    // takes, so opening one shot is a single request.
    cinematic: JSON.parse(shot.cinematic_json) as Record<string, string>,
    cinematicFields: CINEMATIC_FIELDS,
  });
});

movies.post("/shots/:id/takes/:takeId/select", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot change shots.");
  return c.json(await new ShotService(c.env).selectTake(auth, c.req.param("id"), c.req.param("takeId")));
});
