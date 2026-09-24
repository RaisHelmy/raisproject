# Rais Fintech

A guided personal-wealth platform: investments, Islamic wealth (Zakat, Shariah, estate planning), family delegation and legacy planning — built around a **UX Guidance System** that always answers *"what should I do next?"*.

**Stack:** React + TypeScript (Vite) · Hono on Cloudflare Workers · **PostgreSQL via Cloudflare Hyperdrive** (database) · **R2** (file storage) · Cloudflare Email Service / Resend (email).

## Run locally

```bash
npm install

# Open a tunnel to the dev Postgres instance (see docs/architecture/future-postgresql-migration.md):
# sshpass -p '...' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk

npm run dev                # Vite + Worker; DB access goes through Hyperdrive's
                            # localConnectionString in wrangler.jsonc, which
                            # points at the tunnel above
```

Open the printed URL, **create an account** — the first account becomes the **administrator**. Email starts in *development mode*: verification links are shown in the app instead of being sent, so the full flow works offline.

## Deploy to Cloudflare

1. Provision the resources (already done for the current Hyperdrive config/DB — see
   `docs/architecture/future-postgresql-migration.md`) and apply the schema:
   ```bash
   npx wrangler r2 bucket create rais-fintech-files
   DATABASE_URL=postgresql://user:pass@localhost:15432/dbname npm run db:migrate:pg
   ```
