import type { PgD1 } from "./db";

export interface Env {
  /** Postgres (Cloudflare Hyperdrive) binding — see worker/db.ts. */
  HYPERDRIVE: Hyperdrive;
  /**
   * D1-shaped wrapper around the Hyperdrive/Postgres client. Not a real
   * binding — attached to `env` once per request/scheduled-invocation by
   * `worker/index.ts` (see `withDb`) so every call site written against the
   * D1 `prepare().bind().first()/.all()/.run()` surface keeps working
   * unchanged after the D1 -> Postgres migration.
   */
  DB: PgD1;
  FILES: R2Bucket;
  /** Cloudflare Email Service binding (available once a domain is onboarded). */
  EMAIL?: {
    send(message: {
      to: string;
      from: { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }): Promise<unknown>;
  };
  ASSETS: Fetcher;
  /** Shared secret for the Ubuntu-cron-triggered /internal/cron endpoint (replaces the Workers Cron Trigger). */
  CRON_SECRET: string;
  /**
   * HMAC secret shared with the saas.raishelmy.uk landing page for the
   * super-admin SSO handoff (GET /api/auth/sso). Set via `wrangler secret put`;
   * when absent the SSO endpoint answers 503 and never falls back.
   */
  SAAS_SSO_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  email_verified: number;
  created_at: string;
}

export interface EmailSettings {
  /** 'dev' logs emails and surfaces links in the UI; no external calls. */
  provider: "dev" | "cloudflare" | "resend";
  fromEmail: string;
  fromName: string;
  /** Resend only */
  apiKey?: string;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: "dev",
  fromEmail: "no-reply@example.com",
  fromName: "Rais Fintech",
};
