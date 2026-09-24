# @raisai/worker

Cloudflare Worker: Hono API + web asset serving + workflow engine host.

## Local dev

```
bun install
bun run --filter @raisai/worker dev   # wrangler dev
```

## Database: Postgres via Hyperdrive

The Worker connects to Postgres through the `HYPERDRIVE` binding (see
`wrangler.jsonc`; config id `f1a10a9a8cd74743bba1c46897eddbe5`), not D1. A
request-scoped `env.DB` (see `src/db/client.ts`) wraps `postgres` (postgres.js)
behind the same `.prepare(sql).bind(...).run()/.all()/.first()` /
`.batch()` shape the old D1 binding had, so the repositories/services under
`src/` did not need their query code rewritten.

Migrations live in `migrations-pg/*.sql` (Postgres dialect — the original
SQLite migrations are kept, unused, under `migrations/` for reference). Apply
them by connecting directly to Postgres, e.g. through the SSH tunnel
described in the project runbook:

```
export DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raisaicreatehiggsfield_db
bun run db:migrate:local    # from repo root; applies migrations-pg/*.sql in order
```

`db:migrate:remote` runs the same thing — Hyperdrive proxies query traffic
for the Worker but is not a DDL/admin channel, so both local and "remote"
application currently mean "run this against Postgres directly with psql".
Set up a real migration pipeline (e.g. from CI, over the same SSH tunnel or a
VPN peer) before relying on this for production changes. TODO: this is a
deliberately manual step for now.

For local dev / `wrangler dev` / tests, `wrangler.jsonc`'s
`hyperdrive[0].localConnectionString` points at the same tunnelled Postgres,
so `bun run dev` and `bun test` need the SSH tunnel open first:

```
sshpass -p 'P@ssw0rd' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
```

Tests reset the `public` schema and replay `migrations-pg/*.sql` once at
startup (`test/setup.ts`), against that same tunnelled database — see the
comment there for why (storage is intentionally shared across tests already).
