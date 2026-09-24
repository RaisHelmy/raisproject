# Investment Provider Architecture

**Status: CURRENT — implemented on Cloudflare Workers + PostgreSQL (Hyperdrive) + R2 + Cron.**

Rais Fintech is the user's central investment dashboard; brokers are connected data
sources. One normalized model serves every provider.

## Layers

```
React (Vite SPA, served as Worker assets)
  │  InvestmentContext: providers / connections / accounts / global scope
  ▼
Cloudflare Worker (Hono, /api/investments/*)
  │  provider registry · connection management · consolidation · affiliate config
  ▼
worker/providers/*        TypeScript adapters (one dir per provider)
worker/sync.ts            normalization + upsert into Postgres + sync logs
  ▼
Postgres (normalized investment schema)      R2 (documents; future: exports/statements)
  ▲
Cron trigger (*/2 min): drains job queue + syncs connections whose interval lapsed
```

Pages read normalized data from Postgres. Broker APIs are only called by the sync engine
(connect, manual refresh, cron).

## Provider abstraction

- `worker/providers/types.ts` — `InvestmentProviderClient` (getAccounts / getPositions /
  getTransactions / getDividends), normalized models, `InvestmentProviderCapabilities`,
  `IntegrationStatus`.
- `worker/providers/registry.ts` — the single provider list. React reads
  `GET /api/investments/providers`; no component hardcodes providers.
- Integration states are honest:
  - **implemented** — Moomoo. End-to-end adapter → sync → Postgres → UI. (Data source in this
    build is the deterministic simulation in `worker/instruments.ts`; swapping in
    Moomoo OpenAPI changes only `providers/moomoo/client.ts`.)
  - **configured** — secrets present (see `configSecrets` per provider), adapter not live.
  - **available** — public API exists (Alpaca, Tradier, Trading 212), not configured.
  - **coming_soon** — boundary only (IBKR, Saxo).
- Pending providers throw `IntegrationPendingError` from every method. **No fake API
  responses, ever.** Connecting a non-implemented provider returns 409.

## Data model (PostgreSQL)

Internal UUIDs are primary keys; provider-native identifiers live in
`provider_account_id`, `provider_security_id`, `provider_transaction_id`,
`provider_dividend_id`, `provider_order_id`.

```
users ─┬─ investment_connections (owner_type reserved for family/estate)
       │        └─ investment_accounts
       │                 ├─ investment_holdings      (snapshot, replaced per sync)
       │                 ├─ investment_transactions  (append-only, idempotent on provider id)
       │                 ├─ investment_dividends     (append-only, idempotent)
       │                 └─ investment_orders
       ├─ investment_sync_logs
       └─ investment_affiliates (per provider × country, date-windowed)
```

Islamic-wealth future fields already exist where cheap: `shariah_status`,
`zakat_eligible` on holdings, `purification_amount` on dividends, `asset_class`.
`owner_type` on connections prepares family/estate ownership (§ future docs).

## Consolidation

`GET /api/investments/portfolio` merges identical symbols across accounts/brokers,
normalizes currencies to MYR (`worker/fx.ts` — static demo rates behind one function),
and returns totals, per-provider and per-account breakdowns, plus per-holding account
drill-down. Global scope (`?accountId=all|<id>`, `?providerId=`) is honored by
portfolio/holdings/transactions/dividends alike; the React `InvestmentContext` persists
the selection per device.

## Affiliate / referral

`investment_affiliates` in Postgres (provider × country, active + date window). The Worker
resolves the row; React shows a disclosure dialog before leaving. No affiliate URL is
hardcoded in components; no private affiliate credentials are exposed.

## Security

- No broker secrets in Postgres plaintext: `credential_ref` stores a *reference* only.
- Provider API credentials belong in Worker environment secrets
  (`wrangler secret put ALPACA_API_KEY_ID`, …) — names listed per provider in
  `configSecrets`.
- Raw provider errors go to `investment_sync_logs`; connections expose only
  status enums (`connected / syncing / needs_attention / auth_expired / disconnected / error`).

## Backward compatibility (Moomoo migration)

Users connected before this schema (guidance flag `brokerageConnected` only) are
backfilled lazily: the first `GET /api/investments/connections` creates a
`Moomoo (migrated)` connection and runs an initial sync. No reconnect required.

## Adding a provider (checklist)

1. `worker/providers/<id>/{client.ts,mapper.ts,types.ts}` implementing
   `InvestmentProviderClient` against the real API.
2. Flip its registry entry to `baseStatus: "implemented"` with `makeClient`.
3. Add secrets via `wrangler secret put`, listed in `configSecrets`.
4. Optionally seed `investment_affiliates` for open-account referrals.

Nothing else changes: sync engine, Postgres schema, API and UI are provider-agnostic.
