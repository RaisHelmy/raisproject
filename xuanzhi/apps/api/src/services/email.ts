import type { AppContext } from "./context";

export interface EmailMessage { to: string; subject: string; html: string; text: string }
export interface IEmailSender { readonly configured: boolean; send(msg: EmailMessage): Promise<void> }

/** Resend HTTP API (https://resend.com). */
class ResendSender implements IEmailSender {
  readonly configured = true;
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(m: EmailMessage) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }) });
    if (!r.ok) throw new Error(`Email send failed (${r.status})`);
  }
}
/** No provider configured: log the message (links included) so developers can pick them up from `wrangler tail`. */
class ConsoleSender implements IEmailSender {
  readonly configured = false;
  constructor(private readonly ctx: AppContext) {}
  async send(m: EmailMessage) { this.ctx.log.info("email_not_configured", { to_domain: m.to.split("@")[1], subject: m.subject, body_preview: m.text.slice(0, 400) }); }
}
export function emailSender(ctx: AppContext): IEmailSender {
  return ctx.env.RESEND_API_KEY ? new ResendSender(ctx.env.RESEND_API_KEY, ctx.env.EMAIL_FROM ?? "XuanZhi AI <no-reply@example.com>") : new ConsoleSender(ctx);
}
export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Georgia,serif;background:#f6f1e7;padding:32px"><div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e6dcc8;border-radius:12px;padding:32px;color:#2b2622">
<div style="font-size:22px;font-weight:600;margin-bottom:4px">玄知 AI <span style="font-size:13px;color:#8a7d6a;font-weight:400">XuanZhi AI</span></div><div style="font-size:12px;color:#8a7d6a;margin-bottom:24px">Ancient Wisdom. Intelligent Guidance.</div>
<h2 style="font-size:18px;margin:0 0 12px">${title}</h2>${bodyHtml}<p style="font-size:12px;color:#8a7d6a;margin-top:24px">If you did not request this, you can safely ignore this email.</p></div></body></html>`;
}
