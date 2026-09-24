# CLAUDE.md — Anonymous On-Demand Marketplace (KL/Selangor)

> Save this as `CLAUDE.md` in the repo root. Claude Code reads it every session.

---

## Role

You are building an MVP for a three-sided on-demand marketplace. Work in small,
reviewable steps. Before starting a new area, show a short plan and wait for "go".
Do not scaffold the whole app in one shot. If a requirement here is ambiguous or
looks legally/financially risky, stop and ask instead of guessing.

## Product summary

An on-demand marketplace like Grab and Lalamove, launching in Kuala Lumpur and
Selangor, with two differences:

1. Users may operate **anonymously** toward other users.
2. Users can form **groups/societies** inside the platform (a runner fleet, a
   vendor association, a campus, a condo community) with their own settings.

Launch does not require vendors. Delivery and fetch jobs work with zero vendors
onboarded; the vendor catalogue comes later.

## User groups

1. **Purchaser** — five request types: food order, item order, fetch/pickup task,
   delivery task, and passenger ride (ride-hailing — see "Passenger transport").
2. **Runner** — accepts and executes jobs.
3. **Vendor / Seller** — merchant with a catalogue. **Vendor is the merchant of
   record** for goods sold; the platform is an intermediary.
4. **Admin** — internal staff. No self-signup. Full visibility, always.

One person may hold several roles. Model as many-to-many `user_roles`. Never an
enum column on the user.

---

## Anonymity

### Scope
- Anonymity is **mutual and display-level only**: purchaser hidden from runner/vendor,
  and runner/vendor hidden from purchaser. Each side sees a generated handle
  (`Runner #A72K`, `Buyer #9QJD`) and a masked contact channel.
- **Admin always sees real identity.** There is no mode where the platform cannot
  identify a user. Anonymity never reduces what is stored or logged — masking happens
  at the display layer only.
- Phone and chat are relayed/masked. Never expose a raw phone number between users.

### Verification tiers
- `unverified` — anonymous accounts. Permanently unverified. They can register,
  work, and order, but can **never** obtain the Verified badge while anonymous.
- `verified` — completed identity check by admin.
- Verified users get: vouchers, better job priority, higher order value limits,
  and eligibility for COD by default. Build the perk system as a rules table, not
  hardcoded `if` statements, so marketing can tune it.

### Consent warnings
Show a **blocking modal** the user must tick "I understand" on, before enabling
anonymous mode, listing: fewer counterparties will accept their jobs, disputes are
harder to win, COD is off by default for them, and the platform still retains
their real identity. Log the consent event with timestamp and the exact warning
text version shown.

### Cash-on-delivery risk flow
- The purchaser is warned **twice** about COD obligations: once at anonymity opt-in,
  once at checkout when selecting cash.
- Runners and vendors each have an **`auto_reject_anonymous_cod` toggle, ON by
  default.** Anonymous COD jobs are simply not shown to them unless they opt in.
- If a counterparty opts in and the purchaser then doesn't pay, **the loss falls on
  the party who accepted the job.** State this in plain language in the opt-in
  screen and log that acknowledgement. The platform does not reimburse.
- Track non-payment incidents against the real identity, not the handle, and
  auto-suspend after a configurable threshold.

### Law enforcement
Process: provide only what is already stored, on a documented request. Build an
admin "identity disclosure" action that requires a reason field and is itself
written to the audit log, so every lookup of a real identity is traceable.

---

## Money

### No stored value — hard rule

**The platform holds no customer balance. There is no wallet and no top-up.**
This is a deliberate regulatory decision, not a missing feature. See the
compliance note at the bottom of this file before anyone proposes adding one.

- Payment methods, pluggable behind one interface: `cash` and `gateway`.
- `gateway` charges the purchaser **per transaction** at the point of the order.
  Funds settle to the vendor or runner; the platform's flat fee is split out at
  settlement. No customer funds ever rest in a platform-held balance.