2. (Optional, for real email via Cloudflare) onboard a sending domain:
   ```bash
   npx wrangler email sending enable yourdomain.com
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

## Email configuration (admin)

Sign in as the admin → **System → Admin**. Choose a provider:

- **Development mode** — nothing is sent; verification links appear in the UI.
- **Cloudflare Email Service** — sends via the `send_email` Worker binding (requires an onboarded domain).
- **Resend** — sends via HTTPS API; paste your API key (stored server-side, never returned to the browser).

Set the from address/name, **Send Test Email** to confirm delivery.

## Quant engine & investment queue

- **Markets** (`/invest/markets`) — the instrument universe (MY & US shares, ETFs, REITs), each flagged **Shariah compliant / non-compliant / needs review** (with the reason), **low/medium/high risk** (annualized volatility + max drawdown), and **past history** (1M/3M/1Y returns, sparkline). Every instrument carries a BUY/HOLD/SELL signal with a full breakdown.
- **Strategy Library** (`/invest/strategies`) — the robo hierarchy, fully visible: **technique → method → algorithm**. Trend Following (SMA 50/200, EMA 12/26, MACD), Mean Reversion (RSI-14, Bollinger 20/2σ, Z-score), Momentum (ROC-20, 90-day momentum, Donchian-55) — plus the **decision library**: aggregators (weighted score, majority vote, unanimous), risk filters (volatility cap, drawdown guard, Shariah screen) and position sizing (fixed fraction, volatility target, capped Kelly).
- **Investment Queue** (`/invest/queue`) — analysis runs and robo orders are **jobs in Postgres**, processed by the worker: immediately via `waitUntil` after enqueue, and by a **cron trigger** (every 2 min) as a safety net in production. Jobs claim atomically, retry up to 3 times, and record their outcome (fill price, quantity, flags, signal at fill). Live orders are refused — at enqueue *and* re-checked at execution — unless live trading was explicitly enabled.

Price history is generated deterministically per symbol (seeded random walk) so analysis is reproducible offline; swap `worker/instruments.ts` for a market-data provider and the whole pipeline above is unchanged.

## Multi-broker investments

- **One platform, many brokers**: Connections center lists all providers (Moomoo live; IBKR, Saxo, Alpaca, Tradier, Trading 212 as honest integration boundaries — `implemented / configured / available / coming_soon`, never fake data). Each card offers **Connect existing account** and, where an affiliate is configured in the database, **Open an account** behind a disclosure dialog.
- **Normalized model in Postgres**: connections → accounts → holdings/transactions/dividends/orders + sync logs, internal UUIDs with provider IDs stored separately; `shariah_status`/`zakat_eligible`/`owner_type` columns reserved for Islamic-wealth and family/estate futures.
- **Sync engine**: adapters → normalization → Postgres; runs on connect, on demand, and via the cron trigger for connections whose interval lapsed. Pages read Postgres, never broker APIs. Legacy Moomoo users (guidance flag only) are backfilled automatically — no reconnect.
- **Consolidated UX**: global account selector (All / provider / account, persists across Portfolio · Holdings · Activity), merged securities across brokers with drill-down, MYR-normalized totals, provider/account breakdowns, clear connection states with Reconnect.
- Docs: `docs/architecture/investment-provider-architecture.md` (+ future PostgreSQL/.NET notes, clearly marked FUTURE / NOT IMPLEMENTED).

## Wealth API & MCP server

- **REST API** at `/api/v1/*` (Cloudflare Worker): full programmatic wealth control — portfolio, holdings, activity, markets/quant analysis, investment queue, theories, rewards. Authenticated with **personal API tokens** (created in Security → API Access; SHA-256-hashed, scoped `read` / `trade`, revocable, last-used auditing). Admin, documents, connection creation and settings stay session-only. Full reference: [`docs/api/wealth-api.md`](docs/api/wealth-api.md).
- **MCP server (Python)** in [`integrations/mcp-python`](integrations/mcp-python/README.md): 18 tools over the same API for Claude Desktop/Code — read the consolidated portfolio, screen Shariah/risk flags, run analyses, queue paper orders. (.NET remains documentation-only future.)

## Suggestions (user → admin)

- 💡 **Suggest buttons** on every predefined-content area (Theory Gallery, Strategy Library, Markets, Connections): users describe an idea; admins review in System → Admin — approve (+150 points to the contributor, awarded once), reject, or mark **implemented** when it ships, each with a note the user sees under Settings → My Suggestions.

## Theory Gallery

- **Investments → Theory Gallery** (`/invest/theories`): an admin-curated library of investment theories users consult for decision making. Each entry carries the theory itself, *when to use it*, *what can go wrong*, source attribution, and **"Put it to work" actions** deep-linking into the live tools (Markets signals, Strategy Library, Robo Trading, dividends). Theories linked to a quant technique (`trend` / `mean-reversion` / `momentum`) connect narrative to the algorithm engine.
- **Admin-managed** (System → Admin → Theory Gallery): add, edit, publish/draft and delete entries; drafts are invisible to users until published. Stored in Postgres (`theories` table, migration 0005) and seeded with 9 starters across technical / risk / Islamic (Shariah screening, dividend purification) / behavioral categories.

## Affiliate & gamification

- **Affiliate** (`/grow/affiliate`) — every user gets a referral code (`RAIS-XXXXXXXX`) and share link (`/signup?ref=CODE`, one-tap share to WhatsApp/Telegram/email). Referrer earns **+200 points** per friend; the friend starts with **+100**. Page shows the tier hero (Bronze → Silver → Gold → Platinum → Diamond with progress to next), community **leaderboard** (privacy-masked names, your row highlighted), referral list, and a points ledger of recent rewards.
- **Achievements** (`/grow/achievements`) — 15 achievements across **Journey** (onboarding, connect, sync, family, legacy, security, verified), **Transaction Growth** (First Trade → Deal Maker 5 → Growth Engine 25 orders; Analyst → Quant Master analyses) and **Affiliate** (The Spark 1 → Connector 3 → Ambassador 10 referrals) — each with live progress bars and a "closest achievement" action card. Evaluation is server-side and idempotent (`worker/gamify.ts`): every point is a `points_ledger` row, awarded exactly once.
- The dashboard shows a rewards card (tier, points, rank), and once setup is complete the recommended-next-step card permanently becomes "Share Rais Fintech".
- **Moomoo registration**: connecting requires an existing Moomoo account — the connection wizard, robo readiness page and empty portfolio all surface the Moomoo MY registration link with the welcome package (RM1,800* new user / RM5,000* transfer rewards, Moomoo's terms apply).

## Architecture

```
worker/            Hono API on Cloudflare Workers
  index.ts         routes: /api/auth, /api/guidance, /api/documents, /api/admin,
                   /api/instruments, /api/robo/*, /api/jobs; scheduled() drains the queue
  auth.ts          PBKDF2 password hashing, Postgres-backed sessions (HttpOnly cookie)
  email.ts         provider dispatch: dev | cloudflare | resend
  instruments.ts   instrument universe + Shariah metadata + deterministic price history
  quant.ts         technique → method → algorithm registry, decision library, analysis
  jobs.ts          Postgres-backed job queue: enqueue, atomic claim, retries
migrations_pg/     PostgreSQL schema (users, sessions, email_tokens, guidance, documents, settings)
src/
  ux/              ── the Rais Fintech UX Guidance System (reusable) ──
    guidance.ts    journey model: setup steps, next-best-action, feature unlocks
    GuidanceContext.tsx  per-user journey state, persisted to Postgres, optimistic + debounced
    components/    AppShell, Sidebar, Breadcrumbs, PageHeader, SetupProgress,
                   NextActionCard, EmptyState, WorkflowStepper, FeatureTour,
                   InfoTip (contextual help), CommandPalette (⌘K), StatusBadge,
                   SuccessState, ErrorState, ConfirmationDialog
  pages/           Onboarding, Dashboard, Portfolio, Robo Trading, Connections
                   (+ Moomoo wizard), Family, Legacy wizard (7 steps), Documents (R2),
                   Zakat, Admin, System, guided stubs for roadmap modules
```

### The guidance system in one paragraph

Journey state (`GuidanceState`) lives in Postgres per user. `nextAction()` derives the single recommended next step shown on the dashboard; `SETUP_STEPS` drives the persistent progress checklist; `isFeatureVisible()` reveals sidebar items (Robo Trading, Legacy, Automation…) progressively as prerequisites complete. Wizards save their step on every change, so **progress is never lost** — leave mid-flow and the dashboard offers *Resume*. Tours are one-time and remembered. Every page follows the same header pattern (breadcrumb → eyebrow → title → description → actions), every empty state explains what belongs there and how to fill it, and every success/error state says what happened, whether data is safe, and what to do next.
