import type { Role } from "../shared/types";
import type { AppDatabase } from "./lib/db";

export interface Bindings {
  /**
   * Postgres (via Hyperdrive) behind a minimal D1-shaped interface — see
   * api/lib/db.ts. Not a real Cloudflare binding: in production it's derived
   * from the `HYPERDRIVE` binding (functions/api/[[route]].ts), in tests it's
   * a bun:sqlite shim (tests/helpers/d1-shim.ts).
   */
  DB: AppDatabase;
  /** Real Cloudflare binding — Hyperdrive config pointing at the shared `raishelmy` Postgres database (this app's tables live in schema `raisrms`). */
  HYPERDRIVE: Hyperdrive;
  BUCKET: R2Bucket;
  APP_ENV: string;
  JWT_SECRET: string;
  /** Public base URL of the deployed app, used to build guest-facing links in notifications. */
  PUBLIC_APP_URL?: string;
  /** Shared secret required on the /api/cron/* endpoints (reminders, campaign triggers). */
  CRON_SECRET?: string;
  /** Optional — email sending no-ops (logs only) until this is set. */
  RESEND_API_KEY?: string;
  NOTIFY_FROM_EMAIL?: string;
  /** Optional — Stripe deposit/payment endpoints return 501 until this is set. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /**
   * Shared HMAC secret for the suite-wide super-admin SSO handshake
   * (GET /api/auth/sso). Set via `wrangler pages secret put`; the endpoint
   * returns 503 when it is unset. Never committed.
   */
  SAAS_SSO_SECRET?: string;
}

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  roles: Record<string, Role>; // outletId -> role
  isSuperadmin?: boolean;
}

export interface Variables {
  requestId: string;
  tenantId: string;
  auth: AuthContext;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
