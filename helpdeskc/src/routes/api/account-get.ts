import { tenantDb } from "../../db/client";
import { NotFoundError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const getAccount: RouteHandler = async (_request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const account = await db.accounts.get(params.id!);
  if (!account) throw new NotFoundError("Account");

  const [teams, contacts] = await Promise.all([db.teams.listForAccount(account.id), db.contacts.listForAccount(account.id)]);

  return jsonResponse({ account, teams, contacts }, { status: 200 });
};
