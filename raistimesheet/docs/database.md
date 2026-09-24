# Database

Schema: `apps/api/migrations-pg/0001_init.sql` (PostgreSQL, reached via Cloudflare Hyperdrive; see below). `apps/api/migrations/0001_init.sql` is the original SQLite/D1 schema, kept for history — the app no longer uses D1. Portable SQL: TEXT UUID primary keys, ISO-8601 timestamps as TEXT, integer booleans, JSON in TEXT columns. No Jira issue key is used as a primary key.

The database is no longer dedicated to this app. All apps share one Postgres database (`raishelmy`), and this app's 27 tables live in their own schema, `raistimesheet`, inside it — behind a single account-wide Hyperdrive config (`raishelmy-hyperdrive`). `src/db/client.ts` sets `connection: { search_path: "raistimesheet" }` on the postgres.js client so the adapter's unqualified table names (`users`, `timesheets`, ...) resolve against this app's schema rather than `public` or another app's schema in the same database.

Every business entity carries `id, created_at, updated_at` and, where a human acts, `created_by, updated_by`.

## Tables

| Group | Tables |
|---|---|
| Identity | `users`, `roles`, `user_roles`, `sessions`, `api_tokens`, `rate_limits` |
| Organisation | `clients`, `projects`, `project_members` |
| Import & AI | `imports`, `import_messages`, `ai_analyses`, `ai_work_items` |
| Timesheets | `timesheets` (one row = one work entry, reference `TS-YYYY-NNNNN`), `timesheet_sequences`, `timesheet_approvals` |
| Jira | `jira_connections` (encrypted tokens), `jira_oauth_states`, `jira_issues` (cache), `timesheet_jira_links`, `jira_match_candidates`, `sync_jobs`, `sync_errors` |
| Platform | `notifications`, `audit_logs`, `report_jobs`, `settings` |

### `timesheets` lifecycle

`status`: `DRAFT → SUBMITTED → APPROVED`, or `SUBMITTED → REJECTED → DRAFT`. AI review happens *before* a draft exists (`ai_work_items.review_status`: PENDING / ACCEPTED / IGNORED / MERGED). Drafts deleted by the user are marked `DELETED` (kept for audit, hidden from lists).

`jira_sync_status` (independent of approval): `NOT_LINKED → MATCH_SUGGESTED → LINKED → READY_TO_PUSH → PUSHING → SYNCED`, with `SYNC_FAILED` on error.

`work_status`: COMPLETED / IN_PROGRESS / BLOCKED / UNKNOWN.

### `timesheet_jira_links`

`match_type`: EXACT (explicit key in conversation), AI_SUGGESTED (accepted suggestion), MANUAL, CREATED. `idempotency_key` is unique; one link per timesheet.

### `sync_jobs` / `sync_errors`

`sync_jobs.idempotency_key` (e.g. `create:<timesheet_id>:<project_id>`) guarantees a second "Push to Jira" never creates a second issue. `status`: PENDING / RUNNING / SUCCEEDED / FAILED (retry scheduled at `next_run_at`) / DEAD (needs human). `sync_errors.reference` (e.g. `SYNC-20260904-00182`) is what users see.

### `audit_logs`

Append-only. `who (actor_id) · what (entity_type, entity_id, action) · when · before_json · after_json · reason · source (web/mcp/system) · correlation_id`. Approved-record corrections require a reason and are stored with before/after.

## Repository abstraction

```
services/*  ──►  repositories/interfaces.ts  ──►  repositories/d1/*.ts  ──►  src/db/pg-adapter.ts  ──►  postgres (postgres.js)  ──►  Hyperdrive  ──►  Postgres
```

Services receive `AppContext.repos` (the `Repositories` bundle). The interfaces and DTOs were already storage-neutral, so migrating off D1 only touched the bottom of the stack:

- **`src/db/client.ts`** — builds the `postgres.js` client from `env.HYPERDRIVE.connectionString` (module-scoped, so the pool is reused across requests in the same isolate).
- **`src/db/pg-adapter.ts`** — `PgDatabase`/`PgPreparedStatement` give the repositories the same `db.prepare(sql).bind(...).first()/.all()/.run()` and `db.batch([...])` surface D1 exposed, translating `?` placeholders to Postgres's `$1, $2, ...`. This app never used an ORM (repositories build plain SQL strings directly), so keeping that shape was a much smaller, more reviewable diff than introducing a query builder at the same time as the database migration. The `repositories/d1/*.ts` files and their `D1*` class names are otherwise unchanged — only cosmetic, so left as a follow-up rename — since the SQL and D1-shaped calls they make now run against `PgDatabase`.
- **`ON CONFLICT ... DO UPDATE SET x = excluded.x`** and **`RETURNING`** already read identically in SQLite and Postgres, so none of the repository SQL needed rewriting for those.
- **`LIKE` → `ILIKE`** for the free-text search filters (issue/timesheet/audit search, global search) — SQLite's `LIKE` is case-insensitive for ASCII by default; Postgres's is case-sensitive, so `ILIKE` preserves the original behaviour.
- **`count(*)`/`sum(...)` results** — postgres.js returns Postgres `bigint`/`numeric` as strings by default (avoids silent precision loss); `src/db/client.ts` overrides those two type parsers to return plain `number`s, since every call site here (pagination totals, dashboard aggregates) assumed a JS number the way D1 always returned one.

## Migrations & seed

Schema lives in `migrations/0001_init.sql` (kept, now historical/D1-only) and its direct Postgres port `migrations-pg/0001_init.sql` — the original file was already written as portable ANSI SQL (TEXT ids, ISO-8601 TEXT timestamps, 0/1 INTEGER booleans, REAL), so nothing but a header comment changed. There is no drizzle/ORM in this app, so there's no `drizzle-kit generate` step — migrations are hand-written SQL applied directly with `psql`, the same pattern the app already used for D1.

Local Postgres (and drizzle-kit-less migrations) require an SSH tunnel to the VM hosting the Docker Postgres container:

```bash
sshpass -p 'P@ssw0rd' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk   # keep running in a separate terminal

cd apps/api
bun run db:migrate:local   # psql -f migrations-pg/0001_init.sql (targets raishelmy, search_path=raistimesheet)
bun apps/api/seed/build-seed.mjs   # regenerate seed/demo.sql (password hashes, demo data)
bun run db:seed:local      # psql -f seed/demo.sql (same schema)
```

Both scripts connect to `postgresql://postgres:postgres@localhost:15432/raishelmy` with `?sslmode=require&options=--search_path%3Draistimesheet` — there is no `raistimesheet_db` database anymore; everything lives under the `raistimesheet` schema in the shared `raishelmy` database.

In production the Worker never needs the tunnel — Hyperdrive resolves `env.HYPERDRIVE.connectionString` to the private VPC service automatically. Apply a new migration there the same way, pointed at the tunnel (or run `psql` directly on the VM) before deploying the Worker code that depends on it: add it as `migrations-pg/0002_<name>.sql` and `psql -f` it by hand — there is no automatic migration runner (D1's `wrangler d1 migrations apply` no longer applies).

## Retention

`settings.retention` (or env defaults): raw WhatsApp files (R2) after N days, generated reports after N days, audit log after N days (0 = never). Timesheets, approvals and links are never auto-deleted.
