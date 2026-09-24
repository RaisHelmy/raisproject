import { tenantDb } from "../../db/client";
import { NotFoundError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const archiveRole: RouteHandler = async (_request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "role.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.roles.get(params.id!);
  if (!existing) throw new NotFoundError("Role");

  await db.roles.archive(params.id!);
  return jsonResponse({ ok: true }, { status: 200 });
};
