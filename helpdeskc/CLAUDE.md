# CLAUDE.md

Instructions for Claude Code when working in this repository.

---

## 1. What this product is

**HelpdeskC** — a multi-tenant **help desk SaaS**. Our customers are businesses; they use the platform to support *their own* clients. The platform owner is a **software house and infrastructure reseller**, so the product serves both worlds: bug reports and change requests on one side, hosting/licence/renewal issues on the other.

### Vocabulary — use these exact words in code

There are four levels. "Customer" is banned as a term because it is ambiguous.

| Term | Meaning |
|---|---|
| **Platform** | Us. The SaaS operator. |
| **Tenant** | A business paying for the SaaS. Owns its own data, branding, roles, templates, domains. |
| **Account** | One of the tenant's clients. A company. |
| **Team** | A sub-team inside an Account. E.g. Account "Acme" has teams "Finance", "Warehouse". |
| **Contact** | A person at an Account, optionally belonging to a Team. Raises tickets. |
| **Agent** | A user inside a tenant who works tickets. |

Hierarchy: `Tenant → Account → Team → Contact`. Tickets belong to a Tenant and reference an Account, optionally a Team, and a Contact.

---

## 2. Stack

**Runtime is Cloudflare Workers (`workerd`), not Bun.** Bun is the local dev server, package manager, and test runner only. This distinction causes real bugs — read §3 before writing any server code.

- **Package manager / test runner / local scripts:** Bun
- **UI:** React + Bootstrap 5 via `react-bootstrap`. No Tailwind, no MUI, no second UI library.
- **Charts:** Highcharts via `highcharts-react-official`
- **Hosting:** Cloudflare Pages + Pages Functions
- **DB:** PostgreSQL, reached from Workers via Cloudflare Hyperdrive (binding `HYPERDRIVE`). Migrated off the original D1 (SQLite) MVP — see §4, which is now a historical record of that migration plus the SQLite-flavoured conventions (UUID text ids, ISO-8601 text timestamps, etc.) that are still the house style. The old D1 migrations live on, untouched, in `src/db/migrations/`; new schema changes go in `src/db/migrations_pg/` via `drizzle.config.postgres.ts`. **Infrastructure note:** there is no longer a dedicated `helpdeskc_db` database. All apps now share one Postgres database (`raishelmy`), and this app's 28 tables are isolated into Postgres schema `helpdeskc` within it, fronted by the single account-wide Hyperdrive config `raishelmy-hyperdrive`. `src/db/client.ts` / `platform-client.ts` pin `search_path=helpdeskc` on every connection, so the plain (non-schema-qualified) `pgTable()` calls in `src/db/schema/` still resolve correctly with no schema-file changes. Local dev / drizzle-kit reach it through an SSH tunnel to `raishelmy` (not `helpdeskc_db` — see `.dev.vars`), and any script that opens its own `postgres()` client (seed script, test reset helper) must set the same `search_path` explicitly.
- **ORM:** Drizzle (`drizzle-orm/pg-core` schema, `drizzle-orm/postgres-js` client). Originally chosen so the same schema definitions could target both D1 and Postgres during the migration window.
- **Files:** Cloudflare R2. Never store binaries in Postgres.
- **Async work:** Cloudflare Queues + Cron Triggers. There is no long-running worker process.
- **Custom domains:** Cloudflare for SaaS (custom hostnames)
- **Cache / counters / rate limits:** Workers KV, or Durable Objects where strong consistency is needed.

### Layout

```
src/
  routes/       Pages Functions — HTTP edge, thin
  core/         domain logic — pure, no Cloudflare bindings, no DB imports
  db/           Drizzle schema, migrations, tenant-scoped client
  jobs/         queue consumers + cron handlers
  ui/           React app — pages, components
  ui/charts/    Highcharts wrappers only
```

`core/` is pure TypeScript. It takes plain objects in, returns plain objects or events out. No `env`, no bindings, no fetch. This is the only part of the codebase that is genuinely easy to test, so push logic into it.

---

