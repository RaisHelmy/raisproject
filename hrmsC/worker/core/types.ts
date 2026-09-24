// Cross-cutting types referenced by more than one domain module. Anything
// specific to a single domain (Employee, LeaveApplication, Claim, ...)
// belongs in that module's own types.ts instead.

import type { Db } from "./db";

export type Role = "admin" | "hr" | "manager" | "employee";
export type ApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Bindings = {
  /** Real Cloudflare binding — the account's single Hyperdrive config
   * (`raishelmy-hyperdrive`), pointing at the shared `raishelmy` Postgres
   * database. This app's tables live isolated in the `hrmsc` schema there
   * (see `getDb()` in `./db.ts`, which sets `search_path`), not a dedicated
   * database. Only `.connectionString` is used; the runtime resolves the
   * private VPC host/port for us. */
  HYPERDRIVE: Hyperdrive;
  /** NOT a wrangler binding — a `postgres.js` client constructed once per
   * isolate from `HYPERDRIVE.connectionString` and injected onto `env` by
   * `functions/api/[[route]].ts` before calling into Hono. Kept as `DB` on
   * `Bindings` (rather than threaded through Hono's `Variables`) so every
   * existing `c.env.DB` call site across `worker/modules/**` — all of which
   * already went through the `queryAll`/`queryOne`/`exec` helpers in
   * `worker/core/db.ts`, never `D1Database`'s raw `.prepare()` API directly
   * — needed no changes beyond `worker/core/db.ts` itself. */
  DB: Db;
  ATTACHMENTS: R2Bucket;
  JWT_SECRET: string;
  /** Shared HMAC secret for the suite-wide super-admin SSO
   * (`GET /api/auth/sso`, see `worker/modules/auth/sso.ts`). Set only via
   * `wrangler pages secret put SAAS_SSO_SECRET` — never in `wrangler.jsonc`.
   * Absent locally, in which case the endpoint answers 503. */
  SAAS_SSO_SECRET?: string;
};

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
  email: string;
  name: string;
  /** Set only while an admin is impersonating this account (Account
   * Simulator) — the real admin's user id/name, so every layer (UI, audit
   * trail context) can tell a simulated session apart from a real login. */
  simulatedByUserId: string | null;
  simulatedByName: string | null;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    auth: AuthContext;
  };
};
