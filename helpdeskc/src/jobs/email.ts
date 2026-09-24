export type EmailJob =
  | { type: "magic_link"; tenantId: string; to: string; magicLinkUrl: string }
  | { type: "email_change_confirm"; tenantId: string; to: string; confirmUrl: string }
  | { type: "ticket_notification"; tenantId: string; to: string; ticketId: string; message: string }
  | { type: "agent_invite"; tenantId: string; to: string; inviteUrl: string };

/**
 * Bytes never pass through a Function synchronously for anything that talks
 * to a third party — queued so the request handler stays fast and the send
 * survives a retry (CLAUDE.md §3.4-3.5: no fire-and-forget promises after
 * the response for anything that must not be lost).
 */
export async function enqueueEmail(queue: Queue<EmailJob>, job: EmailJob): Promise<void> {
  await queue.send(job);
}
