import type { EmailJob } from "../jobs/email";
import type { TicketSequence } from "../durable-objects/ticket-sequence";

export interface Env {
  /** Postgres via Hyperdrive (migrated off D1 — see CLAUDE.md §4). `HYPERDRIVE.connectionString` feeds postgres.js in src/db/client.ts / platform-client.ts. */
  HYPERDRIVE: Hyperdrive;
  KV: KVNamespace;
  ATTACHMENTS: R2Bucket;
  JOBS: Queue<EmailJob>;
  EMAIL: SendEmail;
  TICKET_SEQUENCE: DurableObjectNamespace<TicketSequence>;
  /** The built React app's static assets (CLAUDE.md §13) — wrangler.jsonc `assets` binding. */
  ASSETS: Fetcher;
  ENVIRONMENT?: string;

  // Secrets (wrangler secret put) — used only to sign R2 presigned URLs
  // (CLAUDE.md §11). The R2Bucket binding above has no presign API of its
  // own; presigning requires the S3-compatible API and its own credential
  // pair, scoped to this bucket only.
  CF_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;

  /** Shared secret for the Ubuntu-cron-triggered /internal/cron endpoint (replaces the Workers Cron Trigger). */
  CRON_SECRET: string;

  /**
   * HMAC key shared with the saas.raishelmy.uk landing page for super-admin
   * SSO (GET /api/auth/sso). Optional so the route can answer 503 when it is
   * not configured instead of falling back to an unsigned path.
   */
  SAAS_SSO_SECRET?: string;
}

/** Resolved once per request in resolveRequestData() (src/routes/index.ts) and passed to every route handler. */
export interface RequestData {
  hostname: string;
  tenantId: string;
  tenant: {
    id: string;
    slug: string;
    billingState: "trial" | "active" | "past_due" | "suspended" | "cancelled";
  };
  session: {
    id: string;
    subjectType: "agent" | "contact";
    subjectId: string;
  } | null;
}