- **Commission is a flat fee per successful transaction**, not a percentage.
  Charged only on jobs that reach `settled`. Cancelled, failed, and disputed jobs
  are never charged. Configurable per job type, per group, and overridable by
  voucher. Never hardcode the amount.

### Collecting the fee on cash jobs

On a cash job the money never passes through the platform, so the flat fee cannot
be split out at settlement. Handle it as an **accrued fee receivable**:
- On settlement, write a ledger entry putting the runner (or vendor) in debt to the
  platform for the flat fee.
- Net that debt against their weekly payout.
- If a party's accrued unpaid fees exceed a configurable threshold, stop showing
  them cash jobs until they clear it. Build this threshold check into job matching
  from the start.
- **Payouts weekly** to runners and vendors, on a fixed cycle. Build a payout batch
  entity with its own status and audit trail.
- **Purchase-on-behalf: the runner fronts the item cost.** The purchaser's payment
  must therefore reimburse the runner's outlay plus the delivery fee. Model the
  runner's outlay as a distinct ledger entry — it is not platform revenue and must
  never be netted into commission.
- **Fetch jobs: the purchaser declares the item value.** Use the declared value to
  set a cap on runner outlay and to gate which runners see the job. Declared value
  is a purchaser attestation — log it, and use it in dispute resolution.
- **Double-entry ledger.** Every money movement writes balanced debit/credit rows.
  Amounts owed to runners and vendors, and fees they owe the platform, are
  derived from the ledger, never stored as a mutable column.
- Money as integer minor units (sen). Never floats.
- Idempotency keys on every payment operation. Webhooks must be replay-safe.
- Never store raw card data.

---

## Jobs and matching

- Lifecycle state machine: `draft → posted → claimed → picked_up → in_transit →
  delivered → settled`, plus `cancelled` and `disputed`. Every transition is
  validated server-side and logged. No client-driven status jumps.
- **Claiming is first-come-first-serve with a 60-second priority window**: for the
  first 60 seconds after posting, only priority runners can claim. After that, open
  to all eligible runners. Priority tier is configurable (verified status, rating,
  group membership, completion count).
- **Live GPS tracking from day one.** Runner app streams location while a job is
  active; purchaser sees it on a map. Store the track for dispute evidence, with a
  defined retention period. Stop tracking the moment the job reaches a terminal
  state — do not track idle runners.
- Proof of delivery (photo, signature) uploaded to R2, linked to the job.

## Price negotiation

- Jobs post with an asking price (`deliveryFeeMinor`), same as today. Runners
  can either claim at the asking price (default FCFS path, unchanged) or
  submit a counter-offer instead of claiming.
- A counter-offer does not consume the FCFS priority window and does not
  itself claim the job — the purchaser must accept it. Accepting a
  counter-offer atomically: sets the job's `deliveryFeeMinor` to the
  accepted amount, assigns the runner, moves the job to `claimed`, and
  rejects/expires every other pending offer on that job. All of this is one
  server-validated transition, logged like any other.
- Multiple runners may have offers outstanding on the same job at once;
  whichever the purchaser accepts first wins, the rest are auto-rejected.
- **Tolls are the runner's cost, always.** Before a runner can claim or
  submit a counter-offer, show a blocking acknowledgement (same pattern as
  the anonymity/COD warnings) stating: check the route for toll roads
  before committing, and any toll cost is the runner's own — never
  reimbursed by the purchaser or the platform. There is no separate toll
  field; if a runner wants to price it in, it goes into their counter-offer
  amount. Log the acknowledgement the same way as other consent events.

## Runner vehicles

- A runner may register more than one vehicle (e.g. a motorcycle for delivery
  jobs, a car for ride jobs). A vehicle is its own entity linked to the
  runner, not a handful of columns bolted onto the user.
