import { tenantDb } from "../../db/client";
import { requirePermission } from "../../core/authz";
import { UnauthenticatedError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

export const getTicket: RouteHandler = async (_request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();
  if (authCtx.subjectType === "agent") requirePermission(authCtx, "ticket.read");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const ticket = await loadVisibleTicket(db, authCtx, params.id!);

  // Internal notes are filtered at the query layer, never in the view
  // (CLAUDE.md §5.4) — contacts never get isInternalNote rows.
  const messages = await db.ticketMessages.listForTicket(ticket.id, {
    includeInternalNotes: authCtx.subjectType === "agent",
  });
  const events = await db.ticketEvents.listForTicket(ticket.id);
  const attachments = await db.attachments.listForTicket(ticket.id);

  return jsonResponse({ ticket, messages, events, attachments }, { status: 200 });
};
