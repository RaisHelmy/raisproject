import type { TenantDb } from "../db/client";
import type { AuthContext } from "../core/authz";
import { canAgentViewTicket, canContactViewTicket } from "../core/authz/ticket-visibility";
import { ForbiddenError, NotFoundError } from "../core/errors";

/**
 * Shared visibility gate for every ticket-detail route (get, reply,
 * transition, attachments). One code path, so scope enforcement can't
 * drift between endpoints (CLAUDE.md §8: "Every permission check goes
 * through core/authz. One code path, tested.").
 */
export async function loadVisibleTicket(db: TenantDb, authCtx: AuthContext, ticketId: string) {
  const ticket = await db.tickets.get(ticketId);
  if (!ticket) throw new NotFoundError("Ticket");

  if (authCtx.subjectType === "contact") {
    const contact = await db.contacts.get(authCtx.subjectId);
    if (!contact) throw new NotFoundError("Contact");
    const account = await db.accounts.get(contact.accountId);
    const visible = canContactViewTicket({
      contactAccountId: contact.accountId,
      contactTeamId: contact.teamId,
      accountScopedByTeam: account?.scopeByTeam ?? false,
      ticketAccountId: ticket.accountId,
      ticketTeamId: ticket.teamId,
    });
    if (!visible) throw new ForbiddenError();
    return ticket;
  }

  const visibleAccountIds =
    authCtx.ticketScope === "team" ? await db.agentTeamAssignments.listAccountIdsForAgent(authCtx.subjectId) : [];
  const visible = canAgentViewTicket({
    scope: authCtx.ticketScope ?? "none",
    agentId: authCtx.subjectId,
    assigneeAgentId: ticket.assigneeAgentId,
    ticketAccountId: ticket.accountId,
    visibleAccountIds,
  });
  if (!visible) throw new ForbiddenError();
  return ticket;
}
