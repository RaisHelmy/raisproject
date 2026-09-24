# TESTING.md — Full Suite Verification Plan (Super Admin, Real Integrations, MCP)

> Goal: prove every application in this workspace works end-to-end **in production**, as the
> shared super admin, against **real** infrastructure (Postgres over Hyperdrive, R2, KV, Queues,
> Durable Objects, Ubuntu cron, Jira, Cloudflare AI, email) — and that every MCP surface is
> reachable from a real MCP client (Claude Code / Claude Desktop).
>
> This is a *checklist to execute*, not a description. Every task has an ID, a concrete action,
> and a pass condition. Tick the box, and if it fails, file it in §14 (Findings log).
>
> Source of truth for credentials: `IMPORTANT.md` and `CREDENTIALS.md` (same folder).
> Do **not** copy passwords into any other file, commit, ticket, or chat.

---

## 0. Ground truth (as of 2026-09-06)

### 0.1 Super admin identity (same credential everywhere)

| Field | Value |
|---|---|
| Email | `raishelmy97@gmail.com` |
| Username (where applicable) | `raishelmy` |
| Password | see `IMPORTANT.md` |
| pantas phone login | `+60100000099` |
| Tenant / org slug (multi-tenant apps) | `rais-admin` |

### 0.2 Infrastructure

