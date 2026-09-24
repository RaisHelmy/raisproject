import { tenantDb } from "../../db/client";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const updateAccount: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { name, scopeByTeam } = (await request.json()) as { name?: string; scopeByTeam?: boolean };
  if (name !== undefined && !name.trim()) throw new ValidationError("name cannot be empty");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.accounts.get(params.id!);
  if (!existing) throw new NotFoundError("Account");

  await db.accounts.update(params.id!, {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(scopeByTeam !== undefined ? { scopeByTeam } : {}),
  });

  return jsonResponse({ ok: true }, { status: 200 });
};
