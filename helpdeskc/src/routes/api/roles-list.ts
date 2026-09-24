import { tenantDb } from "../../db/client";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const listRoles: RouteHandler = async (_request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "role.manage");
  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const roles = await db.roles.list();
  return jsonResponse({ roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })) }, { status: 200 });
};
