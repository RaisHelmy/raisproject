import { tenantDb } from "../../db/client";
import { NotFoundError, UnauthenticatedError } from "../../core/errors";
import type { TicketStatus } from "../../core/ticket/state";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import type { RouteHandler } from "../router";

export const listTickets: RouteHandler = async (request, env, _ctx, _params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") as TicketStatus | null) ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);

  if (authCtx.subjectType === "contact") {
    const contact = await db.contacts.get(authCtx.subjectId);
    if (!contact) throw new NotFoundError("Contact");
    const account = await db.accounts.get(contact.accountId);
    const tickets = await db.tickets.listForContact({
      accountId: contact.accountId,
      teamId: account?.scopeByTeam ? contact.teamId : null,
      status,
      cursor,
    });
    return jsonResponse({ tickets }, { status: 200 });
  }

  const visibleAccountIds =
    authCtx.ticketScope === "team" ? await db.agentTeamAssignments.listAccountIdsForAgent(authCtx.subjectId) : undefined;

  const tickets = await db.tickets.list({
    scope: authCtx.ticketScope ?? "none",
    viewerId: authCtx.subjectId,
    visibleAccountIds,
    status,
    cursor,
  });
  return jsonResponse({ tickets }, { status: 200 });
};
