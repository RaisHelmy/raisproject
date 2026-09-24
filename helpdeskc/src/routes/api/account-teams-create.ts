import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const createTeam: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { name } = (await request.json()) as { name?: string };
  if (!name || !name.trim()) throw new ValidationError("name is required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const account = await db.accounts.get(params.id!);
  if (!account) throw new NotFoundError("Account");

  const id = uuidv7();
  await db.teams.create({ id, accountId: account.id, name: name.trim(), createdAt: new Date().toISOString(), deletedAt: null });

  return jsonResponse({ id }, { status: 201 });
};
