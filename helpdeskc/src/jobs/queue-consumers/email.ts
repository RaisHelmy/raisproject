import type { EmailJob } from "../email";
import type { Env } from "../../routes/env";

// The `from` domain must be onboarded via `wrangler email sending enable`
// once a real domain is registered (still a placeholder — CLAUDE.md §6).
const FROM = { email: "noreply@helpdesk.example", name: "HelpdeskC" };

function renderEmail(job: EmailJob): { subject: string; html: string; text: string } {
  switch (job.type) {
    case "magic_link":
      return {
        subject: "Your sign-in link",
        html: `<p>Click to sign in: <a href="${job.magicLinkUrl}">${job.magicLinkUrl}</a></p><p>This link expires in 15 minutes and can only be used once.</p>`,
        text: `Sign in: ${job.magicLinkUrl}\n\nThis link expires in 15 minutes and can only be used once.`,
      };
    case "email_change_confirm":
      return {
        subject: "Confirm your new email address",
        html: `<p>Confirm your new email: <a href="${job.confirmUrl}">${job.confirmUrl}</a></p>`,
        text: `Confirm your new email: ${job.confirmUrl}`,
      };
    case "ticket_notification":
      return {
        subject: `Update on ticket ${job.ticketId}`,
        html: `<p>${job.message}</p>`,
        text: job.message,
      };
    case "agent_invite":
      return {
        subject: "You've been invited to HelpdeskC",
        html: `<p>Set your password to get started: <a href="${job.inviteUrl}">${job.inviteUrl}</a></p>`,
        text: `Set your password to get started: ${job.inviteUrl}`,
      };
  }
}

export async function handleEmailQueue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;
    const { subject, html, text } = renderEmail(job);
    try {
      await env.EMAIL.send({ to: job.to, from: FROM, subject, html, text });
      message.ack();
    } catch (err) {
      console.error("email send failed", job.type, err);
      message.retry();
    }
  }
}
