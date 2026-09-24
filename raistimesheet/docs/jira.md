# Jira integration

All Jira traffic goes **React → Worker → Jira**. The browser never sees tokens. The Worker exposes `/api/jira/*`; the `JiraClient` interface (`services/jira/client.ts`) hides REST details so Jira could be replaced later.

## Connection options

### OAuth 2.0 (3LO) — recommended
1. Create an OAuth 2.0 integration at https://developer.atlassian.com/console/myapps → *Authorization* → OAuth 2.0 (3LO). Callback URL: `https://<your-worker-domain>/api/jira/oauth/callback`.
2. Permissions: Jira API — `read:jira-work`, `write:jira-work`, `read:jira-user`, plus `offline_access` (refresh tokens).
3. `wrangler secret put JIRA_OAUTH_CLIENT_ID` and `wrangler secret put JIRA_OAUTH_CLIENT_SECRET`; make sure `ENCRYPTION_KEY` is set.
4. Settings → Jira Connection → **Connect with Atlassian OAuth** (admin). Tokens are stored AES-256-GCM encrypted in `jira_connections`; refresh is automatic (`services/jira/factory.ts`).

### API token (email + token)
Settings → Jira Connection → *Or use an API token*. Stored encrypted; validated with `/myself` before saving.

### Demo adapter
When no connection exists (or `JIRA_MODE=demo`), `DemoJiraClient` serves issues from `jira_issues` rows flagged `is_demo=1`, allocates new keys for created issues, and can simulate outages (Admin → Settings → *Jira demo failure simulation*). The UI shows **DEMO** everywhere it applies.

The connection page only ever shows safe information: account name, site, project keys, last sync, health.

## Issue cache

`POST /api/jira/sync` (Sync now) pulls the latest 300 issues per configured project into `jira_issues` (JQL `project = KEY ORDER BY updated DESC`, `/search/jql` with `nextPageToken` paging). Matching, delay detection and the "My Jira Tasks" list work from the cache; issue detail supports `?refresh=1`.

## Reconciliation & matching

Runs automatically on approval (`reconcileTimesheet`) and on Sync now for approved timesheets that are not linked yet. Sequence (`services/jira/matcher.ts`):

1. Explicit issue key mentioned in the conversation (from the AI work item or the title/description) → confidence 1.0, auto-linked.
2. Existing stored link → auto-linked.
3. Exact title equality → 0.98 "Exact match" (still confirmed by a person).
4. Token/bigram similarity + description keyword overlap + assignee bonus + date proximity (± penalties for stale/closed issues) → "Suggested" ≥ 0.45, "Exact" ≥ 0.92.

Results per timesheet: `EXACT_MATCH`, `SUGGESTED_MATCH`, `NO_MATCH`; before creation, anything ≥ 0.6 is a `POTENTIAL_DUPLICATE` and blocks creation until the user picks *Use existing* or *Create anyway*.

## Creating & linking

* **Create** builds the issue from project defaults (issue type, assignee = the timesheet author's Jira account or the project default), summary = task title, description = work performed / date / effort / source reference, label `rais-timesheet`. The user can edit summary, description, type and assignee in the confirmation dialog.
* **Link** adds a traceability comment to the issue (`LINK_ISSUE` job).
* **Corrections of approved timesheets** add a comment to the linked issue (`COMMENT_ISSUE` job).

## Idempotency & retries

* `sync_jobs.idempotency_key = create:<timesheet_id>:<project_id>` — repeated clicks or redelivered queue messages reuse the job; a `CREATED` link that is already `SYNCED` short-circuits.
* Transient failures (`429`, `5xx`, network) retry with exponential backoff (30 s · 2^attempt, max 1 h, 5 attempts) via the queue and the 5-minute cron sweep. Permanent failures (`400/401/403/404`) go straight to `DEAD`.
* Every failure creates a `sync_errors` row with a user-facing reference (`SYNC-YYYYMMDD-NNNNN`), the error code, retry count and correlation id. Users see "We couldn't synchronise this task with Jira. Reference … [Retry]"; stack traces are never shown.

## Delay detection

`lib/delay.ts`: ON_TIME / DELAYED (days) / AT_RISK (due within 2 days) / BLOCKED / NO_DUE_DATE / OPEN. A task is never called delayed without a reliable due date.

## Supported operations

`JiraClient`: myself, testConnection, searchIssues (JQL), getIssue, createIssue, updateIssue, assignIssue, getTransitions, transitionIssue, addComment, getProject, listProjects, searchUsers, getIssueTypes, getStatuses. Descriptions and comments are sent as Atlassian Document Format.
