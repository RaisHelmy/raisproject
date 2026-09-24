import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { requireAdmin } from "../middleware/admin";
import { AssetService, FEATURED_TAG, type AssetRow } from "../services/asset-service";
import { ProjectService } from "../services/project-service";

export const assets = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: AssetRow) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    version: row.current_version,
    projectId: row.project_id,
    generationId: row.generation_id,
    url: `/api/v1/assets/${row.id}/content`,
    tags: (JSON.parse(row.tags_json) as string[]).filter((t) => !t.includes(":")),
    featured: (JSON.parse(row.tags_json) as string[]).includes(FEATURED_TAG),
    createdAt: row.created_at,
  };
}

assets.get("/assets", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "assets:read")) throw new AppError("insufficient_scope", "This token cannot read assets.");
  const { items, nextCursor } = await new AssetService(c.env).list(auth, {
    projectId: c.req.query("projectId"),
    kind: c.req.query("kind") as AssetRow["kind"] | undefined,
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    cursor: c.req.query("cursor"),
  });
  return c.json({ items: items.map(toDTO), nextCursor });
});

assets.get("/assets/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "assets:read")) throw new AppError("insufficient_scope", "This token cannot read assets.");
  return c.json(toDTO(await new AssetService(c.env).require(auth, c.req.param("id"))));
});

/** Streams the bytes. Ownership is checked before anything is read from R2. */
assets.get("/assets/:id/content", requireAuth(), async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "assets:read")) throw new AppError("insufficient_scope", "This token cannot read assets.");
  const service = new AssetService(c.env);
  const versionParam = c.req.query("version");
  const version = await service.getVersion(auth, c.req.param("id"), versionParam ? Number(versionParam) : undefined);

  const object = await c.env.ASSETS.get(version.r2_key);
  if (!object) throw new AppError("not_found", "The stored file is missing.");
  return new Response(object.body, {
    headers: {
      "content-type": version.mime,
      "cache-control": "private, max-age=31536000, immutable",
      "content-length": String(version.size_bytes),
    },
  });
});

assets.post("/assets", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "assets:write")) throw new AppError("insufficient_scope", "This token cannot upload assets.");
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("invalid_input", "Attach a file to upload.");

  const projectId = String(form.get("projectId") ?? "") || (await new ProjectService(c.env).getOrCreateDefault(auth)).id;
  const asset = await new AssetService(c.env).create(auth, {
    projectId,
    name: file.name || "upload",
    mime: file.type || "application/octet-stream",
    bytes: await file.arrayBuffer(),
    source: "upload",
  });
  return c.json(toDTO(asset), 201);
});

/**
 * Puts an asset on the public landing page, or takes it off. Admin only:
 * this publishes a customer's output, which is not the customer's call to
 * make on their own behalf through a general-purpose flag.
 */
assets.put("/assets/:id/feature", ...guarded, requireAdmin(), async (c) => {
  const auth = c.get("auth");
  const body = z.object({
    featured: z.boolean(),
    prompt: z.string().max(300).optional(),
    studio: z.string().max(40).optional(),
  }).parse(await c.req.json());
  const service = new AssetService(c.env);
  await service.setFeatured(c.req.param("id"), body.featured, { prompt: body.prompt, studio: body.studio });
  const asset = await service.findById(auth, c.req.param("id"));
  return c.json(asset ? toDTO(asset) : { id: c.req.param("id"), featured: body.featured });
});

assets.delete("/assets/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "assets:write")) throw new AppError("insufficient_scope", "This token cannot delete assets.");
  await new AssetService(c.env).softDelete(auth, c.req.param("id"));
  return c.body(null, 204);
});
