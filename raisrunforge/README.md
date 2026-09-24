# RunForge

**Your infrastructure. One control panel.**

RunForge is a universal control plane for developers to deploy, monitor,
manage and automate their own infrastructure — self-hosted servers, Docker
hosts, Cloud Run, Cloudflare, Proxmox and more, all from one dashboard, API
and MCP server.

> **RunForge is a control plane, not a hosting provider.** You bring your own
> infrastructure (a VPS, a home lab, AWS, Hetzner, Cloud Run…); RunForge
> connects to it and gives you a unified, safe way to manage it.

This repository is a real, runnable implementation of that architecture —
not a static mockup. Every page in the web app is backed by a REST API,
which is backed by domain services, which are backed by provider interfaces.
Local development runs entirely against a **Demo Provider** with a
deterministic, realistic dataset, so the whole system works with zero
external credentials.

---

## Quick start

```bash
bun install
bun dev
```

This starts:

- the API at **http://localhost:8787** (Bun, demo mode, in-memory dataset)
- the web app at **http://localhost:5173** (Vite, proxies `/api` to the API)

Open **http://localhost:5173** and you'll land on the Overview dashboard with
a fully seeded demo organization ("MERC999 Labs"): 3 projects, 6
applications, 3 servers, 14 containers, 3 databases, a running incident, and
a real-time deployment pipeline you can trigger from the UI.

Try it end to end:

```text
Open RunForge
  → Overview dashboard shows live demo metrics
  → Click Servers → production-01
  → View CPU/memory/disk, containers, services
  → Click Applications → MERC999 API
  → Click Deploy
  → Watch the deployment progress through cloning → building → packaging →
    deploying → starting → health checking → switching traffic → completed
  → An event is recorded, logs update, metrics stay live
```

---

## Repository structure

```text
runforge/
├── apps/
│   ├── web/                 React + TypeScript + Bootstrap 5 + Highcharts dashboard
│   └── api/                 Cloudflare Workers API (Hono), runnable locally with Bun
│
├── packages/
│   ├── shared/               Shared TypeScript types (the contract every layer speaks)
│   ├── providers/            Provider interfaces + the Demo Provider implementation
│   ├── domain/                Domain services, auth/permissions, MCP dispatch, events, jobs
│   ├── database/             Postgres-backed repositories (via Hyperdrive, schema `raisrunforge` in shared DB `raishelmy`) + R2 storage abstraction
│   └── ui/                    Reserved for shared React UI primitives (see package README)
│
├── agent/
│   └── runforge-agent/        The agent that runs on your servers (outbound-only)
│
├── migrations/
│   ├── 0001_init.sql          legacy D1/SQLite schema (kept for history, no longer applied)
│   └── postgres/0001_init.sql  Postgres schema (multi-tenant from day one)
│
├── scripts/                   dev / db-migrate / db-seed / lint helper scripts
└── docs/
```

**Data flow**, top to bottom, for every operation in the product:

```text
React UI  ─┐
           ├─▶  REST API (Hono, Cloudflare Workers)  ─┐
MCP client ┘                                          ├─▶ Domain Services (@runforge/domain)
                                                        │        │
                                                   Permissions   │
                                                        │        ▼
                                                        │   Provider Interfaces (@runforge/providers)
                                                        │        │
                                                        ▼   ┌────┴────┬─────────────┬──────────────┐
                                                   Event/Audit Demo    Docker (agent) Cloud Run  Cloudflare
                                                              Provider
```

REST handlers and the MCP dispatcher call the **exact same domain service
methods** — there is one implementation of "restart an application" or
"deploy," not two. That's enforced structurally: `apps/api/src/routes/*` and
`packages/domain/src/mcp/mcp-service.ts` both go through
`packages/domain/src/runforge.ts`, the single composition root.

---

## Local development

```bash
bun install        # install all workspaces
bun dev             # run API + web together
bun dev:api          # API only (http://localhost:8787)
bun dev:web           # web only (http://localhost:5173, proxies to the API)
bun test               # run the test suite (providers, domain, permissions, MCP)
bun typecheck            # typecheck every workspace
bun lint                   # (currently an alias for typecheck; swap in ESLint/Biome later)
```

Demo mode needs no environment variables. Copy `.env.example` to `.env` if
you want to start wiring real credentials (Cloudflare, GitHub/GitLab OAuth,
etc.) for the provider adapters described below.

### Simulating roles

The web app's top bar has a role selector (Owner/Admin/Developer/Operator/
Viewer) that sends `X-RunForge-Demo-Role` on every request, so you can see
RBAC enforcement live — e.g. switch to Viewer and every write action
(Deploy, Restart, Rollback…) returns `403 FORBIDDEN` from the same domain
service that would authorize a real user.

---

## Cloudflare setup (production mode)