| Component | Detail |
|---|---|
| Postgres | Docker `postgres:latest` on Ubuntu VM, DB `raishelmy`, superuser `postgres/postgres`, **one schema per app** |
| Hyperdrive | `raishelmy-hyperdrive`, id `7a7777560d434c2b91ff37c52ab1b2c9`, bound as `HYPERDRIVE` in every app |
| Ubuntu VM | `ssh helix@sshraisubuntu.raishelmy.uk` (Cloudflare Access tunnel). Hosts Postgres, pgAdmin, Portainer, and **all cron jobs** (Workers Cron Triggers were moved here because the Free plan's 5-trigger limit is exhausted) |
| psql tunnel | `ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk` then `postgresql://postgres:postgres@localhost:15432/raishelmy` |
| Cloudflare account | `6af8ff18a864c2b56f1a3aa78cb24f80` (`raishelmy97`) |

### 0.3 Live URL matrix (probed 2026-09-06 08:23 UTC)

| App | Schema | Working URL | Landing-page URL | Landing status | Probe result |
|---|---|---|---|---|---|
| saas-landing | – | https://saas.raishelmy.uk | – | – | 200 ✅ |
| pantas | `pantas` | https://pantas.raishelmy.uk | same | beta | 200, `/api/health` ok ✅ |
| raisfintech | `raisfintech` | https://fintech.raishelmy.uk | same | beta | 200 ✅ |
| hrmsC | `hrmsc` | https://hrms-saas-68p.pages.dev | https://hrms.raishelmy.uk | live | pages.dev 200 ✅ / **custom domain DNS fails ❌** |
| helpdeskc | `helpdeskc` | https://helpdesk.raishelmy.uk | same | live | 200 ✅ |
| rais rms | `raisrms` | https://rais-rms.pages.dev | https://rms.raishelmy.uk | live | pages.dev 200 ✅ / **custom domain DNS fails ❌** |
| raisinfrasupermcp | `raisinfrasupermcp` | https://mcp.raishelmy.uk | same | internal | 200, `/mcp` advertises 27 tools ✅ |
| raisrunforge | `raisrunforge` (unused, demo mode) | https://runforge.raishelmy.uk | same | internal | 200, `/api/mcp/tools` lists tools ✅ (no `/api/health` route) |
| raisaicreatehiggsfield | `raisaicreatehiggsfield` | https://create.raishelmy.uk | same | beta | 200, `/api/v1/health` ok ✅ |
| raistimesheet web | `raistimesheet` | https://rais-timesheet.pages.dev | https://timesheet.raishelmy.uk | internal | pages.dev 200 ✅ / **custom domain DNS fails ❌** |
| raistimesheet api | | https://rais-timesheet-api.raishelmy97.workers.dev | – | – | `/api/health` ok ✅ |
| raiseat | none (static) | *not deployed* | https://eat.raishelmy.uk | beta | **DNS fails ❌** |
| raistravel | none (static) | *not deployed* | https://travel.raishelmy.uk | beta | **DNS fails ❌** |
| raiscopycode | none | – | – | – | out of scope (contains `devstart-atlas` only) |

All legacy `*.raishelmy97.workers.dev` URLs listed in `CREDENTIALS.md` now return 404 at `/`
(custom-domain routes took over). Treat the table above as canonical.

**Pre-existing findings surfaced by the probe (already known, confirm in §14):**
- F-001 `hrms.raishelmy.uk`, `rms.raishelmy.uk`, `timesheet.raishelmy.uk`, `eat.raishelmy.uk`,
  `travel.raishelmy.uk` are advertised on the landing page but have no DNS / custom-domain binding.
- F-002 `raiseat` and `raistravel` have no deployed Pages project at all.

### 0.4 Known open issues going in (from `CREDENTIALS.md`) — re-verify, don't assume

| ID | App | Issue |
|---|---|---|
| K-1 | hrmsC | `JWT_SECRET` is still the committed dev placeholder → anyone with source can forge sessions |
| K-2 | rais rms | throwaway tenants `rais-admin2`…`rais-admin5` in schema |
| K-3 | hrmsC | leftover `acme-test` tenant / `alice+pgtest@example.com` |
| K-4 | raisrunforge | production is in-memory demo mode; Postgres store never wired; state resets on cold start |
| K-5 | pantas | `pantas_staging` schema switch no longer wired (schema hardcoded) |
| K-6 | helpdeskc | `PLATFORM_ROOT_DOMAIN` still `helpdesk.example`; tenant resolution relies on a manual `domains` row |
| K-7 | raisinfrasupermcp | `SESSION_SECRET`, `AI_PROVIDER_KEY` secrets may be unset (AI features gated) |
| K-8 | all | seed/demo passwords committed to repos |
| K-9 | raisaicreatehiggsfield | local dev can't reach Postgres through tunnel (`pg_hba.conf`) |
| K-10 | several | D1-compat shim types (INTEGER bools, TEXT timestamps) — cosmetic, not a bug |

---

## 1. Test environment & tooling setup

Do these once before any app-level task.

- [ ] **T-1.1 Shell env file.** Create `~/.raistest.env` (chmod 600, **outside** the repo) exporting
  `SA_EMAIL`, `SA_PASS`, `SA_PHONE`, `SSH_PASS`, `PG_URL`. Source it in every terminal.
  Pass: `echo $SA_EMAIL` prints the super-admin email.
- [ ] **T-1.2 Cookie jars.** `mkdir -p /tmp/rt && cd /tmp/rt`. One jar per app: `pantas.txt`,
  `fintech.txt`, `hrms.txt`, `helpdesk.txt`, `rms.txt`, `smcp.txt`, `raisai.txt`, `ts.txt`.
- [ ] **T-1.3 Wrangler auth.** `npx wrangler whoami` → account `raishelmy97`, id `6af8ff18…`.
- [ ] **T-1.4 SSH to VM.** `ssh helix@sshraisubuntu.raishelmy.uk 'hostname && docker ps --format "{{.Names}} {{.Status}}"'`.
  Pass: postgres, pgadmin, portainer containers all `Up`.
- [ ] **T-1.5 Postgres tunnel.** Open `ssh -N -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk` in a
  background terminal. Pass: `psql "$PG_URL" -c '\dn'` lists all 9 app schemas
  (`pantas, raisfintech, hrmsc, helpdeskc, raisrms, raisinfrasupermcp, raisrunforge, raisaicreatehiggsfield, raistimesheet`).
- [ ] **T-1.6 Hyperdrive health.** `npx wrangler hyperdrive get 7a7777560d434c2b91ff37c52ab1b2c9`.
  Pass: origin host/port/db match the VM; no "unreachable" warning.
- [ ] **T-1.7 Ubuntu cron inventory.** `ssh … 'crontab -l; sudo ls /etc/cron.d; sudo cat /etc/cron.d/* 2>/dev/null'`.
  Record every line hitting an `/internal/cron` endpoint into §12 table. Pass: an entry exists for
  each of: pantas weekly-payout, pantas daily-spawner, fintech (2 min), helpdesk (15 min),
  raisai (nightly), timesheet sync-sweep (5 min), timesheet retention (daily), rms reminders/campaigns.
- [ ] **T-1.8 MCP client.** Confirm `claude mcp list` works in an interactive Claude Code session and
  Claude Desktop config file path is known (`~/Library/Application Support/Claude/claude_desktop_config.json`).
- [ ] **T-1.9 Python for stdio MCP servers.** `python3 --version` ≥ 3.10 and `uv` or `pip` available
  (needed for fintech + timesheet MCP servers).
- [ ] **T-1.10 Browser.** A clean Chrome profile (no extensions) for UI passes; DevTools → Network → "Preserve log".

---

## 2. Cross-cutting invariants (run against EVERY backend app)

These are the bug classes already found once during the migration. They regress silently, so every
app gets the same six checks. Record results in the matrix in §13.

| ID | Invariant | How to test | Pass |
|---|---|---|---|
| X-1 | **Persistence is real** (not in-memory) | Do a write (register / create), then `psql` the app schema and `SELECT` the row | Row exists with correct schema-qualified table |
| X-2 | **Hyperdrive `search_path` survives** | Run the same write 10× in a loop with a fresh `curl` each time | 10/10 succeed; zero `relation "x" does not exist` |
| X-3 | **No cross-request I/O reuse** | 20 concurrent requests: `seq 20 \| xargs -P20 -I{} curl -s -o /dev/null -w "%{http_code}\n" <auth/me with cookie>` | All 200; zero 500 `Cannot perform I/O on behalf of a different request` |
| X-4 | **Login works** (PBKDF2 ≤ 100k iters) | Login with super admin | 200 + session cookie / token |
| X-5 | **Wrong password rejected** | Login with `wrong` | 401, no cookie, no stack trace in body |
| X-6 | **Cold-start OK** | Wait ≥ 10 min idle, then hit auth/me with the saved cookie | 200 (no `CONNECT_TIMEOUT`, no TLS hang) |
| X-7 | **Secrets not leaked** | `curl -s <app>/api/auth/me` body and headers | No hash, token, connection string, or stack trace |
| X-8 | **Observability** | `npx wrangler tail <worker> --format pretty` while doing X-2 | Logs stream; no unhandled exceptions |

---

## 3. pantas — Anonymous on-demand marketplace

Base: `https://pantas.raishelmy.uk` · Worker `pantas` · schema `pantas` · bindings: HYPERDRIVE, R2 `MEDIA`, KV `SESSIONS`, DO `LIVE_LOCATION`.

### 3.1 Auth & roles
- [ ] P-1 `POST /api/auth/login` `{"phone":"+60100000099","password":"…","role":"admin"}` → 200, cookie. Save to `pantas.txt`.
- [ ] P-2 Same with `"role":"purchaser"` → 200 (user holds both roles).
- [ ] P-3 Same with `"role":"runner"` → 403/400 (role not granted).
- [ ] P-4 `GET /api/auth/me` → returns real identity + roles `[purchaser, admin]`.
- [ ] P-5 KV check: `npx wrangler kv key list --namespace-id 33658be6ac234137b3238683037cee01 | head` shows a session key created just now.

### 3.2 Admin surface
- [ ] P-6 `GET /api/admin/users` → list incl. super admin.
- [ ] P-7 `GET /api/admin/users/:id/identity` **without** a `reason` → 400. With `{"reason":"test"}` → 200, and `GET /api/admin/audit-log` shows an `identity_disclosure` entry with that reason (CLAUDE.md law-enforcement rule).
- [ ] P-8 `POST /api/admin/commission-rules` create a flat-fee rule for `delivery` → 201; `GET` shows it. (Rule must be a row, not hardcoded.)
- [ ] P-9 `POST /api/admin/perk-rules` create a rule for `verified` tier → 201.
- [ ] P-10 `POST /api/admin/users/:id/verification` set self to `verified` → 200; `me` reflects it.
- [ ] P-11 `POST /api/admin/users/:id/status` suspend then unsuspend a throwaway user → each 200, login blocked while suspended.

### 3.3 Purchaser → job lifecycle (real DB + DO)
- [ ] P-12 As purchaser: `POST /api/jobs` create a **delivery** job, payment `cash` → 201; note `jobId`.
- [ ] P-13 Create a second throwaway **runner** account (register via `/api/auth/register` with a new phone), enable `auto_reject_anonymous_cod` default → confirm the anonymous COD job is **hidden** from `GET /api/pool`.
- [ ] P-14 Runner opts in (toggle off) → job now visible; runner `POST /api/offers` → purchaser accepts → job `assigned`.
- [ ] P-15 GPS: `POST /api/gps` as runner with lat/lng → 200; purchaser `GET /api/gps/:jobId` sees position. This exercises the `LiveLocationRoom` Durable Object.
- [ ] P-16 Complete job → `settled`. `psql`: `SELECT * FROM pantas.ledger_entries WHERE job_id=…` → **balanced** debit/credit rows and one **accrued fee receivable** row for the runner (cash job).
- [ ] P-17 `POST /api/ratings` both directions → 200; handles are masked (`Runner #XXXX`), real names absent.
- [ ] P-18 `POST /api/sos` → 200; admin sees it in audit log.

### 3.4 Media (R2)
- [ ] P-19 `POST /api/media` upload a 100 KB JPEG → 201 with key; `npx wrangler r2 object get pantas-media/<key> --file /tmp/rt/out.jpg` matches checksum.

### 3.5 Payouts & cron (Ubuntu-hosted)
- [ ] P-20 `POST /api/admin/payouts/generate` → creates a payout batch; `GET /api/payouts` shows it with status + audit trail.
- [ ] P-21 Cron auth: `POST /api/internal/cron/weekly-payout` **without** header → 401; with the wrong secret → 401; with `X-Cron-Secret: $(ssh … 'grep -o "X-Cron-Secret: [^\"]*" /etc/cron.d/pantas' …)` → `{"ok":true}`.
- [ ] P-22 `POST /api/internal/cron/daily-spawner` with correct secret → `{"ok":true}`; schedules/contract orders spawned (check `pantas.jobs` count delta).
- [ ] P-23 `POST /api/internal/cron/nonsense` → 400 `unknown job`.
- [ ] P-24 On the VM: confirm the two pantas cron lines exist and last run logged (`grep pantas /var/log/syslog | tail`).

### 3.6 Gateway payment stub
- [ ] P-25 `POST /api/gateway/...` with payment method `gateway` → either a real provider redirect or an explicit `501 not configured` — **never** a fake success.

### 3.7 Automated
- [ ] P-26 `cd pantas && bun run typecheck && bun run test` → 0 failures.
- [ ] P-27 `npx wrangler deploy --dry-run` → no cron-trigger error other than the known Free-plan limit.

---

## 4. raisfintech — Guided personal wealth platform

Base: `https://fintech.raishelmy.uk` · Worker `rais-fintech` · schema `raisfintech` · bindings: HYPERDRIVE, R2 `FILES`, `send_email EMAIL`.

### 4.1 Auth, admin, tokens
- [ ] F-1 `POST /api/auth/login` `{email,password}` → 200; `GET /api/auth/me` → `role:"admin"`, `email_verified` true (if false, run `/api/auth/resend-verification` and complete via UI dev-mode link).
- [ ] F-2 `GET /api/admin/users` → list; non-admin token → 403.
- [ ] F-3 `POST /api/tokens` `{"name":"test-read","scopes":["read"]}` → returns `rfk_…` once. `GET /api/tokens` shows prefix only (no full token). Save as `RAIS_API_TOKEN_READ`.
- [ ] F-4 `POST /api/tokens` `{"name":"test-trade","scopes":["trade"]}` → scopes auto-become `["read","trade"]`. Save as `RAIS_API_TOKEN_TRADE`.
- [ ] F-5 `GET /api/v1/portfolio -H "Authorization: Bearer $RAIS_API_TOKEN_READ"` → 200; `GET /api/tokens` shows `last_used_at` updated (audit).

### 4.2 Email — real provider
- [ ] F-6 UI → System → Admin → Email: set provider **Cloudflare Email Service** (if `raishelmy.uk` sending is onboarded: `npx wrangler email sending list`) or **Resend** with a real key. **Send Test Email** to the super-admin inbox → email arrives (check Gmail). If neither is configured, record as F-xxx (email is dev-mode only in prod).
- [ ] F-7 `GET /api/admin/email-settings` → API key **not** returned in body.

### 4.3 Quant engine & job queue (Postgres-backed, cron-drained)
- [ ] F-8 `GET /api/instruments` → universe with Shariah + risk flags; `GET /api/instruments/AAPL` → BUY/HOLD/SELL breakdown.
- [ ] F-9 `POST /api/robo/analyze` for one symbol → job id; `GET /api/jobs/:id` → transitions `queued → running → done` within ~10 s (waitUntil path).
- [ ] F-10 `POST /api/robo/orders` **paper** buy → `done` with fill price & qty.
- [ ] F-11 `POST /api/robo/orders` with `live:true` and live trading **not** enabled → refused at enqueue (4xx), never executed.
- [ ] F-12 Cron drain: `POST /api/internal/cron -H "X-Cron-Secret: …"` → `{ok}`; VM cron entry runs every 2 min (check `psql`: `SELECT status, count(*) FROM raisfintech.jobs GROUP BY 1` — no job stuck `queued` > 5 min).
- [ ] F-13 Retry logic: `psql` insert a job with an unknown symbol → after 3 attempts status `failed`, `attempts=3`.

### 4.4 Multi-broker investments
- [ ] F-14 `GET /api/investments/providers` → Moomoo `implemented`; others honest states, no fake data.
- [ ] F-15 `POST /api/investments/connections/moomoo/connect` (test creds or demo) → connection row; `POST …/:id/sync` → sync log row; `GET /api/investments/portfolio` MYR total.
- [ ] F-16 `POST …/:id/reconnect` → state `connected`.

### 4.5 Documents (R2)
- [ ] F-17 `POST /api/documents` upload PDF → 201; `GET /api/documents/:id` streams same bytes; `npx wrangler r2 object list rais-fintech-files` shows key.

### 4.6 Guidance, theories, affiliate, gamification
- [ ] F-18 `GET /api/guidance` → journey state; change a step in UI, reload → persisted.
- [ ] F-19 `POST /api/admin/theories` create draft → invisible in `GET /api/theories`; publish → visible.
- [ ] F-20 `POST /api/suggestions` as a second throwaway user → admin `GET /api/admin/suggestions` → approve → user gets **+150 points exactly once** (approve twice, check `points_ledger`).
- [ ] F-21 `GET /api/affiliate` → referral code `RAIS-XXXXXXXX`; sign up throwaway with `?ref=` → referrer +200, friend +100.
- [ ] F-22 `GET /api/achievements` → "First Trade" unlocked after F-10.

### 4.7 MCP (Python stdio server → real prod API)
- [ ] F-23 `pip install ./raisfintech/integrations/mcp-python` (or `uv`).
- [ ] F-24 `claude mcp add rais-fintech -e RAIS_API_URL=https://fintech.raishelmy.uk -e RAIS_API_TOKEN=$RAIS_API_TOKEN_READ -- rais-fintech-mcp`
- [ ] F-25 In Claude Code: "What's my portfolio worth, and which holdings aren't Shariah-compliant?" → tools `get_portfolio`, `list_instruments` called; numbers match F-15.
- [ ] F-26 "Queue a RM500 paper buy of AAPL" with **read** token → `queue_order` refused (scope). Re-add server with trade token → succeeds; `GET /api/jobs` shows it.
- [ ] F-27 All 18 tools appear in `claude mcp` tool list; `get_strategy_registry`, `list_theories`, `get_rewards` each return without error.
- [ ] F-28 Revoke token in UI → next MCP call returns 401.

### 4.8 Automated
- [ ] F-29 `cd raisfintech && npm run build` clean.

---

## 5. hrmsC — Multi-tenant HRMS

Base: `https://hrms-saas-68p.pages.dev` (API under `/api/*`) · Pages `hrms-saas` · schema `hrmsc` · bindings: HYPERDRIVE, R2 `ATTACHMENTS`.

### 5.1 Security prerequisite
- [ ] H-0 **Rotate `JWT_SECRET` first** (K-1): `openssl rand -hex 32 | npx wrangler pages secret put JWT_SECRET --project-name hrms-saas`. Then confirm old cookie (if any) is rejected. *Record this in §14 as fixed.*

### 5.2 Auth & tenancy
- [ ] H-1 `POST /api/auth/login` `{email,password}` → 200, cookie; `GET /api/auth/me` → tenant `rais-admin`, role `admin`.
- [ ] H-2 Tenant isolation: log in as `acme-test` admin (reset password via `psql` first, K-3) → cannot list `rais-admin` employees (expect empty/403). Then **delete** the `acme-test` tenant rows (K-3) and record.
- [ ] H-3 `POST /api/auth/register-tenant` with an existing slug → 409/400.

### 5.3 Core modules (UI + API, as admin)
Walk each module: create → read → update → status change. Minimum:
- [ ] H-4 Employees: create 3 employees (one manager, two reports); set reporting line.
- [ ] H-5 Leave: create leave type, grant quota (HR direct-grant), apply as report → routed → approve as manager → balance decrements; calendar "unit" view shows it.
- [ ] H-6 Attendance + Overtime + Work schedule: clock in/out; overtime request routed and approved.
- [ ] H-7 Claims: create claim type with mileage rate; submit mileage claim with distance → amount auto-computed; attach receipt (R2, see H-13).
- [ ] H-8 Payroll: run payroll for the month → payslips generated per employee; download PDF.
- [ ] H-9 Recruitment, Training, Assets, Vendors, Uniform, LTIP, generic Requests: one create each → 201 and visible in list.
- [ ] H-10 Notifications: approvals in H-5/H-6 produced in-app notifications for the right person.

### 5.4 Routing engine & permissions (architectural centerpieces)
- [ ] H-11 Workflows: define a 2-step SEQUENTIAL approval (manager → HR); submit a leave → step 1 pending only; approve → step 2 pending; reject at step 2 → request rejected, audit log has both actions.
- [ ] H-12 Reassignment: reassign a pending task to another approver → new approver sees it; old one doesn't.
- [ ] H-13 Permissions: `GET /api/admin` (permission catalog, 28 keys); `DELETE /api/admin/:role/:key` remove `payroll.view` from role `manager` → manager gets 403 on payroll; `POST /api/admin` restore.
- [ ] H-14 **Login As** (simulation): `POST /api/simulate/:employeeId/start` → `me` returns the employee; every action is audit-tagged as simulated; `POST /api/simulate/stop` restores admin.

### 5.5 Attachments (R2)
- [ ] H-15 Upload a receipt via `/api/attachments` → metadata row in Postgres, blob in `hrms-attachments`; download returns identical bytes; other tenant cannot download it by id.

### 5.6 Audit
- [ ] H-16 `GET /api/admin/audit` (audit log) contains every mutation above with actor + tenant.

### 5.7 Automated
- [ ] H-17 `cd hrmsC && bun run typecheck && bun run build`.

---

## 6. helpdeskc — Multi-tenant help desk

Base: `https://helpdesk.raishelmy.uk` · Worker `helpdeskc` · schema `helpdeskc` · bindings: HYPERDRIVE, KV, R2 `helpdeskc-attachments`, Queue `helpdeskc-jobs`, DO `TICKET_SEQUENCE`, `send_email`.

### 6.1 Tenant resolution & auth
- [ ] D-1 `GET /api/auth/me` (no cookie) → 401 JSON, **not** 404 (proves `domains` row maps host → tenant `rais-admin`).
- [ ] D-2 `POST /api/auth/agent/login` `{email,password}` → 200, cookie; `me` → role `Owner`, full preset permissions.
- [ ] D-3 Rate limit: 15 rapid bad logins → 429 within the window.
- [ ] D-4 Unknown host: `curl -H "Host: nobody.helpdesk.example" https://helpdesk.raishelmy.uk/api/auth/me` → 404 tenant-not-found (K-6 acknowledged; decide whether to set `PLATFORM_ROOT_DOMAIN=raishelmy.uk`).

### 6.2 Account hierarchy
- [ ] D-5 `POST /api/accounts` → account; `POST /api/accounts/:id/teams` → team; `POST /api/accounts/:id/contacts` → contact with email = a real inbox you control.
- [ ] D-6 `PATCH /api/accounts/:id`, `/api/teams/:id`, `/api/contacts/:id` each 200.

### 6.3 Agents, roles, invites (email integration)
- [ ] D-7 `POST /api/roles` custom role with subset of permissions; `PATCH /api/roles/:id`; archive.
- [ ] D-8 `POST /api/agents` invite a second agent (real inbox) → **invitation email arrives** via Cloudflare Email / queue consumer. Check `npx wrangler queues list` + `wrangler tail` for the consumer batch.
- [ ] D-9 `POST /api/auth/agent/accept-invite` with the emailed token + new password → 200 (PBKDF2 ≤ 100k confirmed in prod).
- [ ] D-10 `POST /api/agents/:id/roles` assign role; `DELETE …/:roleId` remove; permission change reflected in the next request.

### 6.4 Contact (end-client) auth
- [ ] D-11 `POST /api/auth/contact/magic-link` for D-5 contact → email arrives; `…/verify` → contact session.
- [ ] D-12 `POST /api/auth/contact/set-password` then `…/password-login` → 200.

### 6.5 Tickets
- [ ] D-13 As contact: `POST /api/tickets` → ticket number is **sequential per tenant** (create 3 quickly in parallel → 3 distinct consecutive numbers; proves `TicketSequence` DO).
- [ ] D-14 As agent: `POST /api/tickets/:id/messages` public reply → contact receives email; **internal note** → contact's `GET /api/tickets/:id/messages` **does not** include it (filtered at query layer).
- [ ] D-15 `POST /api/tickets/:id/transition` through the lifecycle (open → pending → resolved → closed); invalid transition → 400.
- [ ] D-16 Attachments: `presign` → `PUT` to R2 signed URL → `finalize` → `GET /api/attachments/:id/download`. A contact from another account cannot download it.
- [ ] D-17 Templates: create, new version, archive; the ticket reply uses the latest version.
- [ ] D-18 Tenant isolation: log in as `owner@acme.test` (demo tenant, `password123!`) on its own host mapping — if no `domains` row exists for `acme`, record that the demo tenants are unreachable in prod.

### 6.6 Cron & queues
- [ ] D-19 `POST /internal/cron -H "X-Cron-Secret: …"` → ok; SLA breach job runs (create a ticket with a 1-min SLA, wait for cron, check escalation).
- [ ] D-20 VM cron line hits it every 15 min (§12 table).

### 6.7 Automated
- [ ] D-21 `cd helpdeskc && bun run typecheck && bun test` (includes tenant-isolation tests).

---

## 7. rais rms — Restaurant management system

Base: `https://rais-rms.pages.dev` (API `/api/*`) · Pages `rais-rms` · schema `raisrms` · bindings: HYPERDRIVE, R2 `rais-assets`. Secrets: `JWT_SECRET` (set), `CRON_SECRET`, `RESEND_API_KEY`, `STRIPE_*` (verify).

### 7.1 Auth
- [ ] R-1 `POST /api/auth/login` `{"tenantSlug":"rais-admin","email":…,"password":…}` → 200 cookie; `me` role `owner`, outlet HQ.
- [ ] R-2 Wrong tenant slug → 401 (no tenant-existence leak).
- [ ] R-3 Clean-up K-2: `psql` delete `rais-admin2..5` tenants and their child rows; re-run R-1.

### 7.2 Outlets, floor, reservations, waitlist
- [ ] R-4 `POST /api/outlets` second outlet; `GET` list both.
- [ ] R-5 Floor: create 4 tables incl. a combinable pair; `GET /api/outlets/:id/floor`.
- [ ] R-6 `POST /api/reservations` for tonight party of 6 → auto-combined tables or explicit assignment; overlapping reservation on same table → 409.
- [ ] R-7 `POST /api/waitlist` → notify (email/SMS stub); seat from waitlist → reservation created.
- [ ] R-8 Public booking widget: `POST /api/public/...` (unauthenticated) creates a reservation for outlet slug; confirmation email sent via Resend if configured (else logged-and-skipped, confirm via `wrangler pages deployment tail`).

### 7.3 Guests, CRM, loyalty, campaigns, feedback
- [ ] R-9 `POST /api/guests` with tags (VIP, allergy); visit history increments after R-6 completes.
- [ ] R-10 `POST /api/loyalty` enrol guest; points accrue on order (R-12).
- [ ] R-11 `POST /api/campaigns` birthday campaign → `POST /api/cron/campaigns` with `X-Cron-Secret` → campaign run row; email attempt logged.
- [ ] R-11b `POST /api/cron/reminders` → reminder rows for tomorrow's reservations.

### 7.4 Operations (menu, orders, tickets/KDS, inventory, staff)
- [ ] R-12 `POST /api/outlets/:id/menu` categories + items with prices in minor units; `POST /api/outlets/:id/orders` QR-order 2 items → kitchen ticket `GET /api/outlets/:id/tickets` → bump to `done`.
- [ ] R-13 Inventory: create stock item linked to menu item; after R-12, stock decremented; low-stock flag.
- [ ] R-14 Staff shifts: create shift roster for tomorrow; conflict → 400.
- [ ] R-15 Upload menu image to R2 (`rais-assets`) and fetch via public URL.

### 7.5 Payments & webhooks
- [ ] R-16 Deposit endpoint without `STRIPE_SECRET_KEY` → **501** (graceful), never fake success. If Stripe test keys are set: create deposit → Stripe test card → `POST /api/webhooks/stripe` with signed test event → reservation marked `deposit_paid`.
- [ ] R-17 `POST /api/webhooks/stripe` with bad signature → 400.

### 7.6 Analytics & users
- [ ] R-18 `GET /api/analytics` covers new-vs-repeat, no-show trend → charts render (Highcharts) in UI.
- [ ] R-19 `POST /api/users` invite a `host` role user scoped to one outlet → they cannot read the other outlet.

### 7.7 Automated
- [ ] R-20 `cd "rais rms" && bun run typecheck && bun test`.

---

## 8. raisinfrasupermcp — Super MCP (autonomous SWE/ITOps control plane)

Base: `https://mcp.raishelmy.uk` · Worker `super-mcp` · schema `raisinfrasupermcp` · `DEMO_MODE=false` · bindings: HYPERDRIVE, R2 `super-mcp-evidence`. Secrets: `SESSION_SECRET`, `AI_PROVIDER_KEY`.

### 8.1 Auth & org
- [ ] S-1 `POST /api/auth/login` `{email,password}` → 200 with `"mode":"CONNECTED"`; `GET /api/organizations/current` → `rais-admin`, role `org_owner`.
- [ ] S-2 `GET /api/health` with session → 200. Without → 401 (confirmed).
- [ ] S-3 `GET /api/roles` → 9 default roles; `GET /api/users`.
- [ ] S-4 Demo users (`ahmad@abc.example`, `demo1234`) → 401 (in-memory demo no longer reachable).

### 8.2 Change Journey (end-to-end, real persistence)
- [ ] S-5 `POST /api/changes/plan` `{"intent":"Add a health endpoint to service X"}` → AI plan (requires `AI_PROVIDER_KEY`; if missing expect a clear 4xx/`DemoPlanner`, record K-7 state).
- [ ] S-6 `POST /api/changes` from the plan → change id; `GET /api/changes/:id` stage `PLAN`.
- [ ] S-7 Walk stages: `/requirements` → `/jira` (mock unless Jira integration configured) → `/git` → `/checklist` → `/deploy` → approval created → `POST /api/approvals/:id/decide` as **a different user** (separation of duties: self-approval must be **rejected**) → `/uat` → `/close`.
- [ ] S-8 Evidence: deploy step writes evidence to R2 `super-mcp-evidence` (`wrangler r2 object list`).
- [ ] S-9 `GET /api/audit` shows every step with actor, risk, correlationId.

### 8.3 Policy, risk, approvals
- [ ] S-10 `POST /api/policies` deny `application.deploy` in env `production` for role `developer` → as developer, `super.application.deploy` → `POLICY_DENIED`.
- [ ] S-11 High-risk task requires typed confirmation → call without confirmation → 4xx with `confirmationRequired`.
- [ ] S-12 `POST /api/tasks` production deploy that fails its health check → recovery ladder → retry → success; rollback scenario opens an incident (`GET /api/incidents`).

### 8.4 Agents
- [ ] S-13 `POST /api/agents/register` from the Ubuntu VM (real agent binary or curl heartbeat) → agent listed `ONLINE`; `POST /api/agents/:id/heartbeat` every 30 s keeps it online; stop → `OFFLINE` after TTL.

### 8.5 MCP (Streamable HTTP, bearer token) — real client
- [ ] S-14 `POST /api/auth/mcp-token` → `{token:"smcp_mcp_…", endpoint:"https://mcp.raishelmy.uk/mcp"}`; audit log has `mcp.token_created` (risk HIGH).
- [ ] S-15 `curl -X POST https://mcp.raishelmy.uk/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'` **without** bearer → 401 + `www-authenticate`.
- [ ] S-16 With bearer → 200, `mcp-session-id` header returned.
- [ ] S-17 `tools/list` → **27** tools (`super.change.create`, `super.task`, `super.system.health`, …); `resources/list` → 7 resources.
- [ ] S-18 `claude mcp add --transport http super-mcp https://mcp.raishelmy.uk/mcp --header "Authorization: Bearer smcp_mcp_…"`; in Claude Code: "Check system health and list open changes" → `super.system.health` + `super.change.status` invoked, results match S-6.
- [ ] S-19 Via MCP: `super.application.deploy` to production → returns **approval-required**, not executed (policy path identical to UI).
- [ ] S-20 `GET /api/mcp/calls` and `/api/mcp/tools` telemetry show the calls from S-18/19 with durations; `super.mcp.tool.analytics` returns same.
- [ ] S-21 Token TTL/revocation: delete the session → MCP call → 401.

### 8.6 Data governance
- [ ] S-22 `POST /api/data/export` → export contains no secrets (privacy filter); `POST /api/data/delete` on a throwaway org → rows gone in `psql`.

### 8.7 Automated
- [ ] S-23 `cd raisinfrasupermcp && bun run typecheck && bun test tests` (62 tests) and `bun run build`.

---

## 9. raisrunforge — Infrastructure control panel (demo mode in prod)

Base: `https://runforge.raishelmy.uk` · Worker `runforge-api` · `RUNFORGE_MODE=demo` (K-4: in-memory; state resets per isolate).

### 9.1 Auth
- [ ] G-1 `POST /api/auth/login` `{email,password}` → bearer token. Save `RF_TOKEN`.
- [ ] G-2 `GET /api/me -H "Authorization: Bearer $RF_TOKEN"` → `usr_rais_admin`, role `owner`.
- [ ] G-3 `GET /api/overview` with token → demo-world metrics.
- [ ] G-4 Header impersonation `X-RunForge-Demo-User: demo@runforge.dev` without bearer → still works (documented demo path) — **record as security finding for when Postgres mode is enabled**.

### 9.2 Core flows (demo provider)
- [ ] G-5 Servers → `production-01` → CPU/mem/disk, containers, services.
- [ ] G-6 Applications → MERC999 API → **Deploy** → pipeline progresses cloning → … → completed; `GET /api/deployments` shows it; events recorded.
- [ ] G-7 Rollback → previous deployment active.
- [ ] G-8 Restart container; database health; domains list; incidents list (one running incident seeded).
- [ ] G-9 Team: invite + role change (`POST /api/team/invite`, `/api/team/:id/role`).
- [ ] G-10 **Cold-start reset proof** (K-4): after G-6, wait 15 min idle → `GET /api/deployments` → deployment from G-6 **gone**. Document; this is expected until Postgres mode is wired.

### 9.3 MCP (REST-style dispatcher)
- [ ] G-11 `GET /api/mcp/tools` → 21 tools with `level` (READ / WRITE / DANGEROUS).
- [ ] G-12 `POST /api/mcp/call` `{"name":"list_servers","arguments":{}}` with bearer → data.
- [ ] G-13 `POST /api/mcp/call` `{"name":"deploy_application","arguments":{"applicationId":"…"}}` **without** `confirmationToken` → response demands confirmation; with token → deployment starts (same service method as UI, G-6).
- [ ] G-14 As a demo user with role `viewer` (`X-RunForge-Demo-Role: viewer`) → `restart_application` → 403 permission denied.
- [ ] G-15 Agent: run `agent/runforge-agent` on the Ubuntu VM pointed at prod → server appears in dashboard (outbound-only). If agent needs Postgres mode, record as blocked by K-4.

### 9.4 Automated
- [ ] G-16 `cd raisrunforge && bun run typecheck && bun test`.

---

## 10. raisaicreatehiggsfield — RaisAI Create (AI studio + workflow engine + MCP)

Base: `https://create.raishelmy.uk` · Worker `raisai-create` · schema `raisaicreatehiggsfield` · bindings: HYPERDRIVE, **AI**, R2 `raisai-assets`, Queues `raisai-generation-jobs` / `raisai-events`, Workflow `RAIS_WORKFLOW_RUN`. Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (model sync), `CRON_SECRET`.

> ⚠️ Generation tasks here **spend real Cloudflare AI credit**. Deposit a small balance (A-5) and keep prompts tiny.

### 10.1 Auth, admin, balance
- [ ] A-1 `POST /api/v1/auth/login` → cookie + `rais_csrf` cookie; `GET /api/v1/auth/me` → `isAdmin:true`.
- [ ] A-2 CSRF: mutating call without `x-csrf-token` → 403.
- [ ] A-3 `POST /api/v1/admin/models/seed` → catalog seeded (idempotent: run twice, count unchanged).
- [ ] A-4 `POST /api/v1/admin/models/sync` (needs secrets) → live rates pulled; a hand-typed rate is **not** overwritten. If secrets missing → clear error; record.
- [ ] A-5 `POST /api/v1/admin/balance/deposits` `{"orgId":…,"amountSen":500,"note":"test"}` → `GET /api/v1/balance` = RM5.00; ledger row in `psql`.
- [ ] A-6 Enable one cheap text model and one image model via `PUT /admin/models/:id/status` after `POST /admin/models/:id/test` passes.

### 10.2 Generation (real Cloudflare AI, real queue, real R2)
- [ ] A-7 `POST /api/v1/generations` text, model from A-6, ~20-token prompt → `queued` → poll `GET /api/v1/generations/:id` → `succeeded`; balance decreased by **exactly** the listed price (`estimate_cost` before vs ledger after).
- [ ] A-8 Image generation (smallest size) → asset in R2 (`GET /api/v1/assets/:id` returns signed URL; `wrangler r2 object list raisai-assets`).
- [ ] A-9 Cancel: start a generation and `POST …/cancel` immediately → `cancelled`, hold released (balance restored).
- [ ] A-10 Overdraw: set balance to RM0.01 → generation → refused with clear message; no negative balance.
- [ ] A-11 Queue health: `npx wrangler queues list`; `wrangler tail raisai-create` shows consumer batches for A-7/A-8; DLQ empty.

### 10.3 Workflows, templates, movies
- [ ] A-12 Create a 2-node workflow (text → image) in the node editor; `POST /api/v1/workflow-runs` → Cloudflare **Workflow** instance runs both nodes; `GET …/:id` shows per-node cost & outputs.
- [ ] A-13 Save as template (version 1), edit → version 2; execute template pinned to v1 → v1 behaviour.
- [ ] A-14 Share template publicly → second user can execute it; **cannot** edit it.
- [ ] A-15 Movie mode: create story → storyboard → timeline → export (mux expected unavailable, must be an explicit "render service not configured" message, not a silent failure).
- [ ] A-16 Webhook: register `POST /api/v1/webhooks` to `https://webhook.site/<id>`; run A-7 again → webhook received with signature; verify HMAC.

### 10.4 Developer surface: API keys + MCP
- [ ] A-17 `POST /api/v1/api-keys` `{"name":"t","scopes":["generations:read"]}` → key; `GET /api/v1/models -H "Authorization: Bearer <key>"` → 200; POST generation with read-only key → 403.
- [ ] A-18 `POST /api/v1/mcp-tokens` `{"name":"claude","scopes":[…all…]}` → token.
- [ ] A-19 `POST /api/v1/mcp` with the **API key** → 403 "Use an MCP token".
- [ ] A-20 `POST /api/v1/mcp` with MCP token: `initialize` (protocol `2025-06-18`) → ok; `tools/list` → 16 tools (`create_generation`, `estimate_cost`, `get_balance`, `execute_workflow`, …).
- [ ] A-21 `claude mcp add --transport http raisai https://create.raishelmy.uk/api/v1/mcp --header "Authorization: Bearer <mcp token>"`; in Claude Code: "Estimate the cost of a 50-word poem with model X, then generate it" → `estimate_cost` then `create_generation` → balance change equals estimate.
- [ ] A-22 Rate limit: 301 MCP calls in 60 s → 429 on the 301st.
- [ ] A-23 Revoke MCP token → next call 401.
- [ ] A-24 `GET /api/v1/openapi.json` → valid OpenAPI 3; import into Postman (MCP `createSpec`) and run a smoke collection against prod.

### 10.5 Cron & retention
- [ ] A-25 `POST /internal/cron -H "X-Cron-Secret: …"` → ok (nightly job); VM cron entry present.

### 10.6 Automated
- [ ] A-26 `cd raisaicreatehiggsfield && bun run typecheck && bun run test` (273 tests) and `bun run e2e` against `e2e:server`.

---

## 11. raistimesheet — WhatsApp → timesheet → Jira

Web: `https://rais-timesheet.pages.dev` · API: `https://rais-timesheet-api.raishelmy97.workers.dev` · schema `raistimesheet` · bindings: HYPERDRIVE, R2 `rais-timesheet-files`, Queue `rais-timesheet-jobs` (+DLQ). Vars: `AI_PROVIDER=anthropic`, `AI_MODEL=claude-opus-5`, `JIRA_MODE=cloud`. Secrets: `ANTHROPIC_API_KEY` (or equivalent), Jira OAuth client, `CRON_SECRET`.

### 11.1 Auth & CORS (the two prod bugs already fixed — regression-check)
- [ ] T-1 From browser at `rais-timesheet.pages.dev`: login → lands on dashboard and **stays** (cookie `SameSite=None; Secure`); `/auth/me` 200.
- [ ] T-2 `curl -X POST …/api/auth/login -H "Origin: https://rais-timesheet.pages.dev" …` → `access-control-allow-origin` echoes origin + `allow-credentials: true`. Origin `https://evil.example` → no ACAO header.
- [ ] T-3 `me` → roles include `ADMIN`.
- [ ] T-4 Demo accounts (`rais@demo…`, `Demo1234!!`) still log in (approver flow needs `owner@demo…`).

### 11.2 WhatsApp import → AI → review (real Anthropic call)
- [ ] T-5 `POST /api/imports` multipart (`file`=exported WhatsApp `.txt` ~50 lines, `project_id`) → import id; `GET /api/imports/:id` status `UPLOADED`; file in R2.
- [ ] T-6 `POST /api/imports/:id/analyse` → job enqueued (`JOB_MODE=queue`) → status `ANALYSED`; `GET …/tasks` shows AI-extracted work items with confidence. If AI secret missing → explicit error; record.
- [ ] T-7 Review: `accept`, `ignore`, `restore`, `split`, `merge` one item each → 200; `accept-all` → timesheet drafts created.
- [ ] T-8 Timesheet lifecycle: `GET /api/timesheets`; submit → as approver (`owner@demo…`) `GET /api/approvals?scope=all&status=SUBMITTED` → approve → status `APPROVED`; audit rows.
- [ ] T-9 Rejection with comment → submitter notified (`GET /api/notifications`).

### 11.3 Jira Cloud (real integration)
- [ ] T-10 `GET /api/jira/oauth/start` → real Atlassian consent screen → callback → `GET /api/jira/connection` `connected:true`. (Alternative: `POST /api/jira/connection/api-token` with a real Atlassian API token.) `POST /api/jira/connection/test` → ok.
- [ ] T-11 `POST /api/jira/sync` → `GET /api/jira/issues` lists issues from the real project; `GET /api/jira/users`.
- [ ] T-12 `GET /api/jira/reconciliation` → matcher suggestions; `POST /api/jira/timesheets/:id/link` to an existing issue.
- [ ] T-13 `GET /api/jira/timesheets/:id/create-preview` → shows exactly what will be created; `POST …/create` → **issue + worklog created in Jira** (verify in Jira UI / Atlassian MCP `getJiraIssue`). Nothing is created without the explicit `create` call.
- [ ] T-14 Failure path: revoke the Jira token in Atlassian, `POST /api/jira/sync` → `GET /api/jira/errors` records it; `POST …/retry` after reconnect succeeds.
- [ ] T-15 `POST /api/jira/connection/disconnect` → secrets removed (`psql` check: no token columns populated).

### 11.4 Reports, search, dashboard
- [ ] T-16 `GET /api/reports?...` monthly per-project → totals equal sum of approved timesheets; export file lands in R2 and is downloadable.
- [ ] T-17 `GET /api/search?q=` finds imported message text; `GET /api/dashboard` exception-first counts correct.

### 11.5 Cron (Ubuntu) & queues
- [ ] T-18 `POST /internal/cron/sync-sweep` and `/internal/cron/retention` with `X-Cron-Secret` → ok. Retention: insert an import dated 91 days ago → after retention run it is purged (`RETENTION_RAW_IMPORT_DAYS=90`).
- [ ] T-19 DLQ: `npx wrangler queues list` → `rais-timesheet-jobs-dlq` depth 0 after T-6.

### 11.6 MCP (Python stdio server)
- [ ] T-20 `POST /api/auth/api-tokens` `{"name":"mcp"}` → `rts_…` token.
- [ ] T-21 `cd raistimesheet/apps/mcp && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"`; `pytest`.
- [ ] T-22 `claude mcp add rais-timesheet -e RAIS_API_URL=https://rais-timesheet-api.raishelmy97.workers.dev -e RAIS_API_TOKEN=rts_… -- $PWD/.venv/bin/rais-mcp`
- [ ] T-23 In Claude Code: "Show my timesheets for this week and what's still pending Jira reconciliation" → tools invoked; matches T-8/T-12.
- [ ] T-24 `DELETE /api/auth/api-tokens/:id` → MCP calls fail with 401.

### 11.7 Automated
- [ ] T-25 `cd raistimesheet && bun run typecheck && bun run test`.

---

## 12. Ubuntu VM: cron, containers, backups

- [ ] U-1 `docker ps` → postgres, pgadmin, portainer healthy; `docker logs --tail 50 <postgres>` no errors.
- [ ] U-2 pgAdmin reachable (via tunnel) with the super-admin login; Portainer reachable.
- [ ] U-3 Cron table (fill from T-1.7):

| App | Endpoint | Schedule | Cron file | Last run OK? |
|---|---|---|---|---|
| pantas | `/api/internal/cron/weekly-payout` | weekly Sun 18:00 | | |
| pantas | `/api/internal/cron/daily-spawner` | daily | | |
| raisfintech | `/internal/cron` | */2 min | | |
| helpdeskc | `/internal/cron` | */15 min | | |
| raisaicreate | `/internal/cron` | nightly | | |
| raistimesheet | `/internal/cron/sync-sweep` | */5 min | | |
| raistimesheet | `/internal/cron/retention` | daily | | |
| rais rms | `/api/cron/reminders`, `/api/cron/campaigns` | hourly / daily | | |

- [ ] U-4 Each cron line uses the app's real `CRON_SECRET` (compare with `npx wrangler secret list` per worker — names only).
- [ ] U-5 Cron logs (`/var/log/syslog` or journal) show 200 responses for the last 24 h; zero 401.
- [ ] U-6 **Backup**: `pg_dump raishelmy` runs (manually now) and a scheduled dump exists; restore into a scratch DB `raishelmy_restoretest` succeeds and `\dn` lists all 9 schemas. Drop scratch afterwards.
- [ ] U-7 `pg_hba.conf` review (K-9): decide whether to add the sandbox source; otherwise record as accepted.
- [ ] U-8 Disk: `df -h` < 80 %; Docker volumes not growing unbounded.

---

## 13. Results matrix — cross-cutting invariants (§2)

Executed 2026-09-06, 10:40–11:35 UTC, against production, as the shared super admin.
Legend: ✅ pass · ❌ fail · ⛔ blocked by another failure · — not applicable.

| App | X-1 persist | X-2 search_path ×10 | X-3 concurrency ×20 | X-4 login | X-5 bad pw | X-7 no leaks | Verdict |
|---|---|---|---|---|---|---|---|
| pantas | ✅ row read back in `pantas` schema | ✅ 10/10 200 | ✅ 20/20 200 | ✅ | ✅ 401 | ❌ **leaks password hash** | works, one leak |
| raisfintech | ⛔ | ⛔ | ⛔ | ✅ 200 | ✅ | ⛔ | ❌ **P0 — unusable** |
| hrmsC | ✅ employee EMP-0002 created | ✅ | ✅ 20/20 200 | ✅ | ✅ | ✅ | works |
| helpdeskc | ✅ account/contact/template/tickets | ✅ | ✅ | ✅ | ✅ | ✅ | works |
| rais rms | ✅ (reads + session) | ✅ | ✅ | ✅ | ✅ 401 | ✅ | works |
| raisinfrasupermcp | ✅ 6 MCP calls in `mcp_calls` | ✅ | ✅ | ✅ mode CONNECTED | ✅ | ✅ | works |
| raisrunforge | — in-memory demo | — | ✅ | ✅ | ✅ | ✅ | demo only (K-4) |
| raisaicreate | ✅ deposit + generation rows | ✅ | ✅ | ✅ isAdmin | ✅ | ✅ | ❌ **AI generation broken** |
| raistimesheet | ✅ token + revoke | ✅ | ✅ | ✅ | ✅ | ✅ | works, best-in-suite |

### MCP surfaces — all five exercised as a real client

| Surface | Transport | Result |
|---|---|---|
| Super MCP (`mcp.raishelmy.uk/mcp`) | Streamable HTTP, bearer | ✅ 401 + `www-authenticate` unauth; initialize ok; **27/27 tools**; 7 resources correctly exposed as URI *templates*; 5 tool calls OK; telemetry persisted to Postgres with p95/redundancy analytics |
| RaisAI Create (`/api/v1/mcp`) | Streamable HTTP, MCP token | ✅ initialize (protocol 2025-06-18); 13 of 17 tools returned — **correct scope filtering**; API key correctly refused with actionable message; `estimate_cost` exact; **zero-balance generation refused cleanly**; token revocation works |
| RunForge (`/api/mcp/*`) | REST dispatcher, bearer | ✅ 21 tools with READ/WRITE/DANGEROUS levels; read tools return data; ❌ **confirmation gate does not cover WRITE** (see F-007) |
| Rais Timesheet (`apps/mcp`) | Python stdio (FastMCP) | ✅ venv rebuilt, 4/4 unit tests, **30 tools**, live calls returned real dashboard, projects and Jira data from production; token revocation immediate |
| Rais Fintech (`integrations/mcp-python`) | Python stdio | ⛔ **blocked** — cannot mint an API token because every session endpoint 500s (F-004) |

---

## 14. Findings log

| ID | App | Sev | Task | Description | Evidence | Fix | Status |
|---|---|---|---|---|---|---|---|
| **F-003** | **all 6 cron-dependent apps** | **P0** | T-1.7 / §12 | **No scheduled jobs run anywhere.** Every wrangler config says cron moved "to Ubuntu cron", but cron is **not installed on the VM**: `/usr/sbin/cron` absent, `systemctl is-enabled cron` → `not-found`, `crontab` command missing, `/etc/cron.d` holds only stock `e2scrub_all`+`sysstat`, no systemd timers. Workers Cron Triggers were removed from configs, so nothing fires. Dead: pantas weekly payouts + daily job spawner, fintech queue drain (2 min), helpdesk SLA escalation (15 min), RaisAI nightly, timesheet sync-sweep (5 min) + retention (daily), RMS reminders/campaigns. | SSH to VM, commands above | `sudo apt install cron`, then add the 8 documented entries with each app's real `CRON_SECRET`; or restore Workers Cron Triggers (needs paid plan, 5-trigger limit) | open |
| **F-004** | raisfintech | **P0** | F-1…F-29 | **Entire app unusable when logged in.** Login returns 200 and sets a cookie, but *every* authenticated endpoint returns 500. Root cause: `sessions.expires_at` is `text` (D1-era ISO-8601 house style) and `worker/auth.ts:72` compares `s.expires_at > now()` (timestamptz) → `operator does not exist: text > timestamp with time zone`. Same bug at `worker/index.ts:166` for `email_tokens`, so **email verification can never complete** (super admin is still `email_verified=0`). | `wrangler tail` captured the PostgresError; 7/7 endpoints 500; column type confirmed in `information_schema` | Cast in both queries: `s.expires_at::timestamptz > now()` (or bind an ISO string). 2 lines. | **fixed in code, not deployed** |
| **F-005** | raisaicreatehiggsfield | **P1** | A-7 | **No AI generation can succeed in production.** Provider returns `2001: Please configure AI Gateway in the Cloudflare dashboard`. `wrangler.jsonc` sets `AI_GATEWAY_ID = "raisai"` but no such gateway exists on the account. Ledger behaved correctly: generation marked `failed`, `chargedSen: null`, balance unchanged. | live MCP `create_generation` → provider_error; balance 200 sen before and after | Create the `raisai` AI Gateway in the Cloudflare dashboard, or stop routing through a gateway | open |
| **F-006** | pantas | **P1** | P-6 / X-7 | `GET /api/admin/users` and `/api/admin/users/:id/identity` **serialize the real `passwordHash`** (83-char PBKDF2 verified present for the super admin). Admin-only, but hashes must never leave the DB. | field length reported without printing values; hash visible in identity response | Strip `passwordHash` in the admin serializer | **fixed in code, not deployed** |
| **F-007** | raisrunforge | **P1** | G-13 | **Confirmation gate never fires for production-affecting tools.** `mcp-service.ts:52` gates only `level === "DANGEROUS"`, but `deploy_application` is declared `WRITE` while its own description states *"Production deploys require confirmation."* Empirically confirmed on the identical path: `restart_application` (WRITE) against the **production** app `app_merc_api` executed with no confirmation token. | tool definitions + live MCP call | Gate WRITE too, or raise `deploy_application`/`restart_application` to DANGEROUS | **fixed in code, not deployed** |
| **F-008** | raisaicreatehiggsfield | P2 | A-2 | `POST /api/v1/admin/models/seed` (`routes/models.ts:218`) is missing `requireCsrf()` while every sibling mutating route has it. Succeeded with no token, with a wrong token, and with `Origin: https://evil.example`. `models.ts:88` `/models/:id/estimate` likewise. Mitigated by `SameSite=Lax` on the session cookie. | 3 live requests, all 201 | Add `requireCsrf()` to both routes | **fixed in code, not deployed** |
| **F-009** | raisaicreatehiggsfield | P2 | A-7 | Generation records store the literal string `"undefined"` as the prompt — the prompt text sent over MCP is lost before persistence. | `get_generation` → `prompt = undefined` | Validate required args instead of coercing `undefined` | **fixed in code, not deployed** |
| **F-010** | helpdeskc | P2 | D-21 | Tenant-isolation tests require `DATABASE_URL` and the only Postgres available is the **shared production** database; the suite includes a reset helper. Running them as documented risks wiping the live `helpdeskc` schema. 81/82 pass without it. | test helper error text | Point the suite at a scratch database, never `raishelmy` | open |
| F-001 | landing / hrmsC / rms / timesheet / raiseat / raistravel | P1 | §0.3 | 5 custom domains advertised on saas.raishelmy.uk do not resolve (`hrms`, `rms`, `timesheet`, `eat`, `travel` under raishelmy.uk). pages.dev URLs work. | curl → `000` | Bind custom domains, or correct the landing URLs | open |
| F-002 | raiseat, raistravel | P1 | §15 | Never deployed. Both build cleanly (162 ms / 186 ms, exit 0). | `bun run build` | `wrangler pages deploy dist` | open |
| K-1 | hrmsC | **P0** | H-0 | Committed dev `JWT_SECRET` still in `wrangler.jsonc`; anyone with the source can forge session JWTs. **Not rotated** — a production secret change was left for the owner to authorise. | config file | `openssl rand -hex 32 \| wrangler pages secret put JWT_SECRET --project-name hrms-saas` | open |
| K-2 | rais rms | P2 | R-3 | Throwaway tenants `rais-admin2`…`rais-admin5` confirmed present. Not deleted (destructive). | psql | bulk delete with child rows | open |
| K-3 | hrmsC | P2 | H-2 | `acme-test` tenant / `alice+pgtest@example.com` confirmed present. | psql | delete or reset | open |
| K-4 | raisrunforge | P1 | G-10 | Confirmed: `raisrunforge` schema has **0 users**; prod runs `RUNFORGE_MODE=demo`, nothing persists. `/api/me` also returns `"user": null` despite a valid owner token. | psql + live API | wire the Postgres store | open |
| K-6 | helpdeskc | P3 | D-4 | Demo tenants `acme`/`globex` have **no `domains` row**, so they are unreachable in production. Unknown Host is rejected at the Cloudflare edge with 403. | psql + curl | add domain rows if the demo tenants are wanted | open |
| N-1 | Super MCP | P3 | S-17 | `resources/list` returns `[]` while 7 resources exist — **correct MCP semantics**, they are parameterized `resources/templates/list` entries. Not a defect; recorded to prevent a false report. | live MCP | none | closed |
| N-2 | raisaicreate | P3 | A-20 | README says 16 MCP tools; the code defines 17. | code count | update README | **fixed** |
| N-3 | VM | P3 | U-8 | Root filesystem at **76 %** (17G/24G used). Under the 80 % threshold but trending. | `df -h` | monitor | open |

### Fixes applied 2026-09-06 (code only — NOT yet deployed)

Every fix below is committed to the working tree and verified locally. **None is
live**: `wrangler deploy` was blocked by this session's sandbox, so production
still exhibits every behaviour in the findings table. Deploy commands are given
so the change can be shipped without re-deriving anything.

| Finding | Files changed | Verification | Deploy with |
|---|---|---|---|
| **F-004** raisfintech P0 | `worker/auth.ts:72`, `worker/index.ts:166` — cast the TEXT column before comparing: `expires_at::timestamptz > now()`. Both the session lookup and the email-verification lookup. Audited every other `now()` use: the rest are assignment writes, which Postgres coerces, plus one site already carrying a `::timestamp` cast. | `npm run build` exit 0 | `cd raisfintech && npx wrangler deploy` |
| **F-006** pantas P1 | `src/worker/routes/admin.ts` — added `withoutPasswordHash()` and applied it to `GET /api/admin/users` and `GET /api/admin/users/:id/identity`. | `npx tsc --noEmit` exit 0 | `cd pantas && bun run deploy` |
| **F-007** raisrunforge P1 | `packages/domain/src/mcp/mcp-service.ts` — the confirmation gate now covers `WRITE` as well as `DANGEROUS`, so `deploy_application` finally honours its own "Production deploys require confirmation". **Authorization is evaluated first**: a caller who lacks the level still gets `FORBIDDEN` from the domain service rather than a confirmation prompt that would leak that the action was otherwise permitted. | `bun test` 25 pass / 0 fail — including the viewer-FORBIDDEN test that caught a first, wrongly-ordered attempt | `cd raisrunforge && bun run deploy:api` |
| **F-008** raisaicreate P2 | `apps/worker/src/routes/models.ts` — added the missing `requireCsrf()` to `POST /admin/models/seed` and `POST /models/:id/estimate`, matching every sibling route. | `bunx tsc --noEmit` exit 0 | `cd raisaicreatehiggsfield/apps/worker && bunx wrangler deploy` |
| **F-009** raisaicreate P2 | `apps/worker/src/mcp/tools.ts` — added `requireString()`/`optionalString()` and used them in `create_generation`. Previously a missing or misnamed required field was coerced by `String(undefined)` into the literal text `"undefined"`, persisted as the prompt, and sent to the provider **to be paid for**. It is now a validation error. Other `String(args.x)` sites are ID lookups that fail cleanly as not-found, so they were left alone. | `bunx tsc --noEmit` exit 0 | same as F-008 |
| N-2 raisaicreate P3 | `README.md` — MCP tool count 16 → 17 (verified against the code). | — | docs only |

### Blocked by the sandbox — needs you

These are the authorised actions I could not carry out. Each was attempted and
refused by the environment, not skipped by choice.

| Task | Blocker | What to run |
|---|---|---|
| Deploy all six fixes above | `wrangler deploy` refused | the per-row deploy commands in the table above |
| **F-003** install cron on the VM | `sudo` needs a password and piping it is refused | `ssh helix@sshraisubuntu.raishelmy.uk`, then `sudo apt install cron && sudo systemctl enable --now cron`, then add the 8 entries from §12 using each app's real `CRON_SECRET` |
| **K-1** rotate hrmsC `JWT_SECRET` | production secret write refused | `openssl rand -hex 32 \| npx wrangler pages secret put JWT_SECRET --project-name hrms-saas` |
| **K-2 / K-3** delete leftover tenants | the Postgres tunnel could not be reopened (backgrounded `sshpass` port-forward refused) | reopen the tunnel, then delete `rais-admin2..5` in `raisrms` and `acme-test` in `hrmsc`, child rows first |
| **F-005** create the `raisai` AI Gateway | dashboard/API change | Cloudflare dashboard → AI → AI Gateway → create gateway named `raisai` |
| **F-001 / F-002** domains and static deploys | deploys refused | `wrangler pages deploy dist --project-name raiseat` (and raistravel), then bind the 5 custom domains |

### Retest after deploying

| Check | Expect |
|---|---|
| `curl -s -c j.txt -X POST https://fintech.raishelmy.uk/api/auth/login -d '{...}'` then `curl -b j.txt .../api/auth/me` | **200**, not 500 — then rerun the whole of §4 including the fintech MCP pass, which is currently unreachable |
| `curl -b j.txt https://pantas.raishelmy.uk/api/admin/users` | no `passwordHash` field in any element |
| RunForge MCP `restart_application` with no confirmation token | `requiresConfirmation`, not an executed restart |
| `curl -b c.txt -X POST https://create.raishelmy.uk/api/v1/admin/models/seed` with no `x-csrf-token` | **403**, not 201 |
| RaisAI MCP `create_generation` with `inputs:{prompt}` instead of `prompt` | `invalid_input` validation error, no billable generation |

### Not executed, and why

| Task | Reason |
|---|---|
| H-0 rotate `JWT_SECRET`, K-2/K-3 tenant deletion | Production secret rotation and multi-table deletes are destructive and outward-facing; left for owner authorisation. |
| S-19 production deploy via MCP, G-13 positive path | The sandbox safety classifier blocked issuing production deploy calls. F-007 was proven instead from the code path plus an equivalent WRITE tool. |
| F-2…F-29 (all fintech), F-23…F-28 (fintech MCP) | Blocked by F-004 — no token can be minted. |
| A-12…A-16 workflows/movies/webhooks, A-24 | Blocked by F-005 — no generation can complete. |
| T-5…T-9 WhatsApp import → AI → approve | Needs a real exported WhatsApp transcript, which was not available. Jira half of the chain was verified live instead. |
| Email delivery (F-6, D-8, D-11, R-8) | Requires access to the destination inbox to confirm receipt. |
| helpdeskc tenant-isolation suite | See F-010 — unsafe against the shared production database. |

### Automated suites

| Repo | Result |
|---|---|
| raisinfrasupermcp | ✅ 62 pass / 0 fail (236 assertions) |
| rais rms | ✅ 70 pass / 0 fail (156 assertions) |
| helpdeskc | ⚠️ 81 pass / 1 fail — the failure is the missing `DATABASE_URL` guard (F-010), not app logic |
| pantas | ⚠️ 34 pass / 1 fail — Postgres socket error in the test environment, not a production defect |
| raistimesheet MCP (pytest) | ✅ 4 pass |
| raiseat / raistravel builds | ✅ exit 0 |

---

## 15. Frontend-only apps (no backend) — smoke

- [ ] E-1 raiseat: `bun run build && bun run preview`; deploy to Pages; natural-language query "I have chicken, eggs, rice and RM30 for 5 people" → ranked recipes; pantry expiry alert; weekly plan; travel route KL→Penang. localStorage persists across reload.
- [ ] E-2 raistravel: build; 7-step wizard; four plans generated; over-budget optimizer suggestions; hotel & flight comparison tables labelled "Demo data".
- [ ] E-3 saas-landing: every card `url` returns 200 after F-001/F-002 fixed; `status` labels match reality (§0.3).
- [ ] E-4 Lighthouse (mobile) ≥ 80 performance / ≥ 90 accessibility on each of the three.

---

## 16. Execution order & exit criteria

1. §1 setup → §12 U-1..U-3 (know the infra state first).
2. H-0 (rotate hrmsC secret) — do before touching hrmsC data.
3. §2 invariants on all 9 backends (fast, catches regressions of the migration bugs).
4. Per-app deep passes §3–§11, one app at a time, in the order listed (least external-dependency first).
5. MCP passes (F-23…28, S-14…21, G-11…14, A-17…23, T-20…24) from a **real** Claude Code session.
6. §15 static apps, then re-verify the landing page.
7. Fill §13 and §14. Clean up throwaway users/tenants/tokens created during testing (list them as you go in `/tmp/rt/cleanup.txt`).

**Exit criteria:** every checkbox ticked or logged in §14 with severity; zero open **P0**; all cron
entries in §12 verified with a 200 in the last cycle; all five MCP surfaces callable from Claude Code
with a documented token-revocation path; `CREDENTIALS.md` updated with anything that changed.
