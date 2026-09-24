import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { NotFoundError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const assignAgentRole: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "agent.manage");

  const { roleId } = (await request.json()) as { roleId?: string };
  if (!roleId) throw new ValidationError("roleId is required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const [agent, role] = await Promise.all([db.agents.get(params.id!), db.roles.get(roleId)]);
  if (!agent) throw new NotFoundError("Agent");
  if (!role) throw new NotFoundError("Role");

  const existing = await db.memberships.listForAgent(agent.id);
  if (existing.some((m) => m.roleId === roleId)) {
    return jsonResponse({ ok: true }, { status: 200 });
  }

  await db.memberships.create({ id: uuidv7(), agentId: agent.id, roleId, createdAt: new Date().toISOString() });
  return jsonResponse({ ok: true }, { status: 201 });
};

export const removeAgentRole: RouteHandler = async (_request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "agent.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const agent = await db.agents.get(params.id!);
  if (!agent) throw new NotFoundError("Agent");

  await db.memberships.remove(agent.id, params.roleId!);
  return jsonResponse({ ok: true }, { status: 200 });
};
