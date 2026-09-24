import { newId, now } from "./ids";
import type { Bindings } from "../types";
import type { AppDatabase } from "./db";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  kind: string;
  referenceId?: string;
}

/**
 * Sends transactional/marketing email via the Resend HTTP API (Workers-compatible,
 * no SDK). Degrades gracefully to a logged no-op when RESEND_API_KEY isn't set, so
 * local/dev/test environments never crash on a missing provider — every send is
 * still recorded in notification_log for auditability and reminder idempotency.
 */
export async function sendEmail(
  db: AppDatabase,
  env: Pick<Bindings, "RESEND_API_KEY" | "NOTIFY_FROM_EMAIL">,
  tenantId: string,
  input: SendEmailInput,
): Promise<{ sent: boolean }> {
  let status: "sent" | "failed" | "skipped_no_provider" = "skipped_no_provider";
  let error: string | undefined;

  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.NOTIFY_FROM_EMAIL ?? "Rais RMS <notifications@rais.app>",
          to: input.to,
          subject: input.subject,
          html: input.html,
        }),
      });
      if (!res.ok) {
        status = "failed";
        error = `Resend ${res.status}: ${await res.text().catch(() => "")}`;
      } else {
        status = "sent";
      }
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
  } else {
    console.warn(`[notify] RESEND_API_KEY not set — skipping email to ${input.to} (${input.kind})`);
  }

  await db
    .prepare(
      `INSERT INTO notification_log (id, tenant_id, channel, kind, to_address, reference_id, status, error, created_at)
       VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), tenantId, input.kind, input.to, input.referenceId ?? null, status, error ?? null, now())
    .run();

  return { sent: status === "sent" };
}

/** True if this (tenant, kind, referenceId) notification has already been sent — for idempotent reminders/triggers. */
export async function alreadyNotified(
  db: AppDatabase,
  tenantId: string,
  kind: string,
  referenceId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM notification_log WHERE tenant_id = ? AND kind = ? AND reference_id = ? AND status != 'failed' LIMIT 1`,
    )
    .bind(tenantId, kind, referenceId)
    .first();
  return !!row;
}

export function reservationConfirmationEmail(input: {
  outletName: string;
  guestName: string;
  startsAt: number;
  partySize: number;
  manageUrl: string;
}): { subject: string; html: string } {
  const when = new Date(input.startsAt).toLocaleString();
  return {
    subject: `Your reservation at ${input.outletName} — ${when}`,
    html: `<p>Hi ${input.guestName},</p>
      <p>You're booked at <strong>${input.outletName}</strong> for <strong>${input.partySize}</strong> guests on <strong>${when}</strong>.</p>
      <p><a href="${input.manageUrl}">View, reschedule, or cancel your reservation</a></p>
      <p>See you soon!</p>`,
  };
}

export function reservationReminderEmail(input: {
  outletName: string;
  guestName: string;
  startsAt: number;
  partySize: number;
  manageUrl: string;
}): { subject: string; html: string } {
  const when = new Date(input.startsAt).toLocaleString();
  return {
    subject: `Reminder: your reservation at ${input.outletName} today`,
    html: `<p>Hi ${input.guestName},</p>
      <p>Just a reminder — we're expecting you at <strong>${input.outletName}</strong> for <strong>${input.partySize}</strong> guests on <strong>${when}</strong>.</p>
      <p><a href="${input.manageUrl}">Need to change or cancel?</a></p>`,
  };
}

export function feedbackRequestEmail(input: {
  outletName: string;
  guestName: string;
  feedbackUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `How was your visit to ${input.outletName}?`,
    html: `<p>Hi ${input.guestName},</p>
      <p>Thanks for dining with us at <strong>${input.outletName}</strong>. We'd love your feedback.</p>
      <p><a href="${input.feedbackUrl}">Leave feedback (2 minutes)</a></p>`,
  };
}
