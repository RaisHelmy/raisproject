# Deployment

## Environment variables (Worker)

Vars (`apps/api/wrangler.jsonc` → `vars`, override per environment):

| Var | Default | Meaning |
|---|---|---|
| `APP_NAME`, `APP_VERSION` | Rais Timesheet, 0.1.0 | Branding / health |
| `WEB_ORIGIN` | http://localhost:5173 | Allowed browser origin (CORS + CSRF origin check + OAuth redirect target) |
| `JOB_MODE` | queue | `queue` (Cloudflare Queue) or `inline` (run jobs in the request; local only) |
| `AI_PROVIDER` / `AI_MODEL` | anthropic / claude-opus-5 | Set `AI_PROVIDER=heuristic` to force the demo provider |
| `JIRA_MODE` | cloud | `demo` forces the demo adapter |
| `JIRA_OAUTH_REDIRECT_PATH` | /api/jira/oauth/callback | |
| `MAX_UPLOAD_BYTES` | 10485760 | Upload limit |
| `SESSION_TTL_HOURS` | 168 | |
| `RETENTION_*_DAYS` | 90 / 180 / 0 | Defaults until set in Admin → Settings |

Secrets (`wrangler secret put NAME`, or `.dev.vars` locally):

| Secret | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | Reserved for signed values |
| `ENCRYPTION_KEY` | yes (for Jira) | AES-256-GCM key material for stored Jira tokens |
| `ANTHROPIC_API_KEY` | for real AI | Claude provider; absent → heuristic demo |
| `JIRA_OAUTH_CLIENT_ID`, `JIRA_OAUTH_CLIENT_SECRET` | for OAuth | Atlassian 3LO app |
| `MCP_BOOTSTRAP_TOKEN` | optional | Lets the MCP obtain a personal token |

## Provision Cloudflare resources

The database is PostgreSQL, reached from the Worker through a Hyperdrive binding (`HYPERDRIVE`) — see `docs/database.md`. Hyperdrive resolves `env.HYPERDRIVE.connectionString` to the private VPC service in production; no host/port needs to be configured in `wrangler.jsonc` beyond the Hyperdrive config id. There is a single account-wide Hyperdrive config (`raishelmy-hyperdrive`) pointing at the shared `raishelmy` database; this app's tables live in the `raistimesheet` schema within it (not a dedicated database), and `src/db/client.ts` pins `search_path=raistimesheet` on connect.

```bash
cd apps/api
bunx wrangler r2 bucket create rais-timesheet-files
bunx wrangler queues create rais-timesheet-jobs
bunx wrangler queues create rais-timesheet-jobs-dlq
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put ENCRYPTION_KEY
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put JIRA_OAUTH_CLIENT_ID
bunx wrangler secret put JIRA_OAUTH_CLIENT_SECRET
# Apply migrations-pg/0001_init.sql (and any later migrations) to the Postgres
# database directly with psql — see docs/database.md for the SSH tunnel + apply steps.
bun run deploy                                     # wrangler deploy
```

Set `WEB_ORIGIN` in `wrangler.jsonc` to the Pages URL before deploying. Cron triggers and the queue consumer are declared in `wrangler.jsonc`.

## Web app (Cloudflare Pages)

```bash
cd apps/web
VITE_API_URL=https://rais-timesheet-api.<account>.workers.dev bun run build
bunx wrangler pages deploy dist --project-name rais-timesheet
```

`VITE_API_URL` must be the Worker origin; cookies are `SameSite=Lax`, so put both on the same site in production (e.g. `app.example.com` + `api.example.com`, or a custom domain route `app.example.com/api/*` → Worker, which also removes the need for CORS). Alternatively serve the web build from the Worker with Static Assets (`assets` in wrangler.jsonc, `run_worker_first: ["/api/*"]`).

## MCP

See docs/mcp.md. Deploy anywhere Python runs (developer laptop for Claude Desktop, or a small container). It only needs the API URL and a token.

## Local development

```bash
bun install
cd apps/api && cp .dev.vars.example .dev.vars && bun run db:migrate:local && bun run db:seed:local && bun run dev   # :8787
cd apps/web && bun run dev                                                                                       # :5173 (proxies /api)
```

Queues and cron work locally with Wrangler; trigger cron manually with `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/5+*+*+*+*"`.

## Verification performed (2026-09-04, local)

* `bun run typecheck` (API, web, shared) — clean.
* `bun run test` — 25 tests pass (parser formats, matcher, delay, heuristic AI incl. Malay/English, XLSX/PDF writers, crypto).
* `pytest` (MCP) — 4 tests pass; 31 tools registered.
* End-to-end smoke (`scratchpad/smoke.sh`, reproducible with curl): login → dashboard → analyse seeded conversation (42 messages → work items with provenance) → accept all → bulk submit → owner bulk approve (20) → reconciliation (exact/suggested/no-match) → create Jira task (duplicate check, `QUEUED`, second click `ALREADY_LINKED`) → link suggested match → retry failed sync → delayed tasks → report preview → XLSX (`Microsoft Excel 2007+`) and PDF (7 pages) downloads → global search → IDOR/CSRF/unauth/forbidden checks → `/ready`.

## Troubleshooting

| Symptom | Check |
|---|---|
| `wrangler dev` fails on D1 | `database_id` in wrangler.jsonc; run migrations `--local` |
| Login works but every mutation is 403 `CSRF_REJECTED` | Client must send `X-Requested-With: RaisTimesheet`; `WEB_ORIGIN` must equal the browser origin |
| Cookie not sent from the web app | Different site (scheme/host) between web and API → use the Vite proxy locally or a same-site domain in production |
| Import stuck in QUEUED | Queue consumer not deployed or `JOB_MODE` mismatch; set `JOB_MODE=inline` locally to bypass the queue |
| "AI demo mode" banner | `ANTHROPIC_API_KEY` missing or `AI_PROVIDER≠anthropic` |
| OAuth callback error `invalid_state` | State older than 15 min or reused; restart from Settings → Jira |
| Jira 401/403 after a while | Refresh token revoked or missing `offline_access`; reconnect |
| Excel opens with repair prompt | Report a bug with the report id; the writer is dependency-free (`services/reports/xlsx.ts`) and unit-tested |
