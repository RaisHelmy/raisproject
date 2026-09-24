# Architecture

## Components

| Component | Technology | Responsibility |
|---|---|---|
| Web app (`apps/web`) | React 19, TypeScript, Vite, Bootstrap 5, Bootstrap Icons, Highcharts | All screens. Calls `/api/*` only. No secrets. |
| API Worker (`apps/api`) | Cloudflare Workers, Hono, Zod | Authentication, authorisation, business logic, AI pipeline, Jira client, matching, sync jobs, reports, audit, health. |
| Storage | PostgreSQL via Hyperdrive (SQL), R2 (files), Queues (jobs), Cron Triggers | Postgres is the system of record; R2 holds raw exports, normalised messages, analysis artefacts and generated reports; Queues run analysis + sync jobs; Cron sweeps retries and applies retention. The Postgres database (`raishelmy`) is shared across apps, each isolated into its own schema — this app's tables live in schema `raistimesheet`, selected via `search_path` in `src/db/client.ts`. |
| MCP server (`apps/mcp`) | Python 3.11+, FastMCP, httpx, Pydantic | Natural-language tools for AI clients. Acts as the signed-in user via a personal API token. Never a source of truth. |
| Jira Cloud | REST API v3 | Source of truth for issues. Accessed only from the Worker. |
| Claude | Anthropic Messages API, structured outputs | Work extraction (staged). Accessed only from the Worker. |

Design rules that shaped the code:

* **Repository interfaces** (`src/repositories/interfaces.ts`) isolate business logic from the storage engine. `createRepositories()` is the only place that knows it is Postgres (via Hyperdrive).
* **Adapters, clearly labelled**: `AIProvider` has `AnthropicAIProvider` (real) and `HeuristicAIProvider` (demo). `JiraClient` has `JiraCloudClient` (real) and `DemoJiraClient` (demo). The UI shows DEMO badges whenever an adapter is active. Nothing fakes a real integration.
* **One deployable Worker** plus one static web app. No microservices.
* **No hardcoded business values**: BNM, Rais, project keys, issue types and statuses come from the database (`clients`, `projects`, `users`) and `wrangler.jsonc` vars.

## Primary flow

```
Upload (.txt) ─► R2 original.txt ─► imports(QUEUED) ─► Queue ANALYSE_IMPORT
   │
   ▼ consumer (or inline in local dev)
Parse ─► Normalise (import_messages, normalized.json) ─► AI stages ─► ai_work_items (+ Jira candidates)
   │
   ▼ human review (accept / edit / split / merge / ignore)
timesheets(DRAFT, ai_generated=1, source_work_item_id) ─► submit ─► SUBMITTED ─► approve ─► APPROVED
   │
   ▼ automatic
reconcileTimesheet(): explicit key → existing link → title/keywords/assignee/date scoring
   ├─ explicit/linked ...........  LINKED (auto)
   ├─ similar .................... MATCH_SUGGESTED  (human: Link / Create / Ignore)
   └─ nothing .................... NOT_LINKED       (human: Create / Link)
   │
   ▼ human confirms (duplicate check first)
sync_jobs(CREATE_ISSUE | LINK_ISSUE | COMMENT_ISSUE, idempotency_key) ─► Queue SYNC_JOB ─► Jira
   ├─ success → timesheet_jira_links, SYNCED, audit, notification
   └─ failure → sync_errors(reference), backoff retry (queue + cron sweep), SYNC_FAILED → human Retry
```

## AI pipeline (staged, never one giant prompt)

| Stage | Where | Notes |
|---|---|---|
| 1 Parse | `services/whatsapp/parser.ts` | Android/iOS/US/ISO formats, 12/24h, multiline, system, attachments, deleted. Date-order auto-detection. |
| 2 Normalise | `services/imports.ts` | `import_messages` rows + `normalized.json` in R2 (raw text is not duplicated). |
| 3 Participants | provider | Requester / executor / observer / commenter / other; `is_me` from the user's WhatsApp aliases. |
| 4–5 Work vs noise | provider | Claude: classification per chunk of 200 messages. Heuristic: EN/MS lexicons. |
| 6 Group | provider | Claude: grouping per day window. Heuristic: activity gaps, day changes, request boundaries, acknowledgement detection. |
| 7–11 Extract | provider | Title, description, work date, duration, activity window, status, executor — each as `{value, source, confidence, reason}` + message-level evidence and an assumptions list. |
| 12 Jira candidates | `services/jira/matcher.ts` | Against the local issue cache for the project. |
| 13 Human review | web AI Review screen / MCP | Accept / edit / split / merge / ignore; every action audited. |
| 14 Persist | `ai_work_items`, `timesheets` | Drafts carry `source_import_id`, `source_work_item_id`, `confidence`, `ai_generated`. |

The Claude provider uses the Messages API with `output_config.format` (JSON schema) so responses are guaranteed to match the schema, prompt caching on the stable system prompt, and handles `stop_reason: "refusal"` gracefully (a warning is recorded; nothing is fabricated).

Duration inference never assumes continuous work: idle gaps between the owner's messages are capped (30 min in the heuristic; the same instruction is given to Claude), a single message is an *assumed* 30 minutes with low confidence, and stated efforts ("took 2 hours", "1 jam") are *explicit*.

## Background jobs

* `JOB_MODE=queue` (production): `ctx.enqueue()` sends to the `rais-timesheet-jobs` queue; the consumer in `src/jobs/index.ts` runs the job with `retry({delaySeconds})` backoff and a dead-letter queue.
* `JOB_MODE=inline` (optional for local dev): the job runs in `ctx.waitUntil()` of the request.
* Cron `*/5 * * * *`: re-runs sync jobs whose backoff elapsed. Cron `0 2 * * *`: retention.

## Observability

Structured JSON logs (`lib/logger.ts`) carry `request_id`, `import_id`, `timesheet_id`, `sync_job_id`, `jira_issue_key`, `user_id`. Sensitive keys are redacted. Workers Logs are enabled in `wrangler.jsonc` (`observability`). `GET /api/health`, `GET /api/ready` and the Admin → Health page report dependency status without exposing secrets.

## Future sources

`imports.content_type`, the parser module boundary and `AIMessage` are source-agnostic. Teams/Slack/email/Git evidence can be added as new parsers producing `AIMessage[]`; everything downstream (review, timesheets, Jira, reports) stays unchanged.
