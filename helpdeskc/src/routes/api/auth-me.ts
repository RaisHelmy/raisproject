import { tenantDb } from "../../db/client";
import { UnauthenticatedError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

export const getCurrentSession: RouteHandler = async (_request, env, _ctx, _params, data) => {
  if (!data.session) throw new UnauthenticatedError();

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  if (data.session.subjectType === "agent") {
    const agent = await db.agents.get(data.session.subjectId);
    if (!agent) throw new UnauthenticatedError();
    return jsonResponse({ subjectType: "agent", id: agent.id, name: agent.name, email: agent.email }, { status: 200 });
  }

  const contact = await db.contacts.get(data.session.subjectId);
  if (!contact) throw new UnauthenticatedError();
  return jsonResponse({ subjectType: "contact", id: contact.id, name: contact.name, email: contact.email }, { status: 200 });
};
