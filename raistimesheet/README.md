# Rais Timesheet

> **"My work assistant automatically turns my messy WhatsApp work history into clean, approved, auditable timesheets and keeps Jira synchronised."**

Rais Timesheet converts WhatsApp work conversations into reviewed, approved timesheet records, reconciles them with Jira, and produces management-grade reports. Built for software-delivery work for **Bank Negara Malaysia (BNM)** first, but every client, project, Jira key and status is configuration, not code.

```
WhatsApp → AI understands work → Human reviews → Timesheet → Owner approves → Jira reconciliation → Jira sync → Reports
```

## Architecture at a glance

```
┌──────────────────────┐        ┌──────────────────────────────────────────────────────┐
│  Python MCP server   │ HTTPS  │  Cloudflare Worker (Hono)  ──  React + Bootstrap 5    │
│  apps/mcp            ├───────►│  apps/api                      apps/web (static)      │
│  natural-language    │        │  Auth · Timesheets · Approvals · Imports · AI stages  │
│  tools for AI clients│        │  Jira client · Matcher · Sync jobs · Reports · Audit  │
└──────────────────────┘        │  PostgreSQL via Hyperdrive (SQL) · R2 (files) · Queues (jobs) · Cron         │
                                └───────────────────────────┬──────────────────────────┘
                                                            │ HTTPS (OAuth 2.0 / API token)
                                                    ┌───────▼────────┐
                                                    │ Jira Cloud v3  │
                                                    └────────────────┘
```

* **Source of truth**: the Worker + PostgreSQL (via Hyperdrive) for timesheets, approvals, AI results, sync records, audit. Jira remains the source of truth for Jira issues.
* **Browser never holds secrets**: Jira/AI credentials live in Worker secrets; React only calls `/api/*`.
* **Human in the loop**: AI *suggests*; a person accepts; an owner approves; Jira issues are created only after explicit confirmation.
* **Exception-first UX**: successful work is summarised; only exceptions are put in front of the user.

## Repository layout

```
apps/api      Cloudflare Worker — API, business logic, AI + Jira adapters, jobs, migrations, seed
apps/web      React 19 + TypeScript + Vite + Bootstrap 5 + Highcharts
apps/mcp      Python MCP server (FastMCP) — thin structured client over the API
packages/shared-types   Domain types shared by API and web
infrastructure/cloudflare   Provisioning notes and scripts
docs/         architecture, database, api, mcp, jira, security, ux, deployment
```

## Quick start (local, demo mode)

Prerequisites: Node 20+, Bun 1.3+, Python 3.11+ (for MCP), Wrangler 4 (installed with the API package).

```bash
bun install

# API: migrate + seed the local PostgreSQL database (via SSH tunnel), then start the Worker on :8787
cd apps/api
cp .dev.vars.example .dev.vars          # set SESSION_SECRET / ENCRYPTION_KEY (any long random strings)
bun run db:migrate:local && bun run db:seed:local
bun run dev

# Web: start Vite on :5173 (proxies /api to the Worker)
cd ../web && bun run dev
```

Open http://localhost:5173 and sign in with a demo account (password `Demo1234!!`):

| Account | Roles | Use it for |
|---|---|---|
| rais@demo.rais-timesheet.local | USER, ADMIN | import WhatsApp, review AI, submit, administration |
| owner@demo.rais-timesheet.local | APPROVER | approvals, Jira sync, reports |
| pic@demo.rais-timesheet.local | APPROVER | BNM PIC view: reports, reconciliation |
| aiman@demo.rais-timesheet.local | USER | second developer (IDOR / attribution scenarios) |

Without an `ANTHROPIC_API_KEY` the **heuristic demo AI provider** runs (rule-based, clearly labelled DEMO). Without a Jira connection the **demo Jira adapter** runs (clearly labelled). Neither pretends to be the real integration. See [docs/deployment.md](docs/deployment.md) to enable Claude and Jira Cloud.

### Demo walkthrough (the acceptance scenario)

1. Sign in as **rais** → *Import History* → open "BNM WhatsApp Export - API Discussion" → **Analyse conversation** (or upload `apps/api/seed/whatsapp/bnm-api-discussion.txt` under *WhatsApp Import*).
2. **Review AI work**: evidence is highlighted in the conversation; every date/duration/status shows *Confirmed / Inferred / Assumed* with a "Why?". Accept, edit, split, merge or ignore.
3. *Drafts* → select all → **Submit**.
4. Sign in as **owner** → *Pending Approval* → select all → **Approve** (confirmation shows totals, projects and date range).
5. *Jira Sync Center* shows exceptions only: suggested matches to confirm, tasks to create, sync errors to retry. **Create Jira task** runs a duplicate check and is idempotent.
6. *Report Center* → BNM, 01–30 Sep 2026 → **Generate PDF**, **Export Excel**, or **Print view**.

## Commands

| Command | What it does |
|---|---|
| `bun run typecheck` | TypeScript across API, web and shared types |
| `bun run test` | Vitest suites (parser, matcher, heuristic AI, XLSX/PDF writers, crypto) |
| `bun run --filter @rais/api db:migrate:local` | Apply `migrations-pg/0001_init.sql` to the local Postgres (via SSH tunnel) |
| `bun run --filter @rais/api db:seed:local` | Load demo data into the local Postgres |
| `bun apps/api/seed/build-seed.mjs` | Regenerate `seed/demo.sql` |
| `cd apps/mcp && pytest` | MCP tests |

## Documentation

* [docs/architecture.md](docs/architecture.md) — components, flows, AI pipeline, job processing
* [docs/database.md](docs/database.md) — schema, lifecycle states, repository abstraction
* [docs/api.md](docs/api.md) — REST endpoints, envelopes, errors
* [docs/mcp.md](docs/mcp.md) — MCP tools and natural-language prompts
* [docs/jira.md](docs/jira.md) — OAuth setup, matching, idempotency, retries
* [docs/security.md](docs/security.md) — auth, CSRF, secrets, retention, audit
* [docs/ux.md](docs/ux.md) — information architecture, screens, design rules
* [docs/deployment.md](docs/deployment.md) — Cloudflare provisioning, secrets, environments, troubleshooting

## Status

Implemented and verified locally end-to-end (see docs/deployment.md → "Verification"): WhatsApp parsing, staged AI extraction (Claude provider + heuristic demo provider), human review (accept/edit/split/merge/ignore), timesheet lifecycle with audited approval, automatic Jira reconciliation, idempotent issue creation with duplicate detection, queue-based retry with error references, professional XLSX and PDF reports, print view, notifications, global search, admin, audit log, health, and the Python MCP.

Not yet exercised against live external services in this environment: the Claude API provider and the Jira Cloud client were implemented against the documented APIs and compile/typecheck, but require real credentials to run. Configure them per docs/deployment.md.