## 3. Cloudflare Workers constraints

These are not style preferences. Breaking them means the code fails in production but may pass locally.

1. **No Node APIs** unless `nodejs_compat` is on and the API is on the supported list. No `fs`, no `path`, no `crypto` from Node — use Web Crypto.
2. **No Bun APIs in `src/routes`, `src/core`, or `src/jobs`.** No `Bun.file`, no `bun:sqlite`. Bun-only code lives in `scripts/` and tests.
3. **No in-memory state between requests.** No module-level caches, no counters, no maps. Isolates are created and destroyed without warning. Use KV or a Durable Object.
4. **CPU time is limited per request.** Anything looping over more than a few hundred rows belongs in a queue consumer, not a request handler.
5. **No `setInterval`, no background promises after the response.** Use `waitUntil()` for genuine fire-and-forget, Queues for anything that must not be lost.
6. **Subrequest limits apply.** Do not fan out one request into dozens of `fetch` calls.

---

## 4. D1 now, Postgres later (migration complete)

**Status: done.** The app now runs on Postgres via Hyperdrive; this section's SQLite-flavoured conventions (UUID text ids, ISO-8601 text timestamps, integer-cents money, JSON-as-text) are kept as the house style rather than relaxed, since they're good practice on Postgres too and nothing here depended on being D1-only. `db.batch()` (D1, no interactive transactions) is gone — `platformDb().tenants.create()` now uses a real `db.transaction()`. The rest of this section is left as originally written, for history and because the underlying rules still apply.

**Do:**
- IDs: UUIDv7 stored as `TEXT`. Never `INTEGER PRIMARY KEY AUTOINCREMENT`.
- Timestamps: ISO-8601 UTC strings in `TEXT`. Never SQLite `datetime()` in queries.
- Booleans: `INTEGER` 0/1, wrapped by Drizzle so app code sees real booleans.
- Money: `INTEGER` minor units + currency code. No floats anywhere.
- JSON: `TEXT` holding JSON, parsed in the app layer. Do not query into it in SQL.
- Explicit `NOT NULL` and explicit defaults on every column.

**Do not:**
- `INSERT OR REPLACE`, SQLite-specific upsert syntax, `PRAGMA`, `AUTOINCREMENT`, `ROWID` references.
- Rely on SQLite's loose typing. D1 will accept a string in a numeric column; Postgres will not.
- Write raw SQL outside `src/db/`. If you need raw SQL, put it there, name it, and note the Postgres equivalent in a comment.

**D1 has no Row Level Security.** On Postgres, RLS is our second line of defence. On D1, there is none — tenant isolation is *entirely* application-layer. That makes §5 the single most important section in this file.

Batch writes with `db.batch()`. D1 has no interactive transactions; do not write code that assumes rollback across separate awaits.

---

## 5. Tenant isolation — non-negotiable

1. Every tenant-owned table has a non-nullable `tenant_id`. Exceptions: `tenants`, `plans`, `platform_admins`, `audit_log`.
2. Every query goes through the tenant-scoped client. Never touch the bare Drizzle client outside `src/db/`.

```ts
// Good
const db = tenantDb(ctx.tenantId)
const rows = await db.tickets.list({ status: 'open' })

// Never
await drizzle(env.DB).select().from(tickets).where(eq(tickets.status, 'open'))
```

3. Every new tenant table ships in the same PR as: the `tenant_id` column, an index leading with `tenant_id`, and a test proving tenant A cannot read tenant B's rows using the two seeded tenants.
4. Internal notes are filtered at the query layer, never in the view.
5. Never log or return: password hashes, API keys, session tokens, R2 signed URLs, or full ticket bodies.
6. IDs in URLs are UUIDs, but **still authorise every one of them**. An unguessable ID is not an access control.

If a task appears to require reaching around the scoped client, stop and raise it.

---

## 6. Domains and tenant resolution

Every tenant gets a subdomain and may add custom domains.

