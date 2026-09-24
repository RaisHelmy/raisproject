import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { validateRoleDef, type TicketScope } from "../../core/authz/permissions";
import { ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const createRole: RouteHandler = async (request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "role.manage");

  const { name, ticketScope, permissions } = (await request.json()) as { name?: string; ticketScope?: string; permissions?: string[] };
  const errors = validateRoleDef(name ?? "", ticketScope ?? "", permissions ?? []);
  if (errors.length > 0) throw new ValidationError(errors.join("; "));

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const id = uuidv7();
  await db.roles.create({
    id,
    name: name!.trim(),
    ticketScope: ticketScope as TicketScope,
    permissions: JSON.stringify(permissions),
    isPreset: false,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  });

  return jsonResponse({ id }, { status: 201 });
};
