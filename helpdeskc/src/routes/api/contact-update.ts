import { tenantDb } from "../../db/client";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

/** Agent-side profile edit. Never touches email — that's an access-control change, handled by a dedicated flow (CLAUDE.md §7). */
export const updateContact: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { name, teamId } = (await request.json()) as { name?: string; teamId?: string | null };
  if (name !== undefined && !name.trim()) throw new ValidationError("name cannot be empty");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.contacts.get(params.id!);
  if (!existing) throw new NotFoundError("Contact");

  if (teamId) {
    const team = await db.teams.get(teamId);
    if (!team || team.accountId !== existing.accountId) throw new ValidationError("teamId does not belong to this contact's account");
  }

  await db.contacts.update(params.id!, {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
  });

  return jsonResponse({ ok: true }, { status: 200 });
};
