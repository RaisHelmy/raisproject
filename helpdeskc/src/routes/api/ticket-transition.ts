import { tenantDb } from "../../db/client";
import { requirePermission } from "../../core/authz";
import { applyTransition, TICKET_STATUSES, type TicketStatus } from "../../core/ticket/state";
import { uuidv7 } from "../../core/id/uuid7";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

export const transitionTicket: RouteHandler = async (request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();
  if (authCtx.subjectType !== "agent") throw new ForbiddenError("Only agents can transition a ticket directly");
  requirePermission(authCtx, "ticket.transition");

  const { to } = (await request.json()) as { to?: string };
  if (!to || !TICKET_STATUSES.includes(to as TicketStatus)) throw new ValidationError("Invalid target status");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const ticket = await loadVisibleTicket(db, authCtx, params.id!);

  const now = new Date().toISOString();
  // core/ticket/state.ts is the only place `status` is ever set — never
  // written directly (CLAUDE.md §10). Throws InvalidTransitionError on an
  // illegal edge, mapped to HTTP by the shared error handler.
  const result = applyTransition({
    from: ticket.status,
    to: to as TicketStatus,
    actor: "agent",
    now,
    slaPausedAt: ticket.slaPausedAt,
    slaPausedTotalSeconds: ticket.slaPausedTotalSeconds,
  });

  await db.tickets.update(ticket.id, {
    status: result.status,
    updatedAt: now,
    ...(result.resolvedAt !== undefined ? { resolvedAt: result.resolvedAt } : {}),
    ...(result.closedAt !== undefined ? { closedAt: result.closedAt } : {}),
    slaPausedAt: result.slaPausedAt,
    slaPausedTotalSeconds: result.slaPausedTotalSeconds,
  });

  await db.ticketEvents.create({
    id: uuidv7(),
    ticketId: ticket.id,
    type: "status_change",
    actorType: "agent",
    actorId: authCtx.subjectId,
    data: JSON.stringify({ from: ticket.status, to: result.status }),
    createdAt: now,
  });

  return jsonResponse({ status: result.status }, { status: 200 });
};