- Fields collected per vehicle: `vehicleType` (`motorcycle` | `car`), brand,
  model, year, plate number, and then type-specific detail:
  - motorcycle: engine displacement (cc)
  - car: segment (hatchback/sedan/SUV/MPV/pickup/van), seat count, engine
    size, leather seats (bool), aircond condition (self-declared rating —
    admin can flag it if a purchaser disputes it)
- A purchaser posting a ride job may request a specific brand/model/segment.
  Matching only shows the job to runners whose registered vehicle satisfies
  the request — it's a filter, not a guarantee; the runner still has to
  accept or counter-offer.
- Vehicle details a purchaser sees before a ride are subject to the same
  anonymity display rules as everything else: if the runner is anonymous,
  the real plate number is never shown, only vehicle type/brand/model/segment.

## Passenger transport (ride-hailing)

New job type: `ride`. Everything in "Jobs and matching" — the lifecycle
state machine, FCFS claiming with the priority window, live GPS tracking,
proof-of-delivery-equivalent, and price negotiation — applies to `ride` jobs
the same way it applies to delivery/fetch jobs, plus the following.

### Compliance flag — no PSV/e-hailing license requirement
At explicit instruction, this product verifies a runner's general identity
document (IC or passport) the same way it does for every other role, but
does **not** require a verified PSV (Public Service Vehicle) license or
e-hailing driver credential before a runner can accept passenger jobs.
Carrying paying passengers commercially in Malaysia is generally regulated
separately from courier/delivery work, under the Land Public Transport Act
2010 and subsequent e-hailing regulations, which typically require a PSV
license, a vehicle permit, and specific insurance. This is a deliberate
product decision, not an oversight — but it is real, unreviewed regulatory
exposure. This note is not legal clearance. Get it in front of a lawyer
before any public launch of ride jobs.

### Ride comfort & safety preferences
- `quietRidePreferred` — an opt-in toggle on the runner's profile. A
  purchaser can request a quiet/no-talking ride; the job is only shown to
  runners who've opted in — same visibility-gating pattern as
  `auto_reject_anonymous_cod`.
