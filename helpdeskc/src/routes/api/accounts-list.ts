import { tenantDb } from "../../db/client";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const listAccounts: RouteHandler = async (_request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "account.manage");
  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const accounts = await db.accounts.list();
  return jsonResponse({ accounts }, { status: 200 });
};
