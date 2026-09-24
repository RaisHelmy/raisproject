import type { PgDatabase } from "./db/client";

export interface Env {
  /** Hyperdrive binding to the Postgres server; use `getDb(env)` to get a query client from it. */
  HYPERDRIVE: Hyperdrive;
  /**
   * Postgres-backed client, shaped like the old D1Database so the many
   * repositories/services written against `.prepare().bind().run()/.all()/.first()`
   * and `.batch()` did not all need to be rewritten. Attached per-request by
   * the `attachDb()` middleware in app.ts from `env.HYPERDRIVE`; not a real
   * Cloudflare binding, so it is optional on the Env type but always present
   * once that middleware has run.
   */
  DB: PgDatabase;
  ASSETS: R2Bucket;
  AI: Ai;
  WEB?: Fetcher;
  GENERATION_JOBS: Queue<unknown>;
  EVENTS: Queue<unknown>;
  RAIS_WORKFLOW_RUN?: Workflow;
  APP_ENV: "development" | "e2e" | "staging" | "production";
  AI_GATEWAY_ID: string;
  /** Optional: Cloudflare Images, used for thumbnails when the account has it. */
  IMAGES?: ImagesBinding;
  /** Optional: needed only for catalog sync, which uses the REST API rather than the AI binding. */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  /** secret: used to sign session cookies and CSRF tokens */
  SESSION_SECRET?: string;
  /** Encrypts connector secrets at rest. Falls back to SESSION_SECRET. */
  SECRETS_KEY?: string;
  /** Shared secret for the Ubuntu-cron-triggered /internal/cron endpoint (replaces the Workers Cron Trigger). */
  CRON_SECRET: string;
  /**
   * secret: HMAC key shared with the suite landing page (saas.raishelmy.uk)
   * for super-admin SSO via GET /api/v1/auth/sso. Unset → endpoint returns 503.
   */
  SAAS_SSO_SECRET?: string;
}
