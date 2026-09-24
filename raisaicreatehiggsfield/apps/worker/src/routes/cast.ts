import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { CastService, type CharacterRow, type LocationRow } from "../services/cast-service";
import { ProjectService } from "../services/project-service";

export const cast = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function characterDTO(row: CharacterRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    age: row.age,
    description: row.description,
    appearance: row.appearance,
    personality: row.personality,
    voice: JSON.parse(row.voice_json) as { modelId?: string; lang?: string; notes?: string },
    referenceAssetIds: JSON.parse(row.reference_asset_ids_json) as string[],
    updatedAt: row.updated_at,
  };
}

function locationDTO(row: LocationRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    style: row.style,
    lighting: row.lighting,
    referenceAssetIds: JSON.parse(row.reference_asset_ids_json) as string[],
    updatedAt: row.updated_at,
  };
}

const characterSchema = z.object({
  name: z.string().optional(),
  age: z.string().optional(),
  description: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  voice: z.object({ modelId: z.string().optional(), lang: z.string().optional(), notes: z.string().optional() }).optional(),
  referenceAssetIds: z.array(z.string()).max(8).optional(),
});

const locationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  style: z.string().optional(),
  lighting: z.string().optional(),
  referenceAssetIds: z.array(z.string()).max(8).optional(),
});

function assertRead(c: { get: (k: "auth") => AuthVariables["auth"] }) {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read projects.");
  return auth;
}

function assertWrite(c: { get: (k: "auth") => AuthVariables["auth"] }) {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit projects.");
  return auth;
}

cast.get("/projects/:projectId/characters", ...guarded, async (c) => {
  const auth = assertRead(c);
  await new ProjectService(c.env).require(auth, c.req.param("projectId"));
  const list = await new CastService(c.env).listCharacters(auth, c.req.param("projectId"));
  return c.json({ items: list.map(characterDTO) });
});

cast.post("/projects/:projectId/characters", ...guarded, async (c) => {
  const auth = assertWrite(c);
  await new ProjectService(c.env).require(auth, c.req.param("projectId"));
  const body = characterSchema.parse(await c.req.json());
  return c.json(characterDTO(await new CastService(c.env).createCharacter(auth, c.req.param("projectId"), body)), 201);
});

cast.patch("/characters/:id", ...guarded, async (c) => {
  const auth = assertWrite(c);
  const body = characterSchema.parse(await c.req.json());
  return c.json(characterDTO(await new CastService(c.env).updateCharacter(auth, c.req.param("id"), body)));
});

cast.delete("/characters/:id", ...guarded, async (c) => {
  const auth = assertWrite(c);
  await new CastService(c.env).deleteCharacter(auth, c.req.param("id"));
  return c.body(null, 204);
});

cast.get("/projects/:projectId/locations", ...guarded, async (c) => {
  const auth = assertRead(c);
  await new ProjectService(c.env).require(auth, c.req.param("projectId"));
  const list = await new CastService(c.env).listLocations(auth, c.req.param("projectId"));
  return c.json({ items: list.map(locationDTO) });
});

cast.post("/projects/:projectId/locations", ...guarded, async (c) => {
  const auth = assertWrite(c);
  await new ProjectService(c.env).require(auth, c.req.param("projectId"));
  const body = locationSchema.parse(await c.req.json());
  return c.json(locationDTO(await new CastService(c.env).createLocation(auth, c.req.param("projectId"), body)), 201);
});

cast.patch("/locations/:id", ...guarded, async (c) => {
  const auth = assertWrite(c);
  const body = locationSchema.parse(await c.req.json());
  return c.json(locationDTO(await new CastService(c.env).updateLocation(auth, c.req.param("id"), body)));
});

cast.delete("/locations/:id", ...guarded, async (c) => {
  const auth = assertWrite(c);
  await new CastService(c.env).deleteLocation(auth, c.req.param("id"));
  return c.body(null, 204);
});
