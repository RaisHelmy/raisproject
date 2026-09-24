# Future .NET Backend

**Status: FUTURE / NOT CURRENTLY IMPLEMENTED. No .NET code exists in this repository,
and none should be added until this migration is scheduled.**

## Target evolution

```
CURRENT                          FUTURE

React                            React (unchanged)
  ↓                                ↓
Cloudflare Workers               Cloudflare (edge/API gateway: auth, caching, routing)
  ↓                                ↓
PostgreSQL                       .NET backend (investment domain services)
                                   ↓
                                 PostgreSQL
```

## What moves, what stays

- **Moves to .NET**: provider adapters, sync engine, consolidation/portfolio math,
  the investment job queue. These are already isolated in `worker/providers/`,
  `worker/sync.ts`, `worker/quant.ts`, `worker/jobs.ts` with TypeScript interfaces —
  the same contracts translate directly to C# interfaces
  (`IInvestmentProviderClient`, capability records, normalized DTOs).
- **Stays on Cloudflare**: static assets, session/edge auth (or delegates to the
  backend), R2 file storage, cron triggers (may instead call the .NET scheduler).
- **Never changes**: the JSON contracts of `/api/investments/*`. React is coupled to
  those responses, not to the runtime behind them. The frontend must not need a
  rewrite — that is the acceptance test for this migration.

## Contract-first rule (applies today)

Any change to `/api/investments/*` responses should stay backward-compatible
(additive fields, no renames), so the future backend swap is a pure re-implementation
behind a stable interface.

## Prerequisites when scheduled

1. PostgreSQL migration completed or bundled (see `future-postgresql-migration.md`).
2. Secret management moved from Worker env secrets to the backend's vault.
3. Worker reduced to gateway: forward `/api/investments/*` to the .NET service,
   keep session verification at the edge.
4. Cut over route-by-route; the provider registry response is the safest first move.
