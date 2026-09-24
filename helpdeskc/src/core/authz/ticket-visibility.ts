import type { TicketScope } from "./permissions";

export interface AgentTicketVisibilityInput {
  scope: TicketScope;
  agentId: string;
  assigneeAgentId: string | null;
  ticketAccountId: string;
  visibleAccountIds: string[];
}

/** Pure scope check — mirrors the where fragment src/db/client.ts applies, so it can be unit tested without D1. */
export function canAgentViewTicket(input: AgentTicketVisibilityInput): boolean {
  switch (input.scope) {
    case "all":
      return true;
    case "team":
      return input.visibleAccountIds.includes(input.ticketAccountId);
    case "assigned":
      return input.assigneeAgentId === input.agentId;
    case "own":
      return false; // "own" for an agent means tickets they raised as a requester — agents don't raise tickets in this model
    case "none":
      return false;
  }
}

export interface ContactTicketVisibilityInput {
  contactAccountId: string;
  contactTeamId: string | null;
  accountScopedByTeam: boolean;
  ticketAccountId: string;
  ticketTeamId: string | null;
}

/** A Contact sees tickets for their own Account, narrowed to Team where configured (CLAUDE.md §8). */
export function canContactViewTicket(input: ContactTicketVisibilityInput): boolean {
  if (input.ticketAccountId !== input.contactAccountId) return false;
  if (input.accountScopedByTeam && input.ticketTeamId !== input.contactTeamId) return false;
  return true;
}
