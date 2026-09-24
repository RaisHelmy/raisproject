# 玄知 AI · XuanZhi AI

> **Ancient Wisdom. Intelligent Guidance.** · 承古智，启新知

A production SaaS: a ChatGPT-style conversational AI for Chinese traditional wisdom (I Ching, Taoism, Buddhism, Confucianism, Feng Shui, Ba Zi, Zi Wei Dou Shu, the traditional calendar, classical texts, proverbs, culture and life guidance) grounded in a curated, citation-backed knowledge library.

```
Ask a question → entitlements → retrieval (pgvector, permission-filtered, authority-ranked) → prompt (versioned) → streamed answer with ① ② citations → sources drawer / source viewer
```

## Stack (per IMPORTANT.md)

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Bootstrap 5 + Highcharts → **Cloudflare Pages** (`xuanzhi-a8r.pages.dev`) |
| API | Hono on a **Cloudflare Worker** (`xuanzhi-api`), REST + SSE streaming |
| Database | **PostgreSQL over Hyperdrive**, schema `xuanzhi` in the shared `raishelmy` database, **pgvector** (HNSW) + pg_trgm |
| AI | `IAIProvider` abstraction: Workers AI (open models, no key), OpenAI, Anthropic, Google, OpenAI-compatible. Embeddings: `@cf/baai/bge-m3` (multilingual, 1024-d) |
| Files | R2 (`xuanzhi-files`) |
| Cache | Workers KV (`xuanzhi-cache`) for entitlements / model config |
| Jobs | Cloudflare Queue (`xuanzhi-jobs`) consumer in the same Worker (document processing, summaries) |
| Billing | Stripe (Checkout + Portal + signed webhooks) via REST; admin-assigned plans when Stripe is not configured |
| Auth | Email/password (PBKDF2), Google / Microsoft / Apple OIDC, secure cookie sessions, CSRF header, rate limits, email verification & reset (Resend) |
| Cron | Ubuntu cron → `POST /internal/cron/housekeeping` with `X-Cron-Secret` |

## Repository layout

```
apps/api        Worker: routes, services (ai/, chat/, knowledge/), repositories, migrations, demo docs, tests
apps/web        React app: marketing, auth, chat, explore, knowledge, saved, profile, settings, subscription, admin/*
packages/shared-types   DTOs and enums shared by both
docs/           architecture, database, api, deployment, security
infrastructure/cloudflare/provision.sh
```

## Quick start (local)

```bash
bun install
# 1. Tunnel to Postgres (see docs/database.md) and apply migrations + seed
ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk   # separate terminal
cd apps/api && DATABASE_URL="postgresql://postgres:postgres@localhost:15432/raishelmy" bun run db:migrate
# 2. Secrets
cp .dev.vars.example .dev.vars     # set SESSION_SECRET and ENCRYPTION_KEY (any long random strings)
# 3. Run
bun run dev                        # API on :8787 (wrangler dev; Workers AI + Hyperdrive use remote bindings)
cd ../web && bun run dev           # Web on :5173 (proxies /api)
```

The first account to register becomes `super_admin`. Open **Admin → Knowledge Base → Load demo content** to index the bundled demonstration documents (I Ching, Dao De Jing, Analects, Five Elements, Feng Shui, Classical Wisdom); after ~1 minute the chat answers with citations.

## Commands

| Command | What |
|---|---|
| `bun run typecheck` | API + web + shared types |
| `bun run test` | API unit tests (entitlements, chunking, crypto, provider fallback, CSRF/admin, audit, Stripe signatures) |
| `bun run deploy` | `wrangler deploy` (API) then `wrangler pages deploy` (web) |
| `cd apps/api && bun run db:migrate` | Apply pending `migrations/*.sql` |

## Production

Live: **https://xuanzhi-a8r.pages.dev** (web) · **https://xuanzhi-api.raishelmy97.workers.dev** (API). See [docs/deployment.md](docs/deployment.md).

## Documentation

- [docs/architecture.md](docs/architecture.md) — modules, entitlements, AI providers, RAG pipeline, streaming
- [docs/database.md](docs/database.md) — schema, migrations, pgvector, Hyperdrive caveats
- [docs/api.md](docs/api.md) — REST endpoints and SSE events
- [docs/deployment.md](docs/deployment.md) — environment variables, secrets, provisioning, cron
- [docs/security.md](docs/security.md) — auth, CSRF, rate limiting, key encryption, audit
