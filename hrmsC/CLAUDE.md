# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

> **Migrated off D1** — the database is now Postgres, reached via Cloudflare
> Hyperdrive, not D1/SQLite. Every `D1`/`SQLite`/`wrangler d1`
> reference below is left as-is as a historical record of how this was
> originally built; it is no longer accurate for the current codebase. See
> "Database (post-D1-migration)" further down for what actually runs today.
> The old `migrations/*.sql` (SQLite dialect) are kept for history; the
> Postgres-dialect equivalents actually applied to the database live in
> `migrations_pg/*.sql`.
>
> **Second migration: dedicated DB → shared DB + schema.** This app briefly
> had its own dedicated Postgres database (`hrmsc_db`) and its own Hyperdrive
> config (`hd-hrmsc-db`). Both are now retired — the account moved to **one
> shared Postgres database (`raishelmy`) for every app**, with each app
> isolated into its own schema. This app's 37 tables now live in schema
> `hrmsc` inside `raishelmy` (including the smoke-test tenant/vendor rows
> from the original D1→Postgres migration — a single "Acme Test" tenant with
> one admin user, `alice+pgtest@example.com`). There is now only **one
> Hyperdrive config for the whole account** (`raishelmy-hyperdrive`, id
> `7a7777560d434c2b91ff37c52ab1b2c9`), bound the same way as before via the
> `HYPERDRIVE` binding. Since a plain connection string can't set
> `search_path`, `worker/core/db.ts`'s `getDb()` passes `connection: {
> search_path: "hrmsc" }` to postgres.js so every request's client defaults
> to this app's schema — the app's raw SQL keeps referencing tables
> unqualified, unchanged.

A **multi-tenant SaaS HRMS** on Bun + React (Vite) + Cloudflare Pages
Functions (Hono) + D1 + R2. Built and verified end-to-end: auth/tenancy,
Employees, Leave (+ Quota + Encashment + Calendar), Attendance (+ Overtime +
Work Schedule), Claims (+ configurable Claim Types with mileage/advance),
Assets, Vendors, Training, Payroll/Payslips, Recruitment, Uniform
Applications, LTIP equity grants, a generic config-driven Requests module,
file attachments, in-app notifications, task **reassignment**, admin
**account simulation** ("Login As"), a full multi-step approval **routing
engine**, and **tenant-configurable role permissions** (the architectural
centerpieces — see below). 21 domain modules in total. `old_project/`
remains in the repo as a **UI/feature reference only** — it is not part of
the build.

## Stack (as built)

- **Runtime & package manager:** Bun (`bun install`, `bun run <script>`).
- **Frontend:** React 19 + TypeScript, built with Vite, styled with
  `bootstrap` (imported as `bootstrap/dist/css/bootstrap.min.css`, no
  Bootstrap JS/jQuery — all interactivity is React state) + `bootstrap-icons`.
  Client-side routing via `react-router-dom`.
- **Backend:** Hono, mounted as a single Cloudflare Pages Functions catch-all
  route (`functions/api/[[route]].ts` → `worker/app.ts`). All API logic lives
  under `worker/`, not scattered across `functions/`.
- **Database (post-D1-migration):** Postgres, reached through Cloudflare
  Hyperdrive (binding `HYPERDRIVE`, the account's single shared config
  `raishelmy-hyperdrive`, database `raishelmy`). This app's tables are
  isolated in schema `hrmsc` within that shared database (see the note at
  the top of this file). App code talks to it via `postgres` (postgres.js) —
  `worker/core/db.ts`'s `getDb()` builds a fresh client per request from
  `env.HYPERDRIVE.connectionString`, passing `connection: { search_path:
  "hrmsc" }` so the client defaults to this app's schema (Workers forbids
  reusing one request's I/O/socket from another, so the client is
  intentionally *not* cached across requests — Hyperdrive itself pools the
  real Postgres connections).
  `queryAll`/`queryOne`/`exec` kept their exact D1-era signatures (SQL string
  with `?` placeholders + a params array); internally they rewrite `?` to
  `$1, $2, ...` and run it via `sql.unsafe(...)`, so none of the ~150 call
  sites across `worker/modules/**` needed touching. Schema lives in
  `migrations_pg/*.sql` (Postgres dialect — hand-run via `psql` over the SSH
  tunnel documented in this file's dev-setup, not `wrangler d1 migrations`).
  The original `migrations/*.sql` (SQLite dialect) are kept for history, not
  deleted, and are no longer applied anywhere.
- **File storage:** Cloudflare R2 (`ATTACHMENTS` binding) for uploaded files
  — receipts, supporting documents, anything attached to a leave/claim/
  request. Metadata (file name, size, uploader) lives in D1; only the blob
  lives in R2.
- **Auth:** Cookie-based sessions — a JWT (HS256 via `jose`) in an `httpOnly`
  cookie, verified per-request in `worker/core/session.ts`. Passwords hashed
  with PBKDF2-SHA256 via Web Crypto (`crypto.subtle`), no native/Node crypto
  deps (Workers runtime compatible). `JWT_SECRET` is a plaintext `vars` entry
  in `wrangler.jsonc` for local dev only — **must** be overridden with
  `wrangler pages secret put JWT_SECRET` before any real deployment.
- **Validation:** `zod` on every mutating API route.

### Architecture: domain-driven modules, one folder per business domain

Both `worker/` and `src/` are organized **by domain**, mirroring how
`old_project/` has one folder per module (`Employee/`, `LeaveApplication/`,
`Claims/`, `Routing/`, ...) rather than by technical layer. Hard rule: **no
source file exceeds ~500 lines** — split a growing domain into sub-files
(routes vs. service/business-logic vs. types) before it gets there. Current
max is ~285 lines (`worker/modules/leave/quotaRoutes.ts`); see
`worker/modules/leave/` and `worker/modules/workflows/` for the pattern
once a domain outgrows a single `routes.ts`.

```
worker/
  core/                  shared kernel — the only cross-domain code
    db.ts                  D1 helpers (queryAll/queryOne/exec/newId/recordAudit)
    session.ts              JWT + password hashing
    middleware.ts            requireAuth / requireRole (fixed) / requirePermission (tenant-configurable)
    permissions.ts            the 28-key permission catalog + resolution (see "The permission system")
    records.ts                resolves "which employee owns this (module, recordId)"
    types.ts                   Bindings/AppEnv/AuthContext/Role — genuinely cross-cutting only
    slug.ts, dateUtils.ts
  modules/<domain>/     one folder per business domain
    types.ts              domain-only types (never referenced from another domain's types.ts)
    routes.ts              Hono handlers (or split: fooRoutes.ts, barRoutes.ts + index.ts composing them)
    service.ts              business logic pulled out of the HTTP layer where it's non-trivial
  app.ts                 composition root — mounts every module's router under /api

  modules/auth/          tenant registration (service.ts provisions tenant+admin+defaults), login, session
  modules/employees/     directory, CRUD, status lifecycle
  modules/leave/         leaveTypes / balanceService+balancesRoutes / applicationsRoutes / quotaRoutes
                          (routed grant requests + HR direct-grant) / encashmentRoutes (routed payout
                          requests) / calendarRoutes (mine + direct-reports "unit" view), composed in index.ts
  modules/claims/         typesRoutes (configurable claim types incl. mileage-rate + is_advance) +
                           claimsRoutes (submit computes amount from type; mileage auto-calculates from
                           distance), composed in index.ts
  modules/requests/      generic config-driven "employee request" (see below), typesRoutes + requestsRoutes
  modules/attendance/    clock in/out, timesheets
  modules/overtime/       overtime requests (routed by hours as the amount), separate from attendance
                           since it's approval-gated, not a passive clock log
  modules/workschedule/   admin-managed shift templates (name/hours/work-days) + employee assignments by
                           effective date range; not workflow-routed — assigning a shift is direct HR action
  modules/attachments/   R2-backed upload/download/delete, service.ts owns view/upload authorization
  modules/workflows/     the routing engine: engine.ts (pure logic) + definitionsRoutes.ts (admin config)
                          + instancesRoutes.ts (routing-trail viewer + tenant-wide log)
                          + reassignRoutes.ts (hand a pending step to a different employee, any module)
  modules/simulate/       admin "Login As" impersonation — deliberately its OWN top-level module (not
                           nested under modules/admin/'s blanket requireRole("admin")), see "Account
                           simulation" below for why
  modules/admin/         usersRoutes + auditLogRoutes + permissionsRoutes (view/edit role_permissions), index.ts composes
  modules/dashboard/      role-aware summary
  modules/assets/         registry + assignment log (no workflow — direct admin/hr actions)
  modules/vendors/        registry, pure CRUD, no workflow
  modules/training/       programs.routes + enrollments.routes (routed) + evaluations, index.ts composes
  modules/payroll/        payslip records — admin-generated, employee-viewed, no workflow
  modules/recruitment/    postings.routes + applications.routes — a pipeline (submitted→hired), NOT
                           routed through the workflow engine (multi-stage, not binary approve/reject)
  modules/uniform/        items.routes (catalog) + orders.routes (multi-line, routed), index.ts composes
  modules/notifications/  in-app notifications — service.ts is called BY worker/modules/workflows/engine.ts
                           (workflows → notifications is the only allowed direction; never the reverse)
  modules/ltip/           equity grants — admin offers, employee accepts/declines, vesting computed on
                           read from vesting_start/vesting_end (not a stored ledger). No workflow — the
                           "approval" already happened when management decided to grant it.

functions/api/[[route]].ts   Pages Functions entrypoint → worker/app.ts (thin adapter only)
migrations/                  0001 through 0015, one per domain added after the initial schema

src/
  types/                 same domain split as worker/modules, plus an index.ts barrel
                          (existing `from "../../types"` imports resolve to types/index.ts)
  lib/csv.ts               client-side CSV export (see "Reports" below)
  api/client.ts            fetch wrapper (credentials: include, typed ApiError)
  auth/AuthContext.tsx      session state, login/registerTenant/logout
  components/               Layout, Sidebar, Topbar, ProtectedRoute, StatusBadge, AttachmentPanel,
                              RoutingTrail, EmployeePicker (searchable, server-side via /employees?q=),
                              NotificationBell (polled unread count + dropdown, mounted in Topbar)
  pages/<domain>/            one folder per domain, e.g. leave/, claims/, requests/, employees/,
                              admin/workflows/ (index.tsx + StepEditor.tsx once a page outgrows one file)
```

`App.tsx` and `Sidebar.tsx` are themselves data-driven (a `routes: RouteDef[]` array and a
`SECTIONS: NavSection[]` array respectively, each with an optional `roles` gate) rather than
repeating JSX per route/nav-item — add a new domain by appending an entry, not by copying
boilerplate. This was a deliberate refactor once the per-route JSX pattern started costing more
lines than it was worth around domain #10.

### Commands

- `bun run typecheck` — `tsc -b --noEmit` across both the app and worker
  TS projects (`tsconfig.app.json`, `tsconfig.worker.json`).
- `bun run build` — typecheck + `vite build` → `dist/`.
- `bun run db:migrate:local` — retired (no-op that prints where to look).
  Postgres schema changes are hand-run against the shared `raishelmy`
  database's `hrmsc` schema with `PGOPTIONS="-c search_path=hrmsc" psql
  "$DATABASE_URL" -f migrations_pg/000N_*.sql` (the `search_path` matters —
  without it, a bare `psql raishelmy` session defaults to `public`, which
  is shared with every other app's tables), over the SSH tunnel to the
  Postgres Docker container (`sshpass -p '...' ssh -L 15432:localhost:5432
  helix@sshraisubuntu.raishelmy.uk`, then `psql
  postgresql://postgres:postgres@localhost:15432/raishelmy`) — there is no
  local-emulated Postgres the way `--local` D1/R2 worked.
- `bun run preview` (or `bun run dev`, which builds first) — `wrangler pages
  dev dist --local`, serving the built frontend **and** the Pages Functions
  API together on `http://localhost:8788`. R2 is local-emulated; the
  `HYPERDRIVE` binding resolves via `localConnectionString` in
  `wrangler.jsonc`, which points at the same SSH tunnel above — so local dev
  hits the real remote shared `raishelmy` database (this app's `hrmsc`
  schema within it, via `getDb()`'s `search_path`), not a local database.
  Keep the tunnel open before running this.
- `bun run dev:vite` — Vite dev server only, for fast frontend iteration;
  `vite.config.ts` proxies `/api` to `:8788`, so run `bun run preview` in a
  second terminal alongside it if you need live API calls.

Nothing has been deployed to a real Cloudflare account yet — `wrangler pages
dev` above already talks to the real, already-provisioned shared `raishelmy`
database (`hrmsc` schema)/Hyperdrive/R2 for local iteration, but `wrangler
pages deploy` (setting a real `JWT_SECRET` secret, a custom domain) is a
deliberate follow-up step, not done as part of this build.

## The routing engine (`worker/modules/workflows/`)

This is the piece `old_project`'s `Process/`/`Routing/`/`RoutingLogs/`/
`Scheduler/`/`CustomWorkflowConfig/` folders implement, rebuilt as a proper
generic engine instead of each module hardcoding its own approver. It's what
every submission-based module (leave, claims, employee requests, and any
future one) routes through — **do not** reintroduce a hardcoded
`approver_id = employee.manager_id` shortcut in a new module; call
`startWorkflow` / `decideCurrentStep` / `cancelWorkflow` from
`worker/modules/workflows/engine.ts` instead.

- **`workflow_definitions`**: per tenant, per `module` (a free-form string —
  not DB-constrained, so new modules never need a migration to participate),
  optionally scoped to a `category` (e.g. a specific leave_type_id) and/or an
  amount range. Matching picks the most specific active definition; a
  definition with no category/amount is the catch-all.
- **`workflow_steps`**: ordered steps on a definition. Each step's approver
  is one of `employee_manager` (walks the employee's `manager_id` chain N
  levels, configurable), `role` (any active user with that role — currently
  `admin`/`hr`), or `specific_user` (one named person).
- **`workflow_instances`** + **`workflow_step_actions`**: created at submit
  time. Every step's approver is *resolved and stored* immediately (not
  computed lazily), so the full future path is visible from the start (the
  routing-log/trail UI) and query-able with a simple join, not a runtime
  walk.
- **Who can act on a step** (`canActOnStep` in `engine.ts`) is a strict
  three-way check, in this order: (1) `admin` always; (2) the employee the
  step is *personally* resolved to (`resolved_approver_employee_id ===
  auth.employeeId`), regardless of their role or permissions — this is what
  makes **reassignment** (below) actually work for any employee, not just
  hr/manager; (3) anyone whose role currently holds the module's
  `approvePermissionKey` via `hasPermission`. There is **no** hardcoded
  `role === "hr"` universal bypass — that used to exist and was a real bug
  (see "Task reassignment" below). Every approvals-queue `GET` endpoint mirrors
  this: it computes `hasPermission(...)` once, and only adds a `WHERE
  resolved_approver_employee_id = ?` scope if that's false — never gates the
  whole route behind `requirePermission`, or a personally-reassigned task
  becomes invisible/unapprovable to its new holder.
- **Every module that calls `startWorkflow` must add an entry to
  `OWNER_TABLE_BY_MODULE` in `worker/core/records.ts`** (module string →
  table name), or two things silently break: the routing-trail viewer
  (`GET /workflows/instances/:id`) 403s the record's own owner (it can't
  prove they own it), and the reassignment search
  (`worker/modules/workflows/reassignRoutes.ts`'s `GET /tasks`) shows the
  task with a blank applicant name/label. This bit the Overtime module
  during this build (caught live via curl, fixed by adding the
  `records.ts` entry) — added proactively for Leave Quota/Encashment
  afterward. Treat it as a required step, not an optional nicety, whenever
  a new workflow-routed module is added.
- Every tenant is seeded with a single-step "employee's manager approves"
  default per module at registration (`worker/modules/auth/service.ts`) —
  admins extend it from **Admin > Workflow Routing**
  (`src/pages/admin/workflows/`) without touching code: add steps, make
  them role-based, add category- or amount-gated variants (e.g. claims over
  $1000 need a second HR step).
- Verified end-to-end: default single-step routing, an admin-configured
  2-step (manager → HR-role) chain with correct step-gating, amount-range
  matching routing a $50 vs $2500 claim through different chains, mid-flight
  cancellation skipping remaining steps, and delete-protection on a
  definition already used by an instance.

## Task reassignment (`worker/modules/workflows/reassignRoutes.ts`)

old_project's `ReAssignTask` search, generalized across every workflow-routed
module. `POST /workflows/reassign` is module-agnostic by construction — it
just rewrites `workflow_step_actions.resolved_approver_employee_id` (and
clears `resolved_approver_role`, so a role-type step becomes personally
held) by step-action id, with no per-module branching, so it needs no
changes when a new module is added. The audit trail lives directly on
`workflow_step_actions` (`reassigned_from_employee_id`,
`reassignment_comment`, `reassigned_at`) rather than a separate table, and
`RoutingTrail.tsx` renders it inline on the step it happened to.

`GET /workflows/reassign/tasks` (the search UI's data source), by contrast,
*is* per-module — it `LEFT JOIN`s each submission table by module to resolve
an applicant name and a human record label — so a new workflow-routed module
needs a matching `LEFT JOIN` block added there (see the `records.ts` note
above; the two are almost always forgotten or added together).

Gated by `workflows.reassign_tasks` (hr-default permission, not admin-only)
via `requirePermission` on the whole sub-router.

## Account simulation (`worker/modules/simulate/`)

old_project's `AccountSimulator` — admin "Login As" another user, for
support/debugging without knowing their password. Implemented as a
backup-cookie swap in `worker/core/session.ts`: `startSimulation` stashes
the admin's current session JWT in a second cookie
(`hrms_admin_session`) before issuing a short-lived (2h) session for the
target user; `stopSimulation` restores it. The JWT carries
`simulatedByUserId`/`simulatedByName` for the duration, surfaced as a
persistent yellow `SimulationBanner` in the frontend `Layout` with a
"Return to admin" button.

**Why this is its own top-level module, not nested under
`worker/modules/admin/`:** `admin/index.ts` gates its whole sub-router with
a blanket `requireRole("admin")`. If `/simulate/stop` lived there, it would
become unreachable mid-simulation — the session's `role` claim is the
*target's* role by then, not `admin`, so the blanket guard would 403 the
very request needed to end the simulation. `POST /:employeeId/start` is
`requireRole("admin")`; `POST /stop` is just `requireAuth` — its real
security boundary is `stopSimulation()`'s backup-cookie validation, not the
route guard. This was caught by reasoning through the mount order before
writing any tests, not by a live bug — worth remembering as a general
pattern: **a stop/undo/exit endpoint for a privileged action must never
sit behind a guard that the privileged action itself invalidates.**

## The permission system (`worker/core/permissions.ts`)

Tenant-configurable RBAC — but built as a deliberately narrower, safer thing
than "arbitrary named custom roles," and it's worth understanding why before
touching either this or the routing engine, since they're coupled:
`workflow_steps.approver_role` and the JWT's `role` claim both depend on
`Role` staying the exact 4-value `"admin" | "hr" | "manager" | "employee"`
union. Renaming or open-ending that type would cascade into the routing
engine's "notify everyone with this role" / `canActOnStep` logic. So instead
of inventing tenant-defined role names, admins get **per-tenant permission
toggles on the existing 4 roles** — 28 permission keys (`PERMISSION_KEYS` in
`worker/core/permissions.ts`), one per route that used to be a hardcoded
`requireRole("admin", "hr")` or `requireRole("admin", "hr", "manager")`.
The original 20 came from the first RBAC pass; 8 more (
`workflows.reassign_tasks`, `claims.types.manage`, `overtime.manage`,
`overtime.approve`, `workschedule.manage`, `leave.quota.manage`,
`leave.quota.approve`, `leave.encashment.approve`) were added alongside the
features that needed them. **The frontend union
(`src/types/permission.ts`'s `PermissionKey`) is hand-kept in sync with the
backend's `PERMISSION_KEYS` — not shared code — so adding a key means
editing both files, or `tsc -b` fails on the frontend with a
`PermissionKey` mismatch** (this happened during this build; caught
immediately by `bun run typecheck`, not runtime).

- **`role_permissions`** table stores only *deviations* from default — no
  row for a (tenant, role, key) means "use the hardcoded default," so adding
  a new permission key later needs no backfill migration for existing
  tenants. `admin` never appears in this table (DB `CHECK` enforced) — it's
  a fixed superuser checked before the table is ever consulted, both so an
  admin can never lock themselves out and so the safety rail can't itself be
  misconfigured away.
- **Deliberately NOT permission-customizable** — these stayed hardcoded
  `requireRole("admin")` and were never touched in this pass: `employees`/
  `vendors`/`payroll` **delete**, and all of `worker/modules/admin/` (user
  account creation, the audit log). Single-actor, hard-to-reverse
  operations are a real risk if a permission gets misconfigured; the 28
  keys that *are* configurable are all "which of my non-admin roles can
  manage/approve module X" — genuine business decisions, not security
  boundaries.
- `requirePermission(key)` (`worker/core/middleware.ts`) is the enforcement
  point — a drop-in sibling to `requireRole`, async because it may hit the
  DB. Every route guard that gates a "manage"/"approve" action uses this,
  not `requireRole`; **any new module's "manage"/"approve"
  routes should use `requirePermission`, not `requireRole`**, to stay
  consistent.
- The frontend mirrors this exactly rather than re-deriving it: `GET
  /auth/me` returns a resolved `permissions` map alongside `auth`/`tenant`
  (computed via `resolveAllPermissions`), `AuthContext` exposes a `can(key)`
  helper, and both `App.tsx`'s route table and `Sidebar.tsx`'s nav config
  take a `permission` field alongside the fixed `roles` field — every page
  that used to gate on `auth.role === "admin" || auth.role === "hr"` now
  calls `can("...")` instead, so a role granted a permission via **Admin >
  Role Permissions** (`src/pages/admin/RolePermissions.tsx`) actually sees
  the corresponding nav items and buttons, not just an API that happens to
  allow it.
- Verified end-to-end (original 20-key pass, still holds with the 8 added
  since): `admin`'s resolved map is all-true; a fresh `manager` account's
  default map exactly reproduced the old hardcoded
  `requireRole("admin","hr","manager")` allow-list (7 keys, all
  approve/view_others, before the 3 new manager-default approve keys added
  this phase); a regression check that manager POSTing to
  `/assets` still 403s by default; then live-editing — admin grants
  `manager` → `assets.manage` via `PUT /admin/permissions`, the same
  manager account immediately succeeds at the same POST, `/auth/me`
  reflects the change, admin resets it via `DELETE
  /admin/permissions/:role/:key`, and the 403 comes back. Non-admin access
  to the permissions API itself is also 403'd, and every grant/reset is
  audit-logged.

## Multi-tenancy (as implemented)

- Single shared D1 database. Every tenant-owned table has `tenant_id`, and
  every query filters by `auth.tenantId` from the verified session — there
  is no cross-tenant path in the API surface.
- Tenant is resolved from the logged-in session, not from a URL/subdomain.
  Sign-up (`POST /api/auth/register-tenant`) provisions a tenant + its first
  admin user + default leave types + default workflows in one request; login
  just needs email + password.
- **Email is globally unique across the whole platform** (not scoped per
  tenant) — deliberate simplification so login never needs a tenant/company
  code, matching how most SaaS products work.
- Module/role gating is data-driven (`role` enum on `users`: `admin`, `hr`,
  `manager`, `employee`; checked via `requireRole()` middleware), not the
  hardcoded `companyName == "TNB"` branching `old_project` used.

## What's built

- **Auth & tenancy:** workspace registration, login/logout, session
  middleware, RBAC (`admin`/`hr`/`manager`/`employee`).
- **Employees:** directory + search, create/edit (admin/hr), status
  lifecycle (active/on_leave/resigned/terminated), manager assignment.
- **Leave:** configurable leave types, per-employee per-year balances
  (lazily initialized from the type's default entitlement), apply with
  business-day calculation and balance-sufficiency check, routed approval,
  cancel-while-pending, CSV export.
- **Leave Quota** (`worker/modules/leave/quotaRoutes.ts`): for
  special-eligibility leave types seeded at 0 default entitlement (OIL,
  Haji/Pilgrimage, Paternity, Exam) that shouldn't be auto-entitled to
  everyone. Two paths to the same effect — `leave_balances.entitled_days +=
  granted_days` — an employee-submitted request routed through the
  workflow engine (`leave.quota.approve`), or an HR/admin **direct grant**
  (`leave.quota.manage`) that skips routing entirely for cases where HR is
  proactively granting eligibility rather than an employee asking for it.
  Deliberately reuses the existing `leave_types` catalog rather than a
  separate quota-type table — a quota type *is* a leave type, just one with
  no automatic entitlement.
- **Leave Encashment** (`worker/modules/leave/encashmentRoutes.ts`): employee
  requests cashing out unused leave (days × a submitted daily rate =
  amount), guarded against requesting more days than the current balance
  has remaining, routed for approval; approval consumes the balance exactly
  like an approved leave application does (`used_days += days`).
- **Leave Calendar** (`worker/modules/leave/calendarRoutes.ts`): one query
  returns the caller's own approved leave for a month plus, if anyone
  reports to them (`employees.manager_id`), their direct reports' approved
  leave too — the frontend splits it into "My Leave" / "Unit Calendar"
  sections rather than needing two endpoints or a manager-only permission
  gate.
- **Attendance:** clock-in/out (one row per employee per day), own monthly
  timesheet with CSV export, admin/hr/manager lookup of any employee's
  timesheet, own current work-schedule assignment shown inline.
- **Overtime** (`worker/modules/overtime/`): employee requests planned OT
  hours for a date + reason, routed through the workflow engine with the
  hours themselves as the routable `amount` (so an admin can set up "OT
  over 4h needs a second approval" the same way claims do it by dollar
  amount); `overtime.manage` additionally exposes a tenant-wide listing for
  HR reporting, separate from the personal-or-blanket `overtime.approve`
  gate on the approvals queue.
- **Work Schedule** (`worker/modules/workschedule/`): admin-managed named
  shift templates (start/end time, work days) and employee assignments by
  effective date range. Not workflow-routed — assigning someone to a shift
  is a direct HR action, not something that needs approval.
- **Claims:** configurable **claim types** (`worker/modules/claims/typesRoutes.ts`)
  replacing a hardcoded frontend list — each type can be flagged `is_mileage`
  (submission then takes a distance instead of an amount, and the server
  computes `amount = distance × mileage_rate`, never trusting a
  client-supplied amount for mileage claims) or `is_advance`. Submit,
  routed approval (amount-range-aware), cancel-while-pending, CSV export.
- **Task Reassignment** (`worker/modules/workflows/reassignRoutes.ts`,
  `src/pages/admin/ReassignTasks.tsx`): search pending tasks by current
  holder/module/applicant and hand them to a different employee — see
  "Task reassignment" above.
- **Account Simulation** (`worker/modules/simulate/`, "Login As" button on
  an employee's detail page, gated `admin`-only): impersonate another
  user's session without their password, with a persistent banner and
  one-click return — see "Account simulation" above.
- **Access Denied page** (`src/pages/AccessDenied.tsx`): a `roles`/
  `permission`-gated route the current user fails now renders this instead
  of silently redirecting to `/` (`ProtectedRoute.tsx`) — old_project's
  `AccessControl` "you don't have permission" page.
- **Employee Requests** (`worker/modules/requests/`): a generic,
  admin-configurable "submit a form → routed approval → history" module.
  Admins define **request types** (name, optional amount, optional
  attachment requirement); each type's name doubles as the workflow-routing
  category, so different request types can have different approval chains.
  This is the functional/config-driven equivalent of every old_project
  module that's really just [form + optional amount + attachment + approval
  + history] with its own field set: Allowance, Loan, Medical Board, Death
  Donation, Verification Letter, Mobility, Temporary Position, Contract
  Absorption, ETK/EMS, ETransfer, GenCoLetter, ServiceAcceptance. It does
  **not** replicate each one's bespoke extra fields (e.g. Loan's
  installment schedule, Uniform's item/size picker) — see "Not built yet."
- **Attachments** (`worker/modules/attachments/`): R2-backed upload/
  download/delete on any (module, recordId), reusable across leave, claims,
  and employee requests. Authorization: owner or admin/hr can upload;
  owner, any resolved workflow approver, or admin/hr can view/download.
- **Admin:** user account management (create/role change/enable-disable),
  tenant-wide audit log (every state change across modules is recorded via
  `recordAudit()` in `worker/core/db.ts`), **Workflow Routing** (configure
  definitions/steps per module), **Routing Logs** (tenant-wide instance
  listing + full per-instance trail, mirrors old_project's `RoutingLogs`).
- **Dashboard:** role-aware summary (own pending requests; approvals queue
  count for managers/hr/admin, correctly counted through the routing engine;
  org headcount for admin/hr).
- **Assets:** admin-managed registry (tag, category, serial, purchase info),
  assign/return/maintenance/retire lifecycle with a full assignment log,
  employee "My Assets" view. Direct admin/hr actions, not workflow-routed —
  assigning a laptop doesn't need a multi-step approval.
- **Vendors:** simple registry (contact info, category, active/inactive) —
  no workflow, just admin/hr-managed master data.
- **Training:** admin-managed program calendar (capacity-limited), employee
  enrollment routed through the workflow engine by program category,
  admin marks an approved enrollment "completed", employee then submits a
  1-5 rating + feedback (one evaluation per enrollment).
- **Payroll:** admin generates a payslip per employee per pay period (gross/
  deductions/net, duplicate-period rejected), employee views own history;
  payslip PDFs attach via the Attachments module. View/generate, not a
  payroll *engine* — no tax tables or automatic computation.
- **Recruitment:** admin posts internal job openings, employees apply
  (one active application per posting), admin/hr moves applications through
  a stage pipeline (submitted → screening → interview → offered/rejected →
  hired) — this is **not** routed through the workflow engine, since hiring
  is a multi-stage pipeline HR drives directly, not a binary approve/reject.
  Internal-only: applicants must be existing employees (see "Not built" for
  the public-careers-page gap this implies).
- **Uniform Application:** admin manages an item catalog (each item has its
  own available sizes), employees build a multi-line order (item + size +
  qty per line) validated against the catalog, routed through the workflow
  engine like any other request.
- **LTIP:** admin offers an equity grant (quantity, vesting window) to an
  employee, who accepts or declines it; vesting % is computed on read from
  `vesting_start`/`vesting_end`, not tracked through a separate ledger. No
  workflow routing — the grant decision already happened before the offer.
- **In-app notifications** (`worker/modules/notifications/`): the routing
  engine calls into this on every step transition — a new pending approval
  notifies its resolved approver(s) (a specific employee's login, or every
  active user holding a role), and a final approve/reject notifies the
  submitter. Surfaced via a bell icon + unread badge in the Topbar, polled
  every 30s. This is the practical substitute for "email on workflow
  events" — see "Not built" for why it's in-app rather than actual email.
- **CSV export** (`src/lib/csv.ts`): client-side, on the Employee Directory,
  Audit Log, Routing Logs, Asset Registry, Equity Grants, Claims (history +
  approvals), Attendance, and Overtime/Leave Quota/Leave Encashment
  (history + approvals) pages — the practical substitute for old_project's
  SSRS report links (no report server to link to, but the underlying data
  was already sitting in each page, so exporting it needed no new backend
  endpoints).
- **Searchable employee picker** (`src/components/EmployeePicker.tsx`): a
  typeahead against `/employees?q=` — old_project's PeoplePicker/
  MultiPeoplePicker equivalent, used for manager assignment and asset
  assignment. Plain `<select>` dropdowns remain elsewhere (small, bounded
  lists like leave types or users) where a picker would be overkill.

Verified via full curl-driven smoke tests against `wrangler pages dev` (D1 +
R2 both local-emulated, no cloud account touched): tenant registration,
duplicate-email rejection, cross-tenant isolation, the routing engine cases
(default/multi-step/role-based/amount-gated routing, mid-flight cancel,
delete-protection), file upload/download/authorization (401 unauthenticated,
200 for an authorized approver, byte-identical content), RBAC 403s, asset
assign/return lifecycle, training enroll→approve→complete→evaluate,
duplicate-payslip-period rejection, recruitment pipeline stage transitions,
uniform order size-validation (rejects a size not in the item's catalog),
notification delivery on submit/approve (unread count and message content
both checked), LTIP offer→accept with correct vesting-percent computation
and double-decision rejection, and a real dashboard bug this refactor caught
and fixed (the approvals count was still querying a now-unused
`approver_id` column after leave/claims were rewired onto the routing
engine — it now joins through `workflow_step_actions` like the
approvals-queue endpoints do).

A second pass (Reassignment → Account Simulation → Claims Types → Overtime/
Work Schedule → Leave Quota/Encashment/Calendar) added: mileage-claim
amount auto-calculation and its distance-required rejection, an advance
claim's `is_advance` flag, `claims.types.manage` 403/success; overtime
hours submission → approval → balance-independent status, `overtime.manage`
tenant-wide listing 403/success, cancel + double-decide guards; work
schedule assignment (`GET /workschedule/mine` before/after) and its
`workschedule.manage` gate; a personally-reassigned task becoming visible
*and actionable* to its new (permission-less) holder while staying invisible
to an unrelated employee, and the routing trail correctly showing
`reassigned_from_name`/comment after the fix described in the routing-engine
section above; a leave-quota grant request being approved and immediately
raising `leave_balances.entitled_days` (verified by then successfully
applying regular leave against the new balance), the direct-grant path
skipping routing entirely, and `leave.quota.manage` 403/success; leave
encashment's amount computation, its "can't encash more than remaining
balance" guard, and balance consumption (`used_days`) on approval; the Leave
Calendar correctly splitting into "mine" vs. a manager's "unit" view from
one query. This pass also caught and fixed two real bugs beyond the
dashboard one above: the Overtime module missing from `records.ts`'s
`OWNER_TABLE_BY_MODULE` (see "The routing engine" — an applicant got 403'd
viewing their own routing trail), and the `leave_encashments` migration
missing a `reason` column the route code inserted into (500 on submit,
caught immediately by live curl testing, fixed in the migration before it
was ever used against real data).

## Not built (deliberate scope calls, not oversights)

- **Arbitrary tenant-defined role names:** the permission system (see above)
  makes the 4 fixed roles' capabilities fully tenant-configurable, but it's
  still 4 roles, not "let admins invent a role called Finance Officer."
  That would mean `Role` stops being a closed union, which cascades into
  the routing engine's `role`-type approver steps and the JWT — a
  materially different and riskier change than toggling permissions on the
  existing 4, and wasn't worth doing in the same pass.
- **Actual email delivery:** workflow events surface via in-app
  notifications (see "What's built") rather than email, since no email
  provider/credentials are configured in this environment. The
  `notifications` module's `notifyUser`/`notifyRole` calls are the natural
  place to add a real send if a provider gets wired up later — the trigger
  points (submit, step-advance, final decision) already exist.
- **Print-style/scheduled reports:** CSV export covers "get the data out,"
  but there's no PDF/print layout generation or scheduled report delivery
  (old_project's SSRS integration did both) — genuinely no modern
  equivalent worth building without a concrete ask.
- **Public/anonymous recruitment:** the Recruitment module is internal-only
  (applicants must already be employees) — no public careers page with
  anonymous applicants, resume upload, or an unauthenticated apply flow.
- **Payroll is view/record-keeping, not a payroll engine:** no tax
  calculation, statutory deduction tables, or pay-run automation — admin
  enters the numbers per period.
- **Scheduler/SLA escalation:** the routing engine has no deadline/escalation
  timers (old_project's `Scheduler` folder implies time-based nudges) — a
  pending approval sits until someone acts, with no automatic reminder or
  escalation.
- **StandbyPlanning:** Overtime requests and named Work Schedule templates +
  assignments are built (see "What's built"); a standby/on-call rotation
  planner specifically is not.
- **MultiPeoplePicker** (select several people at once, e.g. notify-peers):
  `EmployeePicker` (see "What's built") covers single-selection; a multi-
  select variant isn't built. Plain `<select>` dropdowns remain for small
  bounded lists (leave types, users) where a picker is unnecessary.
- **ChargeCode/FavoriteChargeCode, MyResume, RetirementLetter generation:**
  all specific to old_project's finance cost-center integration or
  document-generation needs with no general equivalent built.
- **COI / Integrity Pledge:** not a dedicated module — these are
  structurally just "employee submits a declaration, optionally reviewed,"
  so an admin can already model them as Employee Request types (e.g. create
  a "Conflict of Interest Declaration" request type) rather than needing
  bespoke code.

## Reference material: `old_project/`

`old_project/` is the **Views layer only** (1,434 `.cshtml` Razor files, no
controllers, models, or C# business logic) exported from **"TNB ESS"** — an
ASP.NET MVC5 employee self-service / HRMS system built for Tenaga Nasional
Berhad (a Malaysian utility) and at least one other company code ("KEV").
Treat it strictly as a **feature catalog and UI/UX reference**, not runnable
code — Razor/C#/SharePoint/SSRS syntax and dependencies don't carry over,
re-derive the *behavior*, not the markup. It uses Bootstrap + a
Metronic-style admin theme + jQuery/DataTables/Select2 — good source for
visual language (sidebar nav with nested sub-menus, card-based forms,
listing pages with search + table results, audit-log partials, attachment
widgets), not a literal template to clone.

### Module inventory (top-level folders in `old_project/`) — coverage tally

Core / identity: `Employee` ✅, `Role`/`RoleMaintenance`/`AccessControl` ✅
(fixed-enum RBAC, not a custom editor; `AccessControl`'s specific "access
denied" page ✅ `src/pages/AccessDenied.tsx`), `Admin` ✅, `Home`/
`LandingPage` ✅ (combined into one Dashboard), `Maintenance`/`Core`/
`Shared` (infra, N/A).

Workflow engine: `Process`/`Routing`/`RoutingLogs`/`CustomWorkflowConfig` ✅
(see "The routing engine" above); `ReAssignTask` ✅ (see "Task
reassignment" above); `Scheduler`'s deadline/escalation piece **not
built**; `Component` (approver comments/notify-peer picker) not built as
separate widgets — remarks fields cover the approver-comment need.

Leave: `LeaveApplication` ✅. `LeaveQuota` ✅ (`quotaRoutes.ts`: OIL/Haji/
Paternity/Exam as zero-default leave types + routed-request-or-direct-grant,
see "What's built"). `LeaveEncashment` ✅ (`encashmentRoutes.ts`: days ×
rate, balance-guarded, routed).

Time & attendance: `TimeAttendance` ✅ (clock in/out, timesheets).
`OverTime` ✅, `WorkSchedule` ✅ (see "What's built").
`TimeAttendanceMaintenance`/`StandbyPlanning` **not built**.

Claims & pay: `Claims` ✅ including configurable `ClaimsSubtype`-equivalent
(claim types with mileage auto-calc + advance flag). `ClaimsMaintenance`/
`ClaimsReport`/`ChargeCode`/`FavoriteChargeCode` **not built** (finance
cost-center integration, old_project-specific). `Payroll`/`EPayslip` ✅
(record-keeping, not a payroll engine). `Allowance`/`Loan` ✅ via generic
Requests.

Recruitment / career / mobility: `OJA` ✅ (internal-only pipeline).
`MyResume` **not built**. `TemporaryPosition`/`Mobility`/
`ContractAbsorption` ✅ via generic Requests. `Training`/
`TrainingApplication`/`TrainingEvaluation` ✅ dedicated module.
`CoursePicker` superseded by a plain program list.

Equity: `LTIP` ✅ dedicated module (offer/accept/decline + computed vesting %,
lighter than old_project's full CDS/investment-bank integration).

Compliance: `COI`/`IntegrityModule`/`IntegrityPledge` — coverable via
generic Requests (create a declaration request type), no dedicated module.

Employee lifecycle & misc: `DeathDonation`/`VerificationLetter`/
`GenCoLetter`/`ServiceAcceptance`/`ETKEMS`/`ETransfer`/`MedicalBoard` ✅ via
generic Requests. `RetirementLetter*` (document generation) **not built**.
`UniformApplication` ✅ dedicated module (catalog + multi-line orders).
`EPOP` **not built** (unclear scope). `Vendor` ✅, `Asset` ✅ — both
dedicated registries.

Shared UI widgets: `PeoplePicker` ✅ (`src/components/EmployeePicker.tsx`,
single-select typeahead); `MultiPeoplePicker` (multi-select variant) **not
built**. `Attachment`/`Attachment1`/`SubAttachment` ✅
(`worker/modules/attachments/`). `AccountSimulator` ✅ (see "Account
simulation" above). `App` **not built** (unclear scope, likely a mobile
shell — no general equivalent).

## Working conventions

- TypeScript everywhere; Pages Functions stay a thin adapter
  (`functions/api/[[route]].ts`) — all real logic lives in `worker/`.
- **Domain-driven, one folder per business domain** (see Architecture
  above), and **no file over ~500 lines** — split by sub-resource
  (routes vs. service vs. types, or `fooRoutes.ts`/`barRoutes.ts` composed
  by an `index.ts`) before a file gets there, the way `leave/` and
  `workflows/` already do.
- A domain's `types.ts` holds only that domain's types; cross-cutting types
  (`Role`, `AuthContext`, `Bindings`) live in `worker/core/types.ts` /
  `src/types/common.ts` only.
- New submission-based modules route through the workflow engine
  (`worker/modules/workflows/engine.ts`) — never hardcode an approver again.
  Doing so means updating **all three** of: (1) `OWNER_TABLE_BY_MODULE` in
  `worker/core/records.ts` (routing-trail viewing authorization), (2) the
  `LEFT JOIN` block in `worker/modules/workflows/reassignRoutes.ts`'s
  `GET /tasks` (so the module's tasks show up with a real applicant name in
  the reassignment search), and (3) a `decideCurrentStep(...)` call that
  passes an explicit `approvePermissionKey` — never gate the whole
  approvals-queue route behind `requirePermission`; compute
  `hasPermission(...)` in JS and conditionally scope the SQL instead, or a
  personally-reassigned task becomes invisible to its new holder (see "The
  routing engine" above for the full authorization model). Forgetting any
  one of the three is exactly the kind of bug that passes `typecheck`/
  `build` cleanly and only shows up under live multi-role testing.
- A new module's "manage this data" / "approve this request" routes use
  `requirePermission(key)`, not `requireRole()` — add the key to
  `PERMISSION_KEYS`/`PERMISSIONS` in `worker/core/permissions.ts` (pick
  sensible `defaultRoles`) and mirror the gate on the corresponding
  frontend page/nav item via `can(key)`. Reserve `requireRole("admin")` for
  genuinely single-actor, hard-to-reverse operations (deletes, user
  management) — see "The permission system" for why those stay fixed.
- D1 schema changes go through new files in `migrations/`
  (`wrangler d1 migrations apply hrms --local`), never hand-edited against a
  running database.
- Every state-changing route calls `recordAudit()` — keep that going for any
  new module so the admin audit log stays complete.
- No comments explaining `old_project` provenance in new source files — this
  file is the place for that context, not code comments.
