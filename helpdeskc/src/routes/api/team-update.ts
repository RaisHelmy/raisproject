import { tenantDb } from "../../db/client";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const updateTeam: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { name } = (await request.json()) as { name?: string };
  if (!name || !name.trim()) throw new ValidationError("name is required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.teams.get(params.id!);
  if (!existing) throw new NotFoundError("Team");

  await db.teams.update(params.id!, { name: name.trim() });
  return jsonResponse({ ok: true }, { status: 200 });
};