- `scentFreeVehicle` — a similar opt-in toggle on the runner's profile, for
  purchasers who need a vehicle free of air fresheners/perfume (allergy or
  sensitivity). Gates job visibility the same way. (This is our reading of
  "no fragrant" — flag it back if that's not what was meant.)
- Both are comfort/accessibility preferences, unrelated to the SOS flow
  below.

### Emergency (SOS)
- Any party on an active job (ride or delivery) can trigger SOS from the
  app. Triggering SOS:
  - writes an `sos_incidents` row (job id, triggered-by user, timestamp,
    last-known GPS point, status)
  - is written to the audit log like every other action, with no exception
  - notifies admin immediately — no delay, no batching
  - keeps live GPS tracking running past the job's terminal state until
    admin closes the incident, overriding the normal "stop tracking on
    terminal state" rule for that one job
- SOS never silently fails: if a push/notification path is down, the
  incident row still exists and admin's incident queue is the source of
  truth, not the notification.
- Actually placing a call to local emergency services (999) is a
  phone-level action the app shortcuts to, not something the platform does
  on the user's behalf.

### Carpool (pooled rides)
- A ride job may be `poolEnabled` (purchaser's choice at posting, priced
  lower than a private ride) or private/exclusive (default).
- MVP scope: pooling means a purchaser can join an already-posted poolable
  ride whose route overlaps within a configurable time/distance tolerance —
  a manual join, not automatic route-matching. An automatic
  route-matching/pooling algorithm is explicitly out of scope for MVP;
  revisit once there's real ride volume to match against.
- Each co-passenger on a pooled ride is billed their own (reduced) fare —
  modeled as separate purchaser legs on the same job, not one purchaser
  paying for everyone.

## Scheduling & subscriptions

- Any job type can be posted for **immediate** dispatch (today's behavior)
  or **scheduled** for a future date/time. A scheduled job sits in `draft`
  until a configurable lead time before its scheduled slot, then moves to
  `posted` and enters normal FCFS/negotiation matching.
- **Recurring personal bookings** (the "ride to work and back" case): a
  purchaser can create a `ride_schedule` — a template describing a
  recurring pattern (days of week, pickup/dropoff, time, pool or non-pool)
  — which spawns a real job instance ahead of each scheduled occurrence.
  The template itself is never billable; only the jobs it spawns are.
- A `ride_schedule` may optionally pin a **preferred runner** (their
  "personal runner"). If the preferred runner doesn't accept within the
  normal priority window, the job falls back to open FCFS/negotiation like
  any other job — a preferred runner is a first-refusal courtesy, not a
  guarantee, so a purchaser is never left without a ride because one
  runner is unavailable.
- The same recurring-template pattern applies to a purchaser having a
  "personal vendor" for repeat item/food orders, not just rides.

## Vendor corporate contracts (catering)

- A `vendor_contract` is an agreement between a `group` (typically a
  company) and a `vendor` to supply meals on a recurring schedule (e.g.
  lunch, every working day) at a fixed per-meal price, for a defined
  contract period.
- **Negotiation**: before a contract is active, the group and vendor
  negotiate price/terms through the same counter-offer pattern as job price
  negotiation — proposals go back and forth, either side can accept, and an
  accepted proposal is what activates the contract. Every proposal and its
  resolution is logged.
- **Billing is per-meal, per day — never prepaid.** Each day's delivery
  under an active contract is its own flat-fee transaction, charged at the
  time of that day's order, exactly like any other job. The contract fixes
  the *price and terms*, it does not let the company pay in advance for a
  block of future meals.
- **A prepaid/lump-sum billing model was requested and is explicitly
  blocked.** Paying upfront for a month (or any period) of meals is a
  prepaid package under a different name — the exact thing the existing
  "Compliance note — why there is no wallet" section already prohibits
  without a lawyer's sign-off. This has not been built. If that sign-off is
  obtained, it comes back as its own reviewed feature — it does not get
  bolted onto the per-meal ledger flow after the fact.
- Commission on catering-contract meals follows the normal
  flat-fee-per-settled-transaction rule. No special-casing for being under
  a contract.

## Role-specific applications

- The frontend is one deployed app, structured as distinct top-level
  experiences rather than one shared dashboard with role-based tab-switching:
  - `/client` — purchaser: post jobs, negotiate, track, rate, manage
    schedules/subscriptions.
  - `/runner` — runner: job feed, offers, vehicle profile, earnings/payouts,
    SOS.
  - `/vendor` — vendor: catalogue (post-launch), corporate contracts,
    orders, payouts.
  - `/admin` — unchanged, already specified above.
- A user holding multiple roles (e.g. purchaser + runner) switches between
  `/client` and `/runner` explicitly. The app never guesses which role a
  request is "for."

## Mobile apps (Expo)

Three separate native apps, Grab/Lalamove-inspired, sharing the same
Cloudflare Workers API as the web app — not a separate backend:

- `mobile/apps/client` — purchaser
- `mobile/apps/runner` — runner
- `mobile/apps/vendor` — vendor
- `mobile/packages/ui-kit` — shared component library (Button, Card, Badge,
  Input, Navbar, etc.) built with React Native primitives, styled with
  Bootstrap 5's actual color/spacing/radius tokens. Bootstrap's CSS cannot
  run in a native iOS/Android binary, so this is not literally Bootstrap —
  it exists so the native apps read as the same product family as the
  Bootstrap web app, not a rebrand.
- `mobile/packages/api-client` — shared fetch wrapper + types, reused
  across all three apps, hitting the same `/api/*` routes the web app uses.

### Mobile auth
Browser cookies don't survive well across native app restarts. Sessions
stay KV-backed exactly as before, but `getSession` now accepts the session
id either from the `Cookie` header (web) or an `Authorization: Bearer
<sessionId>` header (mobile). Login/register responses include the raw
session id in the JSON body so the mobile client can store it — the web
client ignores that field and relies on the cookie as before. Mobile stores
it via `expo-secure-store`, never AsyncStorage (unencrypted).

### Verification caveat
This environment has no iOS/Android simulator or device attached. Each app
is verified via `tsc --noEmit` and `expo export` (a real production bundle
build), not by running it. Treat that as unverified-in-the-browser-sense —
actually launching each app in Expo Go or a simulator before shipping is
still owed.

## Vehicle rental (peer-to-peer)

Like Trevo: any user can list a registered vehicle (see "Runner vehicles")
for rent; a runner or a vendor can book it — a vendor renting a van for
deliveries is as valid a case as a runner renting a car for ride jobs.

- A `vehicle_rental_listing` belongs to an owner (any user, any role) and
  points at one of their `vehicles` rows. A `vehicle_rental_booking` is the
  actual rental: renter, dates, fee, status.
- Booking lifecycle: `requested -> accepted -> active -> completed`, with
  `rejected`/`cancelled`/`disputed` branches — same validated-transition
  discipline as job lifecycle, not client-driven.
- **Compliance flag — no platform-held deposit.** A rental security deposit
  is textbook stored value: the platform would be custodying a renter's
  money against a future, uncertain event (damage), which is exactly what
  the "Compliance note — why there is no wallet" section prohibits without
  a lawyer's sign-off. This has not been built. Instead, the owner declares
  a deposit amount at listing time — logged as an attestation, exactly like
  a fetch job's declared value — and collects/returns it directly with the
  renter, off-platform. The platform never touches it.
- Commission is the same flat-fee-per-settled-transaction rule as
  everything else, accrued against the owner exactly like a cash job's fee
  (CLAUDE.md "Money") — rental fees are typically settled directly between
  owner and renter, same as any cash job.

## Ratings

- Ratings live from day one, in both directions.
- **Any party can reject a rating they received.** On rejection, the rating is
  immediately hidden from public display and excluded from the average until an
  admin resolves it. Store: original score, rejection reason, resolution outcome,
  resolver, timestamps. The rating itself is never deleted.
- Show counterparties a "rating under review" indicator rather than silently
  changing the average.

## Runner onboarding

Deliberately minimal — this is the main reason a runner picks us over incumbents.
- A few fields, a few clicks, and the runner can start working the same day.
- Admin verifies afterwards, asynchronously.
- Anonymous runners can work. They stay unverified, get no priority window, no
  vouchers, and are excluded from COD and high-declared-value jobs by default.

## Groups / societies (multi-tenancy)

This must be in the schema from day one; retrofitting tenancy later is very costly.
- A `group` entity. Users, vendors, and runners can belong to groups. Groups have
  an owner and their own settings.
- Carry `group_id` on jobs, orders, ledger entries, and audit rows from the start.
  Nullable for platform-wide activity, but present everywhere.
- Per-group settings include: whether anonymity is allowed, commission overrides,
  priority rules, and COD policy.
- **A group may bring its own payment gateway**, in which case they must hold a
  deposit with the platform equal to the volume routed through their own gateway.
  Model the deposit as a ledger account with a hard limit check before allowing
  each transaction — block new orders when the deposit is exhausted.
- Every query must be group-scoped by default at the repository layer. A missing
  group filter is a data-leak bug, not a style issue. Write tests for cross-group
  isolation.

---

## Tech stack (MVP)

- **Hosting:** Cloudflare Workers
- **Toolchain:** Bun
- **Frontend:** React + Bootstrap 5 (no Tailwind, no custom design system)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (proof of delivery, receipts, vendor images, KYC docs)
- **Auth:** session-based, secure httpOnly cookies, sessions in KV or D1
- **Realtime:** Durable Objects for live location and job feed fan-out

### Critical constraint — Postgres migration

Production will move to PostgreSQL. Therefore:
- All DB access goes through `src/db/repositories/*`. No raw SQL in routes or
  components.
- Drizzle ORM, schema defined once in `src/db/schema.ts`, SQLite and Postgres
  drivers both configured.
- No SQLite-only features: no `AUTOINCREMENT` (use UUID v7 generated in app code),
  no `INSERT OR REPLACE`, no dynamic typing. Timestamps as ISO-8601 UTC strings.
- Numbered migrations in `migrations/`, written to replay against Postgres.
- Integration tests run against both local SQLite and a Postgres container, so
  drift is caught immediately.

---

## Activity logging (hard requirement)

Nothing missing. Every action, including failures.

- One append-only `audit_log` table. Never `UPDATE`, never `DELETE`.
- Each row: id, timestamp (UTC, ms precision), actor user id, actor role, group id,
  impersonated-by (if admin acting as a user), action, entity type, entity id,
  before-state JSON, after-state JSON, IP, user agent, request id, result
  (success/failure with reason).
- Implement as **middleware plus a repository-layer hook**, so a developer cannot
  forget. Do not sprinkle manual log calls through handlers.
- A request id is generated at the edge and threaded through every layer.
- Log failed logins, permission denials, rejected claims, consent acknowledgements,
  anonymity toggles, admin identity lookups, and every ledger movement.
- Redact passwords, tokens, and card data before writing.
- Anonymity never reduces logging detail.

## Admin panel

- `/admin` namespace, role checked server-side, not just hidden in the UI.
- Views: users (real identity behind handles), jobs with full timeline and GPS
  replay, vendors, runners, groups, ledger, weekly payout batches, disputes,
  rating rejections, and the audit log.
- Audit viewer filters by actor, entity, action, group, date range, and result,
  with CSV export.
- Admin actions are logged, including who viewed which real identity and why.

---

## Build order

1. Repo scaffold: Bun, Workers, Wrangler, env handling.
2. Schema, migrations, repository layer, dual-database test harness, group scoping.
3. **Audit logging middleware — before any business feature.**
4. Auth, roles, verification tiers, anonymity toggle with warning modal and consent
   logging.
5. Job lifecycle state machine + FCFS claiming with the 60-second priority window.
6. Live GPS tracking via Durable Objects.
7. Ledger, then the `cash` provider with accrued fee receivables.
8. Runner job execution, proof of delivery to R2.
9. Ratings with the rejection/hold flow.
10. Admin panel.
11. Weekly payout batches.
12. Gateway integration and per-group gateway with deposit limits.
13. Vendor catalogue (post-launch).
14. Runner vehicle profiles.
15. Ride job type: comfort/safety preferences, SOS.
16. Carpool (manual-join MVP).
17. Scheduling & recurring subscriptions (`ride_schedule`).
18. Vendor corporate contracts: negotiation + per-meal billing.
19. Role-specific frontend applications (`/client`, `/runner`, `/vendor` split).

## Working agreement

- TypeScript strict, no `any`.
- Unit tests on every state transition and every money calculation.
- After each step: diff summary, what was tested, what was deliberately left out.

---

## Compliance note — why there is no wallet

Issuing a payment instrument that stores value redeemable for goods, services or
cash is what triggers e-money licensing in Malaysia under the Financial Services
Act 2013. Holding the money in the company's own account is the regulated
activity, not an exemption from it.

This product therefore holds **no customer balance at all**. Every payment is
charged per transaction and settles onward. That keeps the platform outside the
e-money perimeter.

Do not add any of the following without a lawyer's sign-off first, because each
one recreates stored value under a different name:
- top-up, credits, points redeemable for cash, or prepaid packages
- holding purchaser funds in escrow across days rather than settling per order
- letting runners or vendors accumulate a withdrawable positive balance on the
  platform between payout cycles

The weekly payout cycle is the one place to be careful. Structure it so the
platform is settling a payable it owes for services rendered, not custodying
money that already belongs to the runner. If in doubt, shorten the cycle rather
than lengthening it.