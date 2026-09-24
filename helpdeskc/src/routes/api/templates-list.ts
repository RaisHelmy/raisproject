import { tenantDb } from "../../db/client";
import { UnauthenticatedError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

/** Any authenticated session (agent or contact) can list active templates — needed to raise a ticket. */
export const listTemplates: RouteHandler = async (_request, env, _ctx, _params, data) => {
  if (!data.session) throw new UnauthenticatedError();

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const templates = await db.templates.listActive();
  const withVersions = await Promise.all(
    templates.map(async (t) => ({ template: t, version: await db.templateVersions.latest(t.id) })),
  );

  return jsonResponse(
    {
      templates: withVersions
        .filter((t) => t.version)
        .map((t) => ({
          id: t.template.id,
          name: t.template.name,
          description: t.template.description,
          fields: JSON.parse(t.version!.fields),
        })),
    },
    { status: 200 },
  );
};
