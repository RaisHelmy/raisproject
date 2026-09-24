import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { TemplateService, type TemplateRow } from "../services/template-service";
import { ProjectService } from "../services/project-service";
import type { VariableDef } from "../engine/document";

export const templates = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: TemplateRow & { author_name?: string | null }, variables?: VariableDef[]) {
  return {
    id: row.id,
    authorName: row.author_name ?? null,
    previewUrl: row.preview_asset_id
      ? (row.visibility === "public" ? `/api/v1/public/templates/${row.id}/preview` : `/api/v1/assets/${row.preview_asset_id}/content`)
      : null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    tags: JSON.parse(row.tags_json) as string[],
    visibility: row.visibility,
    version: row.current_version,
    usageCount: row.usage_count,
    estimatedCostSen: row.estimated_cost_sen,
    previewAssetId: row.preview_asset_id,
    ...(variables ? { variables } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

templates.get("/templates", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:read")) throw new AppError("insufficient_scope", "This token cannot read templates.");
  const service = new TemplateService(c.env);
  const includePublic = c.req.query("scope") === "public";

  const [list, categories] = await Promise.all([
    service.list(auth, {
      includePublic,
      category: c.req.query("category"),
      search: c.req.query("q"),
      sort: c.req.query("sort") === "popular" ? "popular" : "recent",
    }),
    service.categories(auth),
  ]);
  return c.json({ items: list.map((t) => toDTO(t)), categories });
});

templates.put("/templates/:id/visibility", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:write")) throw new AppError("insufficient_scope", "This token cannot publish templates.");
  const { visibility } = z
    .object({ visibility: z.enum(["private", "unlisted", "public"]) })
    .parse(await c.req.json());
  return c.json(toDTO(await new TemplateService(c.env).setVisibility(auth, c.req.param("id"), visibility)));
});

templates.put("/templates/:id/preview", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:write")) throw new AppError("insufficient_scope", "This token cannot edit templates.");
  const { assetId } = z.object({ assetId: z.string().nullable() }).parse(await c.req.json());
  return c.json(toDTO(await new TemplateService(c.env).setPreview(auth, c.req.param("id"), assetId)));
});

templates.post("/templates/:id/duplicate", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:write")) throw new AppError("insufficient_scope", "This token cannot create templates.");
  const projectId = (await new ProjectService(c.env).getOrCreateDefault(auth)).id;
  return c.json(toDTO(await new TemplateService(c.env).duplicate(auth, c.req.param("id"), projectId)), 201);
});

templates.get("/templates/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:read")) throw new AppError("insufficient_scope", "This token cannot read templates.");
  const { template, variables, steps } = await new TemplateService(c.env).requireTemplate(auth, c.req.param("id"));
  return c.json({ ...toDTO(template, variables), steps, mine: template.org_id === auth.orgId });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
  projectId: z.string().optional(),
  doc: z.record(z.unknown()),
});

templates.post("/templates", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:write")) throw new AppError("insufficient_scope", "This token cannot create templates.");
  const body = createSchema.parse(await c.req.json());
  const projectId = body.projectId ?? (await new ProjectService(c.env).getOrCreateDefault(auth)).id;

  const { template, version } = await new TemplateService(c.env).create(auth, {
    name: body.name,
    description: body.description,
    category: body.category,
    tags: body.tags,
    visibility: body.visibility,
    projectId,
    doc: body.doc as never,
  });
  return c.json({ ...toDTO(template), publishedVersion: version.version }, 201);
});

templates.post("/templates/:id/versions", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:write")) throw new AppError("insufficient_scope", "This token cannot publish templates.");
  const body = z.object({ doc: z.record(z.unknown()), changelog: z.string().optional() }).parse(await c.req.json());
  const version = await new TemplateService(c.env).publishVersion(auth, c.req.param("id"), body.doc as never, body.changelog);
  return c.json({ version: version.version, id: version.id }, 201);
});

templates.post("/templates/:id/execute", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "templates:execute")) throw new AppError("insufficient_scope", "This token cannot run templates.");
  const body = z.object({
    variables: z.record(z.unknown()).default({}),
    projectId: z.string().optional(),
    versionId: z.string().optional(),
  }).parse(await c.req.json().catch(() => ({})));

  const projectId = body.projectId ?? (await new ProjectService(c.env).getOrCreateDefault(auth)).id;
  const run = await new TemplateService(c.env).execute(auth, c.req.param("id"), body.variables, {
    projectId,
    versionId: body.versionId,
  });

  return c.json(
    {
      workflowRunId: run.id,
      status: run.status,
      estimatedCostSen: run.estimatedCostSen,
      chargedSen: run.actualCostSen,
      outputs: run.outputs,
      ...(run.error ? { error: run.error } : {}),
    },
    201,
  );
});
