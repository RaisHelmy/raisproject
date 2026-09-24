import type { Env, EmailSettings } from "./types";
import { DEFAULT_EMAIL_SETTINGS } from "./types";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  provider: EmailSettings["provider"];
  /** set when provider is 'dev' (or a send failed) so the UI can surface links */
  devNote?: string;
  error?: string;
}

export async function getEmailSettings(env: Env): Promise<EmailSettings> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'email'").first<{
    value: string;
  }>();
  if (!row) return DEFAULT_EMAIL_SETTINGS;
  try {
    return { ...DEFAULT_EMAIL_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_EMAIL_SETTINGS;
  }
}

export async function saveEmailSettings(env: Env, settings: EmailSettings): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('email', ?, now())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(JSON.stringify(settings))
    .run();
}

/**
 * Send an email through whichever provider the admin has configured.
 * - 'cloudflare': Email Service Workers binding (domain must be onboarded).
 * - 'resend': HTTPS API using the stored API key.
 * - 'dev': no external call; the message is logged and surfaced to the UI.
 */
export async function sendEmail(env: Env, msg: OutgoingEmail): Promise<SendResult> {
  const settings = await getEmailSettings(env);

  if (settings.provider === "cloudflare") {
    if (!env.EMAIL) {
      return {
        ok: false,
        provider: "cloudflare",
        error:
          "Cloudflare Email Service binding is not available. Onboard a domain with `wrangler email sending enable <domain>` and deploy.",
      };
    }
    try {
      await env.EMAIL.send({
        to: msg.to,
        from: { email: settings.fromEmail, name: settings.fromName },
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      return { ok: true, provider: "cloudflare" };
    } catch (e) {
      return { ok: false, provider: "cloudflare", error: String(e) };
    }
  }

  if (settings.provider === "resend") {
    if (!settings.apiKey) {
      return { ok: false, provider: "resend", error: "Resend API key is not configured." };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${settings.fromName} <${settings.fromEmail}>`,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, provider: "resend", error: `Resend ${res.status}: ${body.slice(0, 300)}` };
      }
      return { ok: true, provider: "resend" };
    } catch (e) {
      return { ok: false, provider: "resend", error: String(e) };
    }
  }

  // dev mode — log and surface
  console.log(`[dev email] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
  return {
    ok: true,
    provider: "dev",
    devNote: "Email provider is in development mode — no email was actually sent.",
  };
}

export function verificationEmail(appUrl: string, token: string, name: string) {
  const url = `${appUrl}/verify?token=${token}`;
  return {
    subject: "Verify your email — Rais Fintech",
    text: `Assalamualaikum ${name},\n\nWelcome to Rais Fintech. Verify your email to secure your account:\n\n${url}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this message.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a2334">
        <h2 style="color:#8a6d1f;margin-bottom:4px">Rais Fintech</h2>
        <p>Assalamualaikum ${name},</p>
        <p>Welcome to Rais Fintech. Please verify your email address to secure your account.</p>
        <p style="margin:28px 0">
          <a href="${url}" style="background:#101623;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Verify email</a>
        </p>
        <p style="color:#7b869e;font-size:13px">This link expires in 24 hours. If you didn't create this account, you can ignore this message.</p>
      </div>`,
    url,
  };
}
