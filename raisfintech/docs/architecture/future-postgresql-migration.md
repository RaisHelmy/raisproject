# PostgreSQL Migration

**Status: DONE.** The application runs on PostgreSQL via Cloudflare Hyperdrive
(binding `HYPERDRIVE`, config `raishelmy-hyperdrive`,
id `7a7777560d434c2b91ff37c52ab1b2c9`). This Hyperdrive config points at a
single shared database named `raishelmy` that hosts every app, each isolated
into its own Postgres schema; this app's tables live in schema `raisfintech`.
`worker/db.ts` sets the postgres.js connection's `search_path` to
`raisfintech` so the existing unqualified SQL (written against D1/SQLite,
then against the old dedicated database's `public` schema) keeps working
unchanged. (Previously this ran against a dedicated `raisfintech_db`
database/Hyperdrive config — that has been retired in favor of the shared
`raishelmy` database.)
The original D1/SQLite setup (`migrations/`, `wrangler d1 …`) is left in the repo
untouched for history but is no longer used by the app.

## What actually shipped (vs. the plan below)

The plan below anticipated a Drizzle-based data layer; in practice this codebase
never adopted an ORM — every route talks to the database through the D1
`prepare().bind().first()/.all()/.run()` / `DB.batch([...])` surface directly.
Rewriting ~100 call sites to a new client API was unnecessary risk, so the
migration instead:

- Ported `migrations/*.sql` 1:1 into `migrations_pg/*.sql` (Postgres dialect —
  see table below) and applied them directly to the `raisfintech` schema
  (originally in the dedicated `raisfintech_db` database, now in the shared
  `raishelmy` database) with `psql` (`npm run db:migrate:pg`, which sets
  `search_path` to `raisfintech` before running each file), rather than
  introducing Drizzle/drizzle-kit.
- Added `worker/db.ts`: a small D1-compatible shim (`PgD1`) backed by
  `postgres` (postgres.js) + the `HYPERDRIVE` binding. It rewrites `?`
  placeholders to `$1, $2, ...` and implements `.first()/.all()/.run()/.batch()`
  with the same shapes D1 returned, so `worker/index.ts`, `auth.ts`,
  `gamify.ts`, `jobs.ts`, `sync.ts`, `email.ts` needed **no call-site changes**
  beyond the SQL text fixes below.
- Kept types conservative/dialect-faithful rather than "improving" them:
  - `TEXT` ids stayed `TEXT`, **not** cast to `uuid` — the app already treats
    them as opaque strings everywhere; a cast would be a redesign, not a port.
  - `INTEGER` booleans (0/1) stayed `INTEGER`, **not** `boolean` — call sites
    compare/assign them as 0/1 (`email_verified = 1`, `.bind(role, ...)`, etc.).
  - `REAL` stayed `REAL` (`double precision`), **not** `numeric(18,4)` —
    changing precision/type here is a deliberate future improvement, not a
    dialect port.
  - JSON-in-TEXT columns (`guidance.data`, `jobs.payload`/`result`) stayed
    `TEXT`, **not** `jsonb` — the app already does `JSON.parse`/`JSON.stringify`
    at the call sites; moving to `jsonb` is a real behavior change (would want
    to drop the manual parse/stringify) best done as its own change.
- `COUNT(*)`/`SUM(...)` return Postgres `int8`, which drivers return as a
  string by default (bigint precision safety). `worker/db.ts` overrides the
  `int8` type parser to `Number.parseInt` since every count/sum in this app is
  compared or added as a plain JS number and stays far under
  `Number.MAX_SAFE_INTEGER` — matches the D1/SQLite behavior the code was
  written against.

## Dialect differences actually handled

| D1 / SQLite                                     | PostgreSQL                                          |
| ------------------------------------------------ | --------------------------------------------------- |
| `datetime('now')` defaults / inline calls        | `now()`                                              |
| `INSERT OR IGNORE`                                | `INSERT ... ON CONFLICT (...) DO NOTHING`            |
| `ON CONFLICT(...) DO UPDATE ... excluded.col`     | same syntax — no change needed                       |
| `datetime(last_sync_at, '+' \|\| n \|\| ' minutes')` | `last_sync_at::timestamp + (n \|\| ' minutes')::interval` |
| `TEXT` ids, `INTEGER` booleans, `REAL` money      | left as-is (see "conservative" note above)           |

## Future improvements (not done now, deliberately out of scope)

- Cast `TEXT` ids to native `uuid`.
- Move `INTEGER` booleans to `boolean`.
- Move `REAL` money columns to `numeric(18,4)` for exact precision.
- Move `guidance.data` / `jobs.payload` / `jobs.result` to `jsonb`.
- Introduce a real query builder/ORM (Drizzle, Kysely) now that the DB is
  Postgres, since `worker/db.ts` is a compatibility shim, not a long-term
  data-access layer.

## Local dev

```
sshpass -p '...' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy npm run db:migrate:pg
```

`db:migrate:pg` sets `search_path` to `raisfintech` for each file it applies,
so the connection string itself just needs to name the shared `raishelmy`
database.

`wrangler.jsonc`'s `hyperdrive[0].localConnectionString` points `wrangler dev`
at the same tunnel automatically.