Demo mode requires nothing. To point RunForge at real Cloudflare
infrastructure:

```bash
cd apps/api

# Postgres (via Hyperdrive) — control-plane database
# There is one shared Hyperdrive config / Postgres instance (database
# `raishelmy`) for the whole account; this app's tables live in their own
# schema, `raisrunforge`, inside it. The [[hyperdrive]] binding in
# apps/api/wrangler.toml already points at it.
# For local/manual migrations, open an SSH tunnel to the DB host and run:
DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy \
  bun run ../../scripts/db-migrate.ts

# R2 — object storage for backups and application files
bunx wrangler r2 bucket create runforge-storage
# uncomment the [[r2_buckets]] block in wrangler.toml

# Deploy the Worker
bun run deploy
```

Then construct `RunForge` with `mode: "production"`, a `ProviderRegistry`
wired to real adapters, and `createPgDataStore(createPgClient(env.HYPERDRIVE.connectionString))`
from `@runforge/database` instead of the in-memory store. The Demo Provider
and the Postgres/R2 backends implement the exact same interfaces
(`packages/providers/src/interfaces`), so nothing above the provider layer
needs to change. (Note: this call site does not exist yet — see the TODO in
`apps/api/src/runforge-instance.ts`.)

---

## Database schema

See [migrations/postgres/0001_init.sql](migrations/postgres/0001_init.sql)
(the original D1/SQLite version, [migrations/0001_init.sql](migrations/0001_init.sql),
is kept for history but is no longer applied). Tables live in the
`raisrunforge` schema inside the shared `raishelmy` Postgres database (one
Postgres instance, one schema per app — `createPgClient()` sets
`search_path=raisrunforge` by default). Every tenant-owned
table carries `organization_id` (and `project_id` where relevant), matching
`packages/shared/src/resources.ts`. Tables: `users`, `organizations`,
`members`, `projects`, `environments`, `applications`,
`application_revisions`, `deployments`, `servers`, `server_agents`,
`containers`, `services`, `databases`, `database_connections`,
`database_migrations`, `domains`, `dns_records`, `routes`, `ports`,
`storage`, `backups`, `logs`, `metrics`, `events`, `audit_logs`,
`incidents`, `integrations`, `git_connections`, `secrets`, `mcp_tokens`,
`templates`, `jobs`.

`packages/database/src/pg` maps every shared TypeScript type to its table
with a small generic repository builder (`PgTenantRepository` /
`PgKeyedRepository`, using `postgres` a.k.a. postgres.js) — no hand-written
SQL per resource, and no drift between the schema and the domain layer's
expectations. (`packages/database/src/d1` is the original D1 implementation,
kept for history.)

---

## Provider architecture

Nothing above `packages/providers` is allowed to know whether it's talking
to Docker, Cloud Run, Cloudflare, or the Demo Provider. Every domain service
resolves the right adapter through a `ProviderRegistry`, keyed by the
resource's `provider` field:

```typescript
interface ComputeProvider {
  listServers(organizationId: string): Promise<Server[]>;
  getServer(organizationId: string, id: string): Promise<Server | null>;
  createServer(input: CreateServerInput): Promise<Server>;
  deleteServer(organizationId: string, id: string): Promise<void>;
  getMetrics(organizationId: string, id: string): Promise<ServerMetricsSnapshot | null>;
  // ...
}
```

Interfaces: `ComputeProvider`, `ApplicationProvider`, `ContainerProvider`,
`GitProvider`, `DatabaseProvider`, `NetworkProvider`, `LogProvider`,
`MetricsProvider` (`packages/providers/src/interfaces`).

**Demo Provider** (`packages/providers/src/demo`) implements every one of
them against an in-memory `DemoWorld`, seeded deterministically
(`seed.ts`) so the dataset is identical on every boot but still feels alive:
CPU/memory/latency graphs wobble with seeded noise, deployments progress
through real wall-clock time (2.5s per stage), and every mutation
(`restart`, `deploy`, `rollback`, `expose port`…) is simulated and clearly
marked `simulated: true` on the resulting event/deployment — RunForge never
claims a fake deployment actually happened.

Building a real adapter (Docker via the agent, Cloud Run, Cloudflare) means
implementing these same interfaces — the domain layer, REST API and MCP
server need zero changes.

---

## MCP architecture

`packages/domain/src/mcp` exposes 21 high-level tools (`list_projects`,
`get_application_health`, `deploy_application`, `restart_container`,
`rollback_application`, …) — see
[packages/domain/src/mcp/tools.ts](packages/domain/src/mcp/tools.ts) for the
full catalogue. Every tool call passes through the exact same pipeline as a
REST request:

```text
Authentication → Authorization → Domain Service → Provider → Audit Event
```