- **Subdomain:** `{slug}.helpdesk.example`. Slug is lowercase alphanumeric plus hyphens, 3–40 chars, immutable after creation (changing it breaks bookmarks and email links).
- **Reserved slugs:** maintain a blocklist — `www`, `api`, `app`, `admin`, `mail`, `smtp`, `status`, `cdn`, `assets`, `static`, `help`, `support`, `docs`, `blog`, `dev`, `staging`, `test`, plus anything used by the platform. Check it at creation.
- **Custom domains:** tenant adds a hostname, we return a verification record, they add the DNS record, we verify, then provision via Cloudflare for SaaS. Certificates issue asynchronously — the UI must show `pending → verifying → active → failed` and never assume instant.
- A tenant may have several verified hostnames. One is marked primary and is used for all generated links in emails.

### Rules

1. **Resolve tenant from the `Host` header, then treat the result as untrusted input.** Look up the hostname in a KV-cached map to a `tenant_id`. An unknown host returns 404, never a default tenant.
2. **The resolved tenant is a hint, not authorisation.** The session determines what the user may access. If a session's tenant does not match the host's tenant, reject — do not silently switch.
3. **Sessions are scoped to one hostname.** Cookies are host-only: no `Domain=.helpdesk.example` wildcard, ever. A session on `acme.helpdesk.example` must not be valid on `globex.helpdesk.example`.
4. Cookies: `Secure`, `HttpOnly`, `SameSite=Lax`.
5. Never build a URL by string-concatenating a slug. Use `tenantUrl(tenant, path)` so primary-hostname logic lives in one place.
6. Custom domain removal must purge the KV mapping immediately, or a released domain keeps resolving.

---

## 7. Identity and authentication

Two populations with different needs. Keep them in separate tables — an Agent and a Contact are not the same kind of user, and merging them creates permission bugs.

### Agents

Email plus password, session cookie. Invite-only — a tenant admin invites, the agent sets a password. TOTP two-factor available, enforceable per tenant.

### Contacts

Contacts get **both** a real account and magic-link access. Both paths must reach the same Contact record.

- **Magic link:** enter email → single-use token, short expiry (15 min), consumed on first use, invalidated on send of a newer one. Rate limit per email and per IP. Never reveal whether an email exists — the response is identical either way.
- **Real account:** a Contact can set a password at any time. Doing so does not disable magic link; both remain valid.
- A Contact who arrives by magic link and later sets a password keeps the same Contact ID and ticket history. Do not create a second record.
- Contact sessions are shorter than agent sessions and re-authenticate on sensitive actions.

### Identity is per-tenant, not global

The same email address may be a Contact at two different tenants, and may also be an Agent somewhere. These are separate records with separate credentials.

- Unique constraint is `(tenant_id, email)`, never `email` alone.
- Never look up a user by email without a tenant in the query.
- A magic-link token is bound to one tenant and one hostname. A token issued for tenant A must fail on tenant B.

### Email change

Changing a Contact's email is an access-control change, not a profile edit. Require confirmation at the new address before it takes effect, and keep the old address active until then. An unverified email cannot be used to log in.

---

## 8. Permissions

Two separate things are both called "rules". Keep them apart:

- **Roles** — who can see and do what. §8.
- **Automation rules** — what happens to a ticket automatically. §10.

### Model

Tenants define their own roles. Do not hardcode role names in logic — check permissions, never `role === 'admin'`.

```
Permission   a string, e.g. "ticket.read", "ticket.assign", "report.view", "account.manage"
Role         tenant-owned, a name + a set of permissions + a ticket scope
Membership   user ↔ role, within a tenant
```

**Ticket scope** is a separate axis from permissions and is the thing that makes this product work:

| Scope | Sees |
|---|---|
| `all` | every ticket in the tenant |
| `team` | tickets for Accounts/Teams the user is assigned to |
| `assigned` | only tickets assigned to them |
| `own` | only tickets they raised |
| `none` | no ticket rows — summary aggregates only |

Maps to the intended roles: strategic → `none` + `report.view`; support → `all`; developer → `assigned`.

