import type { Session } from "./auth/session";

declare global {
  interface Env {
    /** Shared secret for the Ubuntu-cron-triggered /internal/cron/:job endpoint (replaces the Workers Cron Trigger). */
    CRON_SECRET: string;
    /**
     * Shared HMAC secret for the suite landing page's super-admin SSO
     * (GET /api/auth/sso). Set with `wrangler secret put SAAS_SSO_SECRET`;
     * never committed. Endpoint returns 503 when unset.
     */
    SAAS_SSO_SECRET?: string;
  }
}

export interface AppVariables {
  requestId: string;
  session: Session | null;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
