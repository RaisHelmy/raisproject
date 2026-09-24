import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { ProjectService, type ProjectRow } from "../services/project-service";

export const projects = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    coverAssetId: row.cover_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

projects.get("/projects", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read projects.");
  const service = new ProjectService(c.env);
  // A brand new account still sees one project rather than an empty screen (§75).
  await service.getOrCreateDefault(auth);
  return c.json({ items: (await service.list(auth)).map(toDTO) });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(["general", "movie"]).optional(),
});

projects.post("/projects", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot create projects.");
  const body = createSchema.parse(await c.req.json());
  return c.json(toDTO(await new ProjectService(c.env).create(auth, body)), 201);
});

projects.get("/projects/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:read")) throw new AppError("insufficient_scope", "This token cannot read projects.");
  return c.json(toDTO(await new ProjectService(c.env).require(auth, c.req.param("id"))));
});

projects.patch("/projects/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot edit projects.");
  const body = createSchema.partial().parse(await c.req.json());
  return c.json(toDTO(await new ProjectService(c.env).update(auth, c.req.param("id"), body)));
});

projects.delete("/projects/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "projects:write")) throw new AppError("insufficient_scope", "This token cannot delete projects.");
  await new ProjectService(c.env).softDelete(auth, c.req.param("id"));
  return c.body(null, 204);
});