Ship **preset roles** at tenant creation (Owner, Admin, Support, Developer, Strategic, Read-only) that the tenant can clone and edit. Presets are a starting point, not a fixed list.

Contacts are not on this model. A Contact sees tickets for their own Account, narrowed to their Team where the Account is configured that way, and never sees internal notes.

### Enforcement

- Scope resolves to a `where` fragment applied by the tenant-scoped client. Never enforced only in React.
- Aggregates for `scope: none` come from a pre-aggregated summary, never from querying rows and counting.
- Every permission check goes through `core/authz`. One code path, tested.
- Deny by default. A missing permission is a denial.

---

## 9. Templates

Tenants build their own intake forms. This is a headline feature — treat the template engine as core domain logic, not UI config.

- A **Template** belongs to a Tenant and can be assigned to an Account, a Team, or set as default.
- A template is an ordered list of **fields**: `text`, `textarea`, `select`, `multiselect`, `date`, `number`, `checkbox`, `file`, `email`, `url`.
- Fields have: key, label, help text, required flag, validation, conditional visibility (`show when field X = Y`).
- Templates carry defaults: category, priority, assignee or queue, SLA policy.
- **Templates are versioned.** A ticket stores a snapshot of the template version it was raised with. Editing a template never changes existing tickets.
- Field values are stored as JSON on the ticket plus a normalised key/value table for fields the tenant marks filterable.
- Validation lives in `core/templates` and runs on both client (UX) and server (truth). The server is authoritative.

Ship a starter library covering both sides of the business: Bug Report, Change Request, Access Request, Server Down, Renewal Query, General Support.

---

## 10. Tickets

### Lifecycle

```
new → open → pending (waiting on requester) → resolved → closed
         ↓
      on_hold (waiting on us or a third party)
```

- The state machine lives in `core/ticket/state.ts`. Every transition goes through it. Never set `status` directly.
- `pending` and `on_hold` pause the SLA clock. `open` does not.
- `resolved` auto-closes after a configurable window (default 7 days). A requester reply reopens it to `open`.
- Every transition writes an audit entry and emits a domain event.

### Numbering

Per-tenant sequential `number` shown to humans (`#1042`), UUID everywhere in code and URLs. Generate the sequence with a Durable Object per tenant — `MAX(number)+1` on D1 will produce duplicates under concurrency.

### SLA

- Business hours, holidays, and timezone are per tenant. Never compute business hours in UTC wall-clock.
- Targets are snapshotted onto the ticket at creation. Editing a policy does not change old tickets.
- Breach checks run on a Cron Trigger over a due-soon index. Do not scan all tickets.

### Automation rules

Tenant-authored `when → if → then`: on created / updated / SLA warning, if conditions match, then assign, set priority, add tag, notify, or move queue. Rules are data, evaluated by `core/rules`. Cap rules per tenant and guard against loops — a rule firing must not re-trigger itself on the same ticket.

---

## 11. Attachments

Requesters upload proof: screenshots, logs, invoices. Treat every upload as hostile.

- Direct-to-R2 upload using a short-lived presigned URL. Bytes never pass through a Function.
- Server decides the storage key: `{tenant_id}/{ticket_id}/{uuid}`. Never use the client's filename as a path.
- Validate size and extension server-side before issuing the URL. Sniff content type on read; never trust the declared MIME.
- Serve from a separate origin with `Content-Disposition: attachment` and a restrictive CSP. Never inline user HTML or SVG.
- Downloads use short-lived signed URLs, authorised against ticket scope on every request. Never a public bucket.
- Metadata in D1, bytes in R2. Deleting a ticket deletes the objects — queue it.

---

## 12. Billing

Flat rate: **RM 5,000 per tenant per month.** No per-seat or per-ticket metering.

Consequences — respect these, they keep the MVP small:

