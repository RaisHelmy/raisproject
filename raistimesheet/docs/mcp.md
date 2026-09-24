# MCP server

`apps/mcp` is a Python MCP server (FastMCP, stdio) that lets an AI client drive Rais Timesheet in natural language. It is a **thin, structured client** over the Worker API: every tool returns

```json
{ "success": true, "data": {...}, "warnings": [], "errors": [] }
```

It acts as the signed-in user (personal API token), so authorisation, audit, human-in-the-loop and idempotency rules are enforced by the Worker exactly as for the web app.

## Setup

```bash
cd apps/mcp
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export RAIS_API_URL=http://localhost:8787
export RAIS_API_TOKEN=rts_...        # Profile → API tokens
rais-mcp
```

Alternative bootstrap (no manual token): set `MCP_BOOTSTRAP_TOKEN` on the Worker and `RAIS_MCP_BOOTSTRAP_TOKEN` + `RAIS_USER_EMAIL` for the MCP; the first call exchanges them for a personal token.

Claude Desktop / Claude Code configuration:

```json
{ "mcpServers": { "rais-timesheet": { "command": "/abs/path/apps/mcp/.venv/bin/rais-mcp", "env": { "RAIS_API_URL": "https://rais-timesheet-api.<account>.workers.dev", "RAIS_API_TOKEN": "rts_..." } } } }
```

## Tools

| Group | Tools |
|---|---|
| Import | `parse_whatsapp_export` (local, offline), `analyse_conversation` (upload + wait + items), `extract_work_items`, `list_imports` |
| Timesheet | `create_timesheet_draft` (accept a work item or manual), `list_timesheets`, `get_timesheet`, `update_timesheet`, `submit_timesheet`, `approve_timesheet`, `reject_timesheet`, `timesheets_waiting_for_approval` |
| Jira | `search_jira`, `get_jira_issue`, `sync_jira`, `match_timesheet_to_jira`, `find_missing_jira_tasks`, `link_timesheet_to_jira`, `preview_jira_issue`, `push_timesheet_to_jira` (**requires `confirm=true`**), `create_jira_issues_for_missing_work` (**requires `confirm=true`**), `retry_jira_sync`, `jira_sync_errors` |
| Reports | `get_dashboard_summary`, `report_preview`, `generate_timesheet_report` (PDF/XLSX, base64 or save to path), `generate_jira_report`, `generate_productivity_report`, `what_did_i_work_on`, `list_projects` |

## Example prompts

* "Import this WhatsApp conversation and prepare my timesheet." → `analyse_conversation` → show items with provenance → `create_timesheet_draft` per accepted item → `submit_timesheet`.
* "Show my outstanding Jira tasks." → `search_jira(filter="open")`.
* "Find approved timesheets that aren't in Jira." → `find_missing_jira_tasks`.
* "Create Jira tasks for approved work that is missing from Jira." → show the list, then `create_jira_issues_for_missing_work(ids, confirm=true)`.
* "Show me delayed tasks this month." → `search_jira(filter="delayed")`.
* "What did I work on last week?" → `what_did_i_work_on(date_from, date_to)`.
* "How many hours did I spend on BNM API work?" → `list_timesheets(search="API", project_id=…)` and sum `summary.minutes`.
* "Generate my September timesheet report." → `generate_timesheet_report("TIMESHEET_SUMMARY", "PDF", "2026-09-01", "2026-09-30", save_to="…")`.
* "Show me timesheets waiting for approval." → `timesheets_waiting_for_approval`.

## Tests

`pytest` covers the local parser and response envelope. API-backed tools are exercised against a running Worker (see the smoke script in docs/deployment.md).
