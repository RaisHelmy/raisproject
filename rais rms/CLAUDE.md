# UMAI Research + `CLAUDE.md` for Rais Restaurant Management System

Below is (Part 1) a sourced research summary of UMAI and the "complete restaurant system" landscape, followed by (Part 2) a complete, copy-paste-ready `CLAUDE.md` for the Rais RMS repository.

---

## PART 1 — UMAI RESEARCH SUMMARY

### Company overview
UMAI (umai.io; operating legal entity **UMAI GLOBAL 1 PTE LTD**) is a restaurant/hospitality SaaS **founded in 2016**, headquartered in **Kuala Lumpur, Malaysia**, with a second office in **Singapore** (Claymore Hill). Founders: **Jonas Chelbat** (Founder/CEO) and **Alexander "Alex" Small** (Co-founder/Managing Director); Omar Chelbat appears as Head of UI/UX. The backend is **Ruby on Rails** (per UMAI engineers' LinkedIn posts).

- **Size:** Small company. Third-party trackers diverge on headcount: **PitchBook lists 41 employees; GetLatka lists 24** ("an engineering team of 4"); LinkedIn self-reports the **"11-50 employees"** band. Treat ~40–50 as the working estimate.
- **Funding:** Essentially bootstrapped. **Crunchbase classifies UMAI's sole raise as an "Angel round"** (dated ~Feb 2017); **PitchBook names investors "Segnel Ventures and v7 (Portugal)."** GetLatka lists $0 VC and a ~$6.5M valuation. No major VC rounds.
- **Revenue:** No audited figure exists — all are third-party estimates in the **$2M–$5M** range. **GetLatka's article is titled "How UMAI-Restaurant Software hit $2.2M revenue with a 24 person team"** (a 2020-era figure) and also notes UMAI "raised a M&A Offer in April, 2025" (an ambiguous/empty database field — not a confirmed acquisition). Apps Run The World models ~$5.0M for 2024. LeadIQ currently shows only a "$1M–$10M" band; the "$3.8M" figure could not be reproduced. **All revenue numbers should be treated as unverified estimates.**
- **Scale/reach:** Per the **umai.io homepage: "UMAI serves customers in over 15 countries worldwide and is available in English, Portuguese, Spanish, French, German, Danish, Estonian, Russian, Indonesian, and Vietnamese."** An older, now-outdated restaurant count comes from **Vulcan Post (and KrASIA): "On their website, they boast more than 500 restaurants across 4 countries,"** quoting Alex Small: "We serve all categories of F&B operators from bars on the 50 best in Asia List…to Michelin restaurants, to hotels." The current site quantifies countries but not a hard restaurant count; "thousands of restaurants" is marketing phrasing, not a verifiable figure. Named clients: Troika Sky Dining, La Bodega, Dining In The Dark KL, Wingstop, Hard Rock Cafe KL, Prado, Nobu, plus European clients (strong Portugal presence — RUMI Lisboa, Borboleta/Porto, Onda Cocktail Room Lisbon).

**Target market:** full-service restaurants, hotel restaurants, bars/nightclubs, cafés, and quick-service restaurants — primarily Southeast Asia and Europe. **Positioning:** an "all-in-one restaurant management system"/hospitality CRM that reduces reliance on commission booking marketplaces, emphasizing **flat subscription (no per-cover fees), 100% operator ownership of guest data, and white-label booking**.

### Pricing
- **UMAI 360 starts at ~US$80/month per user** (Capterra), flat subscription, **no per-cover commission**, includes free **Reserve with Google**. Billed monthly/quarterly/bi-annually/annually with discounts. No public free tier or free trial.
- Product bundles: **UMAI 360** (Reservation, Waitlist & Seating Management), **Autopilot** (Loyalty & Automated Marketing), **UMAI 2 Go** (Takeaway & Delivery).
- Independent commentary (OCHI blog) notes that at ~$80/mo it is reservation/CRM-centric and that operators still need separate POS/delivery/inventory tools — i.e., it is **not** a full back-office system.

### Product modules (from umai.io navigation + feature pages)
**Manage**
- **Reservation Management:** real-time inventory, customizable/white-label booking widget, 24/7 self-service guest changes, sister-outlet recommendations when full.
- **Flexible Table Management:** drag-and-drop floor plan; **floor / timeline / calendar / list** views; turn-time adjustments per table size; smart table combinations; yield tools ("Squeeze"/"Short Seat"); "3-click table swaps."
- **Know Your Guest (CRM):** guest profiles with visit + spend history; tags (VIP, allergies, auto-tag first-timers/regulars); guest self-tagging for dietary needs/occasions; seating & dietary preferences; private notes; profiles shared across the group.
- **Feedback & Reputation Management:** automated post-visit surveys via email/SMS/WhatsApp (ambiance, service, value, meal); **private feedback routing** to catch issues before they go public; funnels happy guests to Google/TripAdvisor.
- **Reduce No-Shows:** deposits, card authorization/hold, prepaid, cancellation fees, pre-orders; rules by busy day/time/party size; **Stripe** same-day payouts; payment links via SMS/WhatsApp (incl. phone reservations).
- **Analytics & Insights:** reservation analytics, new vs. repeat guests, no-show trends, campaign ROI, exportable reports with permission controls.
- **Improve Guest Communication:** automated confirmations/reminders across channels.
- **Queue/Waitlist Management:** SMS-powered digital waitlist; notify guests as tables open.
- **Boost Table Efficiency / Expand Seating Capacity.**
- **Mobile App:** UMAI 360 **iPad** front-of-house app (floor plan, guestbook, feedback, analytics).
- **UPhone / Enhanced Phone Reservations:** caller ID with guest insights; missed-call auto follow-up with booking links.

**Grow:** Automated Marketing (behavioral campaigns — birthdays, win-backs, top spenders — with ROI tracking); Build Loyalty (restaurant-owned loyalty/membership, no app required); Email Marketing; Website Builder (drag-and-drop).

**Sell:** Promote Experiences & Add-ons (pre-sell high-margin items, chef's counters, tasting menus, events; upsells at booking); Sell Online (Events & Tickets, prepaid experiences); Offer Takeaway (UMAI 2 Go — online menu, pickup/delivery times, online payment, "only paid orders reach the kitchen," launched during COVID-19 in March 2020); Gift Cards & Vouchers.

### Integrations & channels
**Stripe** (payments/payouts), **Reserve with Google**, **Instagram** and **Facebook** booking, Google Tag Manager, Meta Pixel. POS integration is offered but is **repeatedly cited by reviewers as a relative weakness** ("smoother integration with certain POS systems…would help"). Cross-property guest tracking across a group is a highlighted differentiator.

### UI/UX patterns
iPad-first FOH app; multi-view service screen (floor plan / timeline / calendar / list); drag-and-drop table assignment; multi-panel guestbook; guest-profile panels with tags and history; analytics dashboards with charts; branded/white-label booking widget.

### Competitor context — what a "complete system" includes
Reservation/CRM peers: OpenTable, Resy, **SevenRooms**, Tock, Chope, TableCheck, Eat App, TheFork, CoverManager, Zenchef, TableApp, Oddle. Note the market is consolidating: **SevenRooms was acquired by DoorDash for $1.2B all-cash (announced May 6, 2025; closed June 13, 2025** — DoorDash's FY2025 10-K states "the acquisition date fair value of the consideration transferred for SevenRooms was $1,152 million," and Restaurant Dive reports it extends DoorDash to "over 13,000 dining, hotel, nightlife and entertainment venues globally").

A genuinely "complete" restaurant system typically adds — **beyond reservations/CRM** — POS, menu management, online ordering / QR order-and-pay, KDS (kitchen display), inventory/stock control, staff scheduling, multi-location management, delivery/driver management, and accounting/reporting. **Toast** positions itself as "the all-in-one platform built for restaurants…across point of sale, operations, digital ordering and delivery, marketing and loyalty, and team management," and **Restaurant365** is "a complete accounting and back office solution built specifically for restaurants" (~$500–$700 per location/month). **Takeaway:** UMAI sits on the guest-experience/CRM side with light "sell" extensions; because Rais is pitched as a *complete* system, it should add the true operational modules UMAI lacks — **POS, menu management, QR/online ordering, inventory, and staff scheduling**.

---

## PART 2 — `CLAUDE.md`

Copy the block below into the repository root as `CLAUDE.md`.

```md
# CLAUDE.md — Rais Restaurant Management System (Rais RMS)

This file gives Claude Code the context and hard rules for working in this repository. Read it fully before generating or editing code. When rules here conflict with generic best practices, follow the rules here.

## 1. Project Overview & Purpose
Rais RMS is a **multi-tenant SaaS** and a *complete* restaurant management system, inspired by UMAI (umai.io). Each tenant is a single restaurant OR a restaurant group; a tenant owns one or more outlets (venues/locations). The product spans:
- **Front of house:** reservations, table/floor management, waitlist, guest CRM, no-show protection.
- **Growth:** marketing campaigns, loyalty, feedback/reviews.
- **Complete-system operations (beyond UMAI):** menu management, online/QR ordering, POS-lite, inventory, staff scheduling.
- **Cross-cutting:** analytics/reporting, multi-outlet group management, roles/permissions.

Primary users: restaurant owners/groups (tenant admins), outlet managers, hosts/servers (FOH), marketing staff, and diners (guest-facing booking/ordering widgets).

Design north star: operator-owned guest data, flat-subscription multi-tenant SaaS, fast during service, white-labelable booking/ordering surfaces.

## 2. Tech Stack (with conventions & rationale)
- **Runtime / package manager / test runner: Bun** (target Bun 1.2+). Use `bun` for everything: `bun install`, `bun run`, `bun test`. Do NOT introduce npm/yarn/pnpm lockfiles. Commit `bun.lock`.
- **Frontend: React 18+** as an SPA, built with Vite. TypeScript everywhere, `strict: true`.
- **Hosting: Cloudflare Pages** for the static React app, with **Pages Functions** (the `/functions` directory) for the API/backend. Keep everything Cloudflare-native.
- **API framework: Hono** running inside Pages Functions (Workers-runtime compatible). A single Hono app mounted under `/api` via a catch-all Pages Function is the standard pattern.
- **Database: Postgres, accessed through Cloudflare Hyperdrive** (migrated off D1/SQLite — see the "Database migration note" below). The `HYPERDRIVE` binding provides `connectionString`; `api/lib/db.ts` wraps a `postgres` (postgres.js) client behind a small D1-shaped `AppDatabase` interface (`prepare().bind().all()/.first()/.run()`, `db.batch()`) exposed to the rest of the app as `env.DB`, so the repository layer in `api/db/` is unchanged from the D1 era.
- **Object storage: Cloudflare R2** for images/menus/exports/receipts, accessed via the `BUCKET` binding.
- **Styling: Bootstrap 5 via `bootstrap.min.css`** (plain CSS classes). Import the stylesheet once at app root. Use utility/grid/component classes directly in JSX (`className="btn btn-primary"`). Do NOT add React-Bootstrap, reactstrap, Tailwind, MUI, or CSS-in-JS. Custom styles go in a small `app.css` built on Bootstrap variables.
- **Charts: Highcharts** (`highcharts` + `highcharts-react-official`) for all analytics/reporting charts.
- **Auth: session JWT in an httpOnly cookie**, tenant resolved server-side per request.

Rationale: the whole stack runs on Cloudflare's edge with zero server management; Bun gives fast installs/tests; Hyperdrive+R2 avoid egress fees and sit next to the Functions; Bootstrap + Highcharts are plain and dependency-light.

**Database migration note (D1 → Postgres/Hyperdrive):** this project originally used Cloudflare D1 (SQLite). It has been migrated to Postgres reached via Cloudflare Hyperdrive (account-wide config `raishelmy-hyperdrive`, id `7a7777560d434c2b91ff37c52ab1b2c9`), which points at the ONE shared Postgres database `raishelmy` used by every app on the account. This app's tables live in their own schema, `raisrms`, inside that shared database (not a dedicated `raisrms_db` database) — `api/lib/db.ts` sets `search_path=raisrms` on the postgres.js connection so the unqualified table names throughout `api/db/` resolve there. The old D1 SQL migrations remain in `migrations/` for history but are no longer applied; the live schema lives in `migrations_pg/`. Local/direct SQL access (drizzle-kit-style tooling, ad-hoc `psql`) goes through an SSH tunnel to the shared Postgres origin rather than `wrangler d1`, with `search_path` set to `raisrms`.

**Version pinning:** pin `BUN_VERSION` in Pages build settings (Cloudflare's default Bun lags latest and can silently fall back to npm if `bun.lock` isn't detected). Set an explicit `compatibility_date` in `wrangler.toml`; enable `nodejs_compat` only when a dependency truly needs it (prefer Web APIs).

## 3. Repository Structure (single app: Bun + React + Pages Functions)
```
/
├── CLAUDE.md
├── package.json
├── bun.lock
├── wrangler.toml
├── tsconfig.json
├── vite.config.ts
├── public/                      # static assets copied as-is
├── src/                         # React SPA (frontend)
│   ├── main.tsx                 # imports bootstrap.min.css once
│   ├── app.css
│   ├── routes/                  # route-level pages
│   ├── components/              # shared UI (PascalCase.tsx)
│   ├── features/                # feature modules (reservations/, guests/, ...)
│   ├── lib/                     # api client, auth context, formatters
│   └── charts/                  # Highcharts wrappers
├── functions/                   # Cloudflare Pages Functions (the API)
│   └── api/
│       └── [[route]].ts         # catch-all -> mounts the Hono app
├── api/                         # backend source imported by functions/
│   ├── app.ts                   # Hono app + middleware chain
│   ├── middleware/              # auth, tenant resolver, error, validation
│   ├── routes/                  # one router per module
│   ├── db/                      # tenant-scoped repositories / query helpers
│   └── lib/                     # r2, jwt, hashing, validators (zod)
├── migrations/                  # legacy D1/SQLite migrations (kept for history, no longer applied)
├── migrations_pg/               # live Postgres migrations (0001_*.sql, ...), applied via psql/Hyperdrive
├── shared/                      # types/zod schemas shared FE + BE
└── tests/                       # bun test specs
```
Frontend build output goes to `dist/`; set `pages_build_output_dir = "dist"`. `functions/` is deployed automatically by Pages.

## 4. Commands
```bash
# install
bun install

# frontend dev (Vite)
bun run dev

# full local stack (Pages + Functions + Hyperdrive + R2 bindings, per wrangler.toml)
bunx wrangler pages dev

# tests (use an in-memory bun:sqlite AppDatabase shim, not Postgres — see tests/helpers/d1-shim.ts)
bun test
bun test --watch

# typecheck + generate binding types
bun run typecheck
bunx wrangler types

# Postgres migrations — apply migrations_pg/*.sql through the SSH tunnel to the origin
# (Hyperdrive itself isn't reachable for direct psql/drizzle-kit access):
#   sshpass -p '...' ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/raishelmy?sslmode=require" bun run db:migrate  # applies migrations_pg/*.sql with search_path set to schema `raisrms`

# R2
bunx wrangler r2 bucket create rais-assets
bunx wrangler r2 object put rais-assets/<key> --file ./x.png

# deploy
bun run build && bunx wrangler pages deploy dist
```
Ensure the Pages build command runs `bun install && bun run build`, and `BUN_VERSION` is set, so Cloudflare does not silently fall back to npm.

## 5. Architecture
- **Frontend (React SPA on Pages):** talks to the API only via `/api/*` using a small typed fetch client (`src/lib/api.ts`). The session cookie carries auth; the client never sees secrets. Client-side routing; charts via Highcharts wrappers.
- **API (Pages Functions):** `functions/api/[[route]].ts` imports and delegates to the Hono app in `api/app.ts`. Middleware order: request-id → error boundary → auth (verify JWT cookie) → **tenant resolver** → validation (zod) → handler.
- **Tenant resolution:** resolve tenant from (a) subdomain (`resto-name.rais.app`) OR (b) a signed `tenant_id` claim in the session JWT, with an optional `X-Tenant-Id` header honored ONLY for platform-superadmin tokens. Attach the resolved id via `c.set('tenantId', ...)`; it is the ONLY source of truth for scoping. Never trust a `tenant_id` from a request body/query.
- **Database access:** thin repository functions in `api/db/`, unchanged from the D1 era — they call `db.prepare(...).bind(...).all()/.first()/.run()` and `db.batch()` against `env.DB`, which `functions/api/[[route]].ts` now constructs from `env.HYPERDRIVE` via `api/lib/db.ts` (a postgres.js client behind the same D1-shaped interface). Every query is tenant-scoped (see §6). Bound params only.
- **R2 usage:** images/menus/exports/receipts. Keys are namespaced per tenant (see §6). Uploads go through a Function that (a) checks auth+tenant, then (b) either streams small files through the Function to `BUCKET.put()`, or (c) returns a short-lived presigned PUT URL (via `aws4fetch`, which is Workers-compatible — the AWS SDK v3 is NOT) for direct browser upload of large files.
- **Env bindings (`wrangler.toml`):**
```toml
name = "rais-rms"
compatibility_date = "2025-05-01"
compatibility_flags = ["nodejs_compat"]  # only if a dep needs it
pages_build_output_dir = "dist"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "7a7777560d434c2b91ff37c52ab1b2c9"  # account-wide "raishelmy-hyperdrive" config, database `raishelmy`

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "rais-assets"

[vars]
APP_ENV = "production"
# Secrets (JWT_SECRET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, STRIPE_SECRET_KEY)
# are set via `wrangler pages secret put` / the dashboard — NEVER in this file.
```

## 6. Multi-Tenancy Rules (HARD RULES — do not violate)
1. **Every business table has a non-null `tenant_id`** (TEXT UUID) and, where relevant, an `outlet_id`. The only tables without `tenant_id` are the global `tenants` table and platform-level tables.
2. **Every query filters by `tenant_id`** — reads AND writes. No `SELECT/UPDATE/DELETE` on a tenant table without `WHERE tenant_id = ?` bound to the request's resolved tenant.
3. **`tenant_id` comes only from the authenticated session/subdomain**, never from client input (except superadmin).
4. **The repository layer enforces it:** every `api/db/` function takes `tenantId` as its first argument and injects it into the SQL. Do not write ad-hoc SQL in route handlers.
5. **R2 keys are prefixed per tenant:** `tenants/{tenant_id}/{outlet_id}/{collection}/{uuid.ext}`. Never read/write an R2 key outside the request's tenant prefix.
6. **Cross-tenant access is a security bug.** After fetching by id, assert the row's `tenant_id` equals the request tenant before returning; return 404 (not 403) to avoid leaking existence.
7. **Composite indexes lead with `tenant_id`** (e.g. `(tenant_id, outlet_id, starts_at)`).
8. **Tests must include a tenant-isolation test** for every tenant-scoped endpoint (tenant A must never see tenant B's rows).

## 7. Data Model & Postgres Schema Conventions
Conventions: table names `snake_case` plural; PKs are TEXT UUID (`id`, app-generated via `crypto.randomUUID()` — no `SERIAL`/`IDENTITY`); timestamps named `created_at`/`updated_at` as **BIGINT epoch ms** (this was `INTEGER` under SQLite/D1, but Postgres's `INTEGER` is 32-bit and epoch-ms values overflow it — see `migrations_pg/`); money in **minor units INTEGER** (cents) plus `currency` TEXT; booleans stored as **INTEGER 0/1** (kept as-is post-migration, deliberately not converted to native `boolean`, so application code that binds/reads `1`/`0` didn't need to change); enums as TEXT with a `CHECK`; small floating-point columns (table x/y, inventory quantities) as `DOUBLE PRECISION`. Always include `tenant_id` + indexes. One migration per change, immutable once merged, numbered `0001_`, `0002_`, …, under `migrations_pg/` (the historical `migrations/` SQLite versions are frozen).

Core entities:
- **tenants** (id, name, slug/subdomain, plan, status, created_at) — the only global table.
- **outlets** (id, tenant_id, name, timezone, address, phone, currency, settings JSON) — venues in a group.
- **users** (id, tenant_id, email, password_hash, name, status) + **roles** / **user_outlet_roles** (RBAC: owner, group_admin, outlet_manager, host, server, marketing, read_only).
- **guests** (id, tenant_id, name, email, phone, marketing_consent, dob) — group-level CRM; dedupe on (tenant_id, phone/email). **guest_tags** (VIP, allergy, regular, occasion), **guest_notes**.
- **areas** (id, tenant_id, outlet_id, name — Patio/Bar/Indoor) and **tables** (id, tenant_id, outlet_id, area_id, label, seats_min, seats_max, x, y, combinable).
- **services** / **shifts** (id, tenant_id, outlet_id, name — Lunch/Dinner, days_of_week, start/end, pacing/capacity rules, turn_time_by_party_size JSON).
- **reservations** (id, tenant_id, outlet_id, guest_id, service_id, starts_at, party_size, status [booked/seated/completed/no_show/cancelled], table_ids JSON, source [widget/google/instagram/facebook/phone/walkin], deposit_id, notes).
- **waitlist_entries** (id, tenant_id, outlet_id, guest_id, party_size, quoted_wait, status).
- **tickets_events** (id, tenant_id, outlet_id, name, starts_at, price_minor, capacity) + **ticket_orders** (prepaid experiences).
- **payments** (id, tenant_id, outlet_id, guest_id, reservation_id, type [deposit/preauth/prepaid/cancellation_fee/order], amount_minor, currency, provider [stripe], provider_ref, status).
- **campaigns** (id, tenant_id, channel [email/sms/whatsapp], segment JSON, trigger [birthday/winback/manual], status) + **campaign_sends** (guest_id, sent_at, opened, converted, revenue_minor).
- **feedback** (id, tenant_id, outlet_id, reservation_id, guest_id, scores JSON [ambiance/service/value/food], comment, is_private, routed_to_public).
- **menus** (id, tenant_id, outlet_id) → **menu_sections** → **menu_items** (price_minor, tags, image_r2_key, available).
- **orders** (id, tenant_id, outlet_id, type [dine_in/qr/takeaway/delivery], table_id, status, total_minor) + **order_items** (menu_item_id, qty, modifiers JSON) — POS-lite / QR ordering.
- **inventory_items** (id, tenant_id, outlet_id, name, unit, qty_on_hand, par_level) + **inventory_movements**.
- **staff_shifts** (id, tenant_id, outlet_id, user_id, starts_at, ends_at, role) — scheduling.
- **audit_log** (id, tenant_id, user_id, action, entity, entity_id, at).

Example migration style (`migrations/0002_reservations.sql`):
```sql
-- 0002_reservations.sql
CREATE TABLE reservations (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  outlet_id    TEXT NOT NULL,
  guest_id     TEXT,
  service_id   TEXT,
  starts_at    INTEGER NOT NULL,          -- epoch ms
  party_size   INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'booked'
               CHECK (status IN ('booked','seated','completed','no_show','cancelled')),
  source       TEXT NOT NULL DEFAULT 'widget',
  table_ids    TEXT,                       -- JSON array
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_res_tenant_outlet_time ON reservations (tenant_id, outlet_id, starts_at);
CREATE INDEX idx_res_tenant_guest       ON reservations (tenant_id, guest_id);
```

## 8. Feature Modules (scope, mapped from UMAI + complete-system extras)
1. **Reservations** — white-label booking widget, real-time availability, self-service change/cancel, sources (widget/Google/Instagram/Facebook/phone/walk-in), confirmations/reminders.
2. **Table & Floor Management** — drag-and-drop floor plan per area; floor/timeline/calendar/list views; turn times by party size; table combinations; pacing/capacity rules.
3. **Waitlist / Queue** — digital queue, SMS notify-when-ready, quoted waits.
4. **Guest CRM** — group-level profiles, visit/spend history, tags (VIP/allergy/regular), notes, seating/dietary prefs, self-tagging, dedupe, consent.
5. **No-Show Protection & Payments** — deposits, card pre-auth/hold, prepaid, cancellation fees, pre-orders; rules by day/time/party size; Stripe.
6. **Tickets / Events / Experiences** — prepaid experiences, chef's counters, tasting menus, capacity, add-ons/upsells at booking.
7. **Marketing Campaigns** — email/SMS/WhatsApp, segments, triggers (birthday/winback/top-spender), ROI tracking.
8. **Loyalty** — restaurant-owned points/membership, no app required.
9. **Feedback & Reviews** — post-visit surveys, private feedback routing, funnel to Google/TripAdvisor.
10. **Analytics & Reporting** — reservations, new vs repeat, no-show trends, covers/yield, campaign ROI, exports (Highcharts UI).
11. **Multi-Outlet / Group** — group vs outlet scoping, cross-outlet guest view, sister-outlet availability.
12. **Roles & Permissions** — RBAC per tenant/outlet.
13. **Menu Management** — menus/sections/items, images (R2), availability. *(complete-system extra)*
14. **Online / QR Ordering** — dine-in QR order-and-pay, takeaway/delivery, "only paid orders reach the kitchen." *(extra)*
15. **POS-lite** — order/check management, payments. *(extra)*
16. **Inventory** — stock, par levels, movements. *(extra)*
17. **Staff Scheduling** — shifts/rosters per outlet. *(extra)*
18. **Website Builder / Gift Cards & Vouchers** — later phase.

## 9. Frontend Conventions
- **React + Bootstrap 5 plain classes.** Import `bootstrap.min.css` once in `main.tsx`. Use `className` with Bootstrap utilities/grid/components. Avoid Bootstrap's JS bundle unless needed; prefer small React state for toggles/modals, or import a specific Bootstrap JS behavior deliberately.
- **Component organization:** `src/features/<module>/` holds that module's components, hooks, and API calls; truly shared UI in `src/components/`. PascalCase component files, camelCase hooks (`useReservations.ts`).
- **State:** local state + TanStack Query (React Query) for server state/caching; avoid Redux unless a clear need. Auth via a context provider reading the session.
- **Routing:** React Router; route-per-page under `src/routes/`. Guard routes by role.
- **Forms:** controlled components + zod schemas from `shared/`; show Bootstrap validation styles (`is-invalid`, `.invalid-feedback`).
- **Highcharts pattern:** wrap in a small component; never mutate the DOM directly; import as a module (not a CDN script).
```tsx
// src/charts/CoversChart.tsx
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

export function CoversChart({ categories, data }: { categories: string[]; data: number[] }) {
  const options: Highcharts.Options = {
    title: { text: "Covers by day" },
    xAxis: { categories },
    series: [{ type: "column", name: "Covers", data }],
    credits: { enabled: false },
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
```
Recreate `options` from props and let the wrapper handle updates.

## 10. API Conventions
- **REST under `/api`**, resource-plural nouns, nested under outlet where natural:
  `GET /api/outlets/:outletId/reservations`, `POST /api/outlets/:outletId/reservations`, `GET /api/guests/:id`, `POST /api/campaigns`. Tenant is implicit from the session — it is NOT in the path.
- **Response envelope:**
```json
{ "ok": true, "data": {}, "meta": { "page": 1, "pageSize": 50, "total": 123 } }
{ "ok": false, "error": { "code": "VALIDATION", "message": "...", "details": [] } }
```
- **HTTP status:** 200/201 success; 400 validation; 401 unauthenticated; 403 wrong role; 404 not found (also used to avoid leaking cross-tenant existence); 409 conflict; 429 rate limit; 500 unexpected.
- **Validation:** zod on every input (body/query/params) via middleware; reject unknown fields.
- **Pagination:** cursor or `page`/`pageSize` (default 50, max 100); always tenant-scoped; return `meta.total` when cheap.
- **Idempotency:** accept an `Idempotency-Key` header on payment/order POSTs.
- **Dates/money:** epoch-ms integers; money in minor units + currency.

## 11. Coding Standards, Testing, Security, Performance
- **Standards:** TypeScript strict; shared types/zod in `shared/`; no `any` in domain code; small pure functions in repositories; thin handlers.
- **Testing (`bun test`):** unit tests for repositories/validators; integration tests hitting the Hono app against an in-memory `bun:sqlite`-backed `AppDatabase` fixture (`tests/helpers/d1-shim.ts` — kept on SQLite deliberately, for hermetic/fast CI; it is not a substitute for exercising real Postgres dialect); **every tenant-scoped endpoint gets a cross-tenant isolation test**; test payment/deposit state machines and no-show logic.
- **Security:**
  - Validate ALL input (zod). Never string-concat SQL — bound params only.
  - Enforce tenant scoping in the repository layer (see §6).
  - Secrets ONLY via Cloudflare env/secrets (`wrangler pages secret put`) — NEVER committed, not in `wrangler.toml`, code, or client.
  - JWT in httpOnly, Secure, SameSite cookies; short expiry + refresh; hash passwords with a Workers-compatible algorithm (PBKDF2 via WebCrypto, or argon2/scrypt via a WASM lib) — do NOT use Node `crypto` unless `nodejs_compat` is on.
  - RBAC checks on every mutating endpoint.
  - R2: presign short-lived URLs; validate content-type/size; never expose R2 credentials to the browser; set bucket CORS narrowly (do not sign `Content-Type` for browser PUTs with `aws4fetch`).
- **Performance — Postgres/Hyperdrive:** add indexes leading with `tenant_id`; avoid full scans; use `db.batch()` (wraps a `sql.begin()` transaction — see `api/lib/db.ts`) for multi-writes; Hyperdrive pools/caches connections at the edge, but the Worker-side `postgres` client is still capped at `max: 5` connections per isolate, so avoid holding long-running transactions. Keep large blobs in R2 and store only the R2 key in the DB (D1's hard row-size/column-count/db-size caps no longer apply, but there's still no reason to put blobs in Postgres rows).
- **Performance — R2:** stream uploads; use presigned PUT for large files; cache public assets via the Cache API; key by tenant prefix.

## 12. Things Claude Should NOT Do (gotchas)
- **Do NOT use Node-only APIs** (`fs`, `net`, raw `node:crypto` without `nodejs_compat`, `process` assumptions) in Functions — this is the Workers runtime. Prefer Web APIs (`fetch`, WebCrypto, `crypto.randomUUID()`).
- **Do NOT use the AWS SDK v3 for R2 in Functions** (it depends on browser/Node APIs like DOMParser and fails on Workers) — use `aws4fetch` for presigning, or the native `BUCKET` binding.
- **Do NOT bypass tenant scoping** or trust a client-supplied `tenant_id`.
- **Do NOT use React-Bootstrap / reactstrap / Tailwind / MUI / CSS-in-JS** — plain `bootstrap.min.css` classes only.
- **Do NOT add npm/yarn/pnpm** — Bun only; keep `bun.lock`.
- **Do NOT store images/large blobs in the Postgres DB** — use R2, store only the key.
- **Do NOT put secrets in the repo or `wrangler.toml`** — use Cloudflare secrets.
- **Do NOT introduce a heavy ORM** without explicit tenant scoping; the current `AppDatabase` shim in `api/lib/db.ts` (postgres.js behind a D1-shaped interface) exists specifically so the `api/db/` repository layer didn't need a rewrite during the D1→Postgres migration — extend it rather than bypassing it with ad-hoc `postgres` calls in route handlers.
- **Do NOT assume BIGINT columns come back as JS numbers by default from postgres.js** — `api/lib/db.ts` registers a custom type parser to coerce them (epoch-ms timestamps and COUNT/SUM aggregates are all safely within `Number.MAX_SAFE_INTEGER` for this app); if you add a raw `postgres.js` client elsewhere, replicate that or you'll get strings.
- **Do NOT load Highcharts from a CDN `<script>`** — import it as a module.
- **Do NOT write cross-outlet/cross-tenant joins** without an explicit tenant filter on every table in the join.

## 13. Roadmap / Phases
- **Phase 1 (MVP core):** tenants/outlets/users/roles, auth + tenant resolution, guest CRM, reservations + table/floor management, waitlist, booking widget, confirmations/reminders, basic analytics.
- **Phase 2 (revenue protection & growth):** deposits/no-show (Stripe), tickets/experiences, feedback/reviews, marketing campaigns (email first, then SMS/WhatsApp), loyalty.
- **Phase 3 (complete system):** menu management, QR/online ordering + takeaway/delivery, POS-lite, inventory, staff scheduling.
- **Phase 4 (scale/polish):** multi-outlet group dashboards, advanced analytics/exports, website builder, gift cards/vouchers, Reserve-with-Google/Meta channels, POS integrations, white-label domains per tenant.

Change triggers: advance to Phase 3 only once Phase 1–2 tenant-isolation tests are green and a real pilot tenant is live; add third-party POS integrations only when a paying group requires it.
```

---

### Notes, caveats & source quality
- **UMAI's own marketing pages** (umai.io) are the source for the module list, pricing bundles, and channel integrations — reliable for *what the product does*, but promotional in tone (e.g., "thousands of restaurants" is unquantified).
- **Company facts** (2016 founding, KL HQ + Singapore office, founders, Rails backend) are corroborated across LinkedIn, Crunchbase, PitchBook, and Vulcan Post.
- **Scale/revenue/headcount figures conflict across third-party trackers** (Crunchbase, PitchBook, GetLatka, Tracxn, LeadIQ, Apps Run The World) and are **estimates, not company-confirmed** — I have flagged each rather than picking one. The only precise restaurant count ("500+/4 countries") is from 2021 and outdated; the current, primary-source figure is "over 15 countries."
- **Pricing (~$80/mo, UMAI 360)** comes from Capterra/aggregators, not a public UMAI pricing page (UMAI gates pricing behind a demo). Treat as indicative.
- **POS as a weak spot** is a recurring theme in user reviews (G2, OCHI) — a concrete opportunity for Rais, which is why the `CLAUDE.md` treats POS/menu/inventory/scheduling as first-class Phase 3 modules rather than integrations.
- **Cloudflare technical limits** in §11 are quoted from Cloudflare's official D1 limits documentation and are current as of 2025–2026; re-verify `compatibility_date` and Bun defaults at build time, as Cloudflare's Pages build image and default Bun version change periodically.