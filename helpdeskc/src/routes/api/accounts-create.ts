import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const createAccount: RouteHandler = async (request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { name, scopeByTeam } = (await request.json()) as { name?: string; scopeByTeam?: boolean };
  if (!name || !name.trim()) throw new ValidationError("name is required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const id = uuidv7();
  await db.accounts.create({ id, name: name.trim(), scopeByTeam: Boolean(scopeByTeam), createdAt: new Date().toISOString(), deletedAt: null });

  return jsonResponse({ id }, { status: 201 });
};