Tools are classified `READ` / `WRITE` / `DANGEROUS`
(`packages/domain/src/auth/permissions.ts`). A `DANGEROUS` tool call (e.g.
`rollback_application`, or deploying to production) returns
`requiresConfirmation` instead of executing, with a confirmation token the
caller must resend — MCP can never bypass RunForge's normal authorization,
and every call, allowed or denied, is recorded in the audit log.

Try it in the UI at **MCP** in the sidebar, or hit the API directly:

```bash
curl -X POST http://localhost:8787/api/mcp/call \
  -H 'Content-Type: application/json' \
  -d '{"name": "get_server_health", "arguments": {"serverId": "srv_production_01"}}'
```

---

## Agent architecture

[agent/runforge-agent](agent/runforge-agent/README.md) runs on your Linux
servers and connects **outbound only** — RunForge never needs inbound SSH or
an exposed administrative endpoint on your machine. Production install:

```bash
curl -fsSL https://install.runforge.dev | sh
```

Every command the control plane sends to the agent passes through a fixed
pipeline before anything executes:

```text
Authentication → Authorization → Validation → Command policy → Execution → Audit event
```

The agent never runs arbitrary shell strings — only a typed, allowlisted set
of operations (`container.start/stop/restart`, `service.control`,
`health.check`) is supported; see
[command-policy.ts](agent/runforge-agent/src/command-policy.ts).

---

## Deployment architecture

Deploys are asynchronous end to end (spec: event-driven architecture).
`DeploymentService.deploy()` enqueues a `Job` and returns immediately; the
job is reconciled by polling `ApplicationProvider.getDeploymentProgress()`
until it reaches a terminal state, at which point the application's current
revision, status, and the event stream are all updated together. Production
traffic is never switched to a new revision before it passes its health
check (spec §18) — the Demo Provider's own stage list (`cloning → building →
packaging → deploying → starting → health_checking → switching_traffic →
completed`) enforces the same ordering.

---

## What's functional right now

- **Full demo dataset**: 3 servers, 6 applications, 14 containers, 3
  databases, 5 domains, 11+ deployments, incidents, events, audit logs,
  logs, and time-series metrics — all deterministic and realistic.
- **Working deploy pipeline**: trigger a deployment from the UI or API and
  watch it progress live through every stage, including a simulated
  failure path with the app going `degraded` and an incident-worthy error.
- **Working actions**: restart/stop/start an application, restart/stop a
  container, rollback to a revision, scale instances, add a domain, expose
  a port, run a read-only database query, invite a team member — every one
  goes through the domain service, is authorized, and produces an event.
- **RBAC enforced server-side**: switch the demo role selector and watch
  write actions become `403 FORBIDDEN` — enforcement lives in
  `PermissionService`, not the UI.
- **MCP server**: 21 tools, `READ`/`WRITE`/`DANGEROUS` levels, confirmation
  flow for dangerous actions, fully wired to the same domain services as
  REST.
- **Global search** (⌘K) and a **command palette** across every resource
  type.
- **Infrastructure graph**: domain → Cloudflare → tunnel → server → reverse
  proxy → application → container → database, clickable.
- **Full test suite**: provider interfaces, the Demo Provider's deployment
  state machine, tenant isolation, authorization, event/audit recording,
  and MCP permission checking (`bun test`).

## What's Demo Provider only

Every mutating action in the demo dataset is simulated and marked
`simulated: true` (or shown with a "Demo Provider — simulated" badge in the
UI) — no real server is ever contacted. This includes: server
provisioning, deployments, container/service control, database creation and
queries, domain/DNS/route creation, and port exposure. Swapping in a real
`DockerProvider`, `CloudRunProvider`, or `CloudflareProvider` (implementing
the interfaces in `packages/providers/src/interfaces`) makes these
operations real without touching the domain layer, REST API, or MCP server.

## What to build next

- **Tier 2** (per the product spec): richer Cloudflare integration
  (Workers/D1/R2 management UI), real Cloudflare Tunnel provisioning,
  firewall management, database backup/restore flows.
- **Tier 3**: Cloud Run and Proxmox providers, cross-engine database
  migration (`DatabaseMigrationService` + compatibility analysis), the
  application-creation wizard (12-step flow described in the product spec),
  infrastructure blueprints and cost estimation.
- **Tier 4**: wire AI Operations to a real model with the MCP tool surface
  already exposed here, incident root-cause analysis, AI-assisted blueprint
  generation.
- Real authentication (`AuthProvider` beyond `DemoAuthProvider`/
  `TokenAuthProvider` — OAuth/session-based login), Cloudflare Queues-backed
  job execution (currently ticked opportunistically per request in demo
  mode), Durable Objects for live log/metric streaming instead of polling.

---

## License

Unlicensed scaffold — set a license before distributing.
