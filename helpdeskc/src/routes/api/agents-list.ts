import { tenantDb } from "../../db/client";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const listAgents: RouteHandler = async (_request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "agent.manage");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const agents = await db.agents.list();
  const withRoles = await Promise.all(
    agents.map(async (a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      totpEnabled: a.totpEnabled,
      accepted: a.passwordHash !== null,
      roles: (await db.roles.listForAgent(a.id)).map((r) => ({ id: r.id, name: r.name })),
    })),
  );

  return jsonResponse({ agents: withRoles }, { status: 200 });
};
