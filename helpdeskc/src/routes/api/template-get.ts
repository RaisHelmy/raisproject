import { tenantDb } from "../../db/client";
import { NotFoundError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const getTemplate: RouteHandler = async (_request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "template.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const template = await db.templates.get(params.id!);
  if (!template) throw new NotFoundError("Template");

  const versions = await db.templateVersions.listForTemplate(template.id);
  return jsonResponse(
    {
      template,
      versions: versions.map((v) => ({ ...v, fields: JSON.parse(v.fields), defaults: JSON.parse(v.defaults) })),
    },
    { status: 200 },
  );
};
