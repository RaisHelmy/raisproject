import { tenantDb } from "../../db/client";
import { validateRoleDef, type TicketScope } from "../../core/authz/permissions";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const updateRole: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "role.manage");

  const { name, ticketScope, permissions } = (await request.json()) as { name?: string; ticketScope?: string; permissions?: string[] };
  const errors = validateRoleDef(name ?? "", ticketScope ?? "", permissions ?? []);
  if (errors.length > 0) throw new ValidationError(errors.join("; "));

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.roles.get(params.id!);
  if (!existing) throw new NotFoundError("Role");

  await db.roles.update(params.id!, { name: name!.trim(), ticketScope: ticketScope as TicketScope, permissions: JSON.stringify(permissions) });
  return jsonResponse({ ok: true }, { status: 200 });
};
