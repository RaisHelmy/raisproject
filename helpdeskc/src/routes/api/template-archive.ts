import { tenantDb } from "../../db/client";
import { NotFoundError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const archiveTemplate: RouteHandler = async (_request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "template.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.templates.get(params.id!);
  if (!existing) throw new NotFoundError("Template");

  await db.templates.archive(params.id!);
  return jsonResponse({ ok: true }, { status: 200 });
};
