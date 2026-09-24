import { tenantDb } from "../../db/client";
import { requirePermission } from "../../core/authz";
import { uuidv7 } from "../../core/id/uuid7";
import { reopenOnRequesterReply } from "../../core/ticket/state";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

export const createTicketMessage: RouteHandler = async (request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const { body, isInternalNote } = (await request.json()) as { body?: string; isInternalNote?: boolean };
  if (!body || !body.trim()) throw new ValidationError("body is required");

  if (authCtx.subjectType === "contact" && isInternalNote) {
    throw new ForbiddenError("Contacts cannot post internal notes");
  }
  if (authCtx.subjectType === "agent") {
    requirePermission(authCtx, isInternalNote ? "ticket.note.internal" : "ticket.reply");
  }

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const ticket = await loadVisibleTicket(db, authCtx, params.id!);

  const now = new Date().toISOString();
  const messageId = uuidv7();

  await db.ticketMessages.create({
    id: messageId,
    ticketId: ticket.id,
    authorType: authCtx.subjectType,
    authorId: authCtx.subjectId,
    body,
    isInternalNote: Boolean(isInternalNote),
    createdAt: now,
  });

  await db.ticketEvents.create({
    id: uuidv7(),
    ticketId: ticket.id,
    type: "message",
    actorType: authCtx.subjectType,
    actorId: authCtx.subjectId,
    data: JSON.stringify({ messageId, isInternalNote: Boolean(isInternalNote) }),
    createdAt: now,
  });

  // A requester reply reopens a resolved ticket (CLAUDE.md §10). Internal
  // notes and agent replies don't trigger this.
  if (authCtx.subjectType === "contact" && !isInternalNote) {
    const nextStatus = reopenOnRequesterReply(ticket.status);
    if (nextStatus !== ticket.status) {
      await db.tickets.update(ticket.id, { status: nextStatus, updatedAt: now, resolvedAt: null });
      await db.ticketEvents.create({
        id: uuidv7(),
        ticketId: ticket.id,
        type: "status_change",
        actorType: "system",
        actorId: null,
        data: JSON.stringify({ from: ticket.status, to: nextStatus, reason: "requester_reply" }),
        createdAt: now,
      });
    }
  }

  return jsonResponse({ id: messageId }, { status: 201 });
};
