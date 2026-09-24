import { DomainError } from "../errors";

export const TICKET_STATUSES = ["new", "open", "pending", "on_hold", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type TransitionActor = "agent" | "contact" | "system";

// Every legal edge in the lifecycle diagram in CLAUDE.md §10. Anything not
// listed here is illegal — `status` must never be set directly.
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ["open", "on_hold", "closed"],
  open: ["pending", "on_hold", "resolved", "closed"],
  pending: ["open", "on_hold", "resolved", "closed"],
  on_hold: ["open", "pending", "resolved", "closed"],
  resolved: ["open", "closed"], // requester reply reopens; auto-close job closes
  closed: ["open"], // reopened explicitly (e.g. by an agent) after auto-close
};

// pending/on_hold pause the SLA clock; open does not (CLAUDE.md §10).
export const SLA_PAUSING_STATUSES: ReadonlySet<TicketStatus> = new Set(["pending", "on_hold"]);

export class InvalidTransitionError extends DomainError {
  readonly code = "ticket.invalid_transition";
  readonly httpStatus = 422;
  constructor(readonly from: TicketStatus, readonly to: TicketStatus) {
    super(`Cannot transition ticket from '${from}' to '${to}'`);
  }
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface TransitionInput {
  from: TicketStatus;
  to: TicketStatus;
  actor: TransitionActor;
  now: string; // ISO-8601 UTC, injected so this stays pure and testable
  slaPausedAt: string | null;
  slaPausedTotalSeconds: number;
}

export interface TransitionResult {
  status: TicketStatus;
  /** undefined = leave the stored value unchanged */
  resolvedAt: string | null | undefined;
  closedAt: string | null | undefined;
  slaPausedAt: string | null;
  slaPausedTotalSeconds: number;
}

/** Pure state transition. Throws InvalidTransitionError on an illegal edge. */
export function applyTransition(input: TransitionInput): TransitionResult {
  const { from, to, now } = input;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }

  let slaPausedAt = input.slaPausedAt;
  let slaPausedTotalSeconds = input.slaPausedTotalSeconds;

  const wasPausing = SLA_PAUSING_STATUSES.has(from);
  const willPause = SLA_PAUSING_STATUSES.has(to);

  if (!wasPausing && willPause) {
    slaPausedAt = now;
  } else if (wasPausing && !willPause) {
    if (slaPausedAt) {
      const elapsedSeconds = Math.max(0, (Date.parse(now) - Date.parse(slaPausedAt)) / 1000);
      slaPausedTotalSeconds += elapsedSeconds;
    }
    slaPausedAt = null;
  }

  let resolvedAt: string | null | undefined = undefined;
  if (to === "resolved") resolvedAt = now;
  else if (from === "resolved" && to === "open") resolvedAt = null;

  return {
    status: to,
    resolvedAt,
    closedAt: to === "closed" ? now : undefined,
    slaPausedAt,
    slaPausedTotalSeconds,
  };
}

/** A requester reply on a resolved ticket reopens it (CLAUDE.md §10). */
export function reopenOnRequesterReply(status: TicketStatus): TicketStatus {
  return status === "resolved" ? "open" : status;
}

/** resolved auto-closes after `windowDays` with no further activity. */
export function isDueForAutoClose(resolvedAt: string, now: string, windowDays: number): boolean {
  const elapsedMs = Date.parse(now) - Date.parse(resolvedAt);
  return elapsedMs >= windowDays * 24 * 60 * 60 * 1000;
}