- **Do not build usage metering, seat counting, or tiered plan gating.** There is one plan.
- Keep a `plans` table and a `plan_id` on tenant anyway. It costs nothing now and avoids a migration when a second tier appears.
- Currency is MYR, stored as integer sen (`INTEGER`) with a currency code. RM 5,000 is `500000`.
- Tenant billing state is a simple enum: `trial | active | past_due | suspended | cancelled`. Suspension disables agent login and write access; the requester portal shows a maintenance notice rather than an error. Never delete data on suspension.
- At this price point, onboarding and invoicing are human processes. Do not build self-serve card checkout at MVP — an admin marks a tenant active. Model it so a payment provider can be added later without reshaping the schema.
- Invoices are records in our DB, not derived on the fly from a provider.
- Malaysian service tax may apply to digital services. Do not hardcode a tax rate anywhere — put rate and registration number in platform config, store the applied rate on each invoice, and confirm the current treatment with the user before generating anything customer-facing.

**Fair use.** A flat rate with unmetered storage is a cost risk, since R2 bills by volume. Track per-tenant attachment bytes and ticket counts as reporting figures from day one, even though nothing is billed on them. Add a soft storage cap that warns rather than blocks.

---

## 13. Frontend

- Bootstrap utilities and components first. Custom CSS only where Bootstrap genuinely cannot do it, kept in one place.
- Tenant branding (logo, primary colour) via CSS custom properties overriding Bootstrap variables. Never hardcode platform branding into the requester portal.
- Highcharts is heavy — lazy-load the bundle, only on pages that render charts. Wrap it in `ui/charts/` so no page imports Highcharts directly.
- **Highcharts requires a commercial licence for a commercial SaaS.** Flag this if the user has not confirmed one.
- Never render an action the user lacks permission for, and never rely on that for security — §8 is enforced server-side.
- Ticket tables are server-paginated with cursors. Never load a tenant's full ticket list into the browser.

---

## 14. Testing

Run before declaring anything done:

```bash
bun install
bun run dev
bun test
bun run typecheck
bun run lint
bun run db:migrate:local
bun run db:seed          # seeds 2 tenants — use these for isolation tests
```

Required coverage:

- `core/` — unit tested, no mocks needed since it is pure.
- Tenant isolation test on every new endpoint, using the two seeded tenants.
- Permission matrix: for each preset role × each ticket scope, assert what is and is not visible.
- Auth: magic link expiry, single use, reuse after consumption, token issued for tenant A rejected on tenant B, same email as Contact at two tenants staying separate, magic-link user setting a password keeping the same ID.
- Domains: unknown host 404s, session from host A rejected on host B, reserved slug refused.
- Templates: required fields, conditional visibility, ticket on v1 rendering correctly after template moves to v2.
- SLA: DST boundaries, holidays, midnight rollover. This is where the bugs live.
- Attachments: oversized file, disallowed extension, path-traversal filename.

---

## 15. Conventions

- TypeScript strict. No `any` — use `unknown` and narrow.
- `snake_case` in the DB, `camelCase` in TypeScript, `kebab-case` for files and routes.
- Store UTC, render in the viewer's timezone, compute business hours in the tenant's.
- Soft delete via `deleted_at` on tenant-facing entities. Hard delete only through the erasure path.
- Typed domain errors from `core`, mapped to HTTP at the edge. Never throw strings.
- Comments explain *why*. If the code already says *what*, skip it.
- No new dependency without saying so and justifying it. Bundle size is a Workers constraint, not a preference.

---

## 16. Working style

- Prefer editing existing files over creating new ones.
- Smallest change that solves the problem. If a task needs a large refactor, say so before starting.
- Ambiguity about who can see what → ask. Visibility guesses become data leaks.
- When finished: say what changed, what you tested, what you did not test.
- Do not create READMEs, docs, or summary markdown unless asked.

---

## 17. Open decisions

Ask before assuming.

- Asset/CMDB depth for the reseller side: flat inventory or dependency graph.
- Knowledge base in v1 or deferred.
- Whether automation rules can call outbound webhooks at MVP.
- Public API for tenants at MVP, or dashboard and portal only.
- Inbound email as a ticket channel at MVP, or portal-only intake.