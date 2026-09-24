# Stack
Cloudflare Pages
Bootstrap.min.css
Highchart.js
Postgresql over hyperdrive (each app by schema)
    Configuration ID
    7a7777560d434c2b91ff37c52ab1b2c9
    Database name
    raishelmy

# Host
# Some program cant be hosted on cloudflare e.g., python so host it here in ubuntu
# Cron job also hosted here
Ubuntu self hosted vm inside proxmox tunneled through cloudflare
    credential: 
    sshraisubuntu.raishelmy.uk
    username: helix
    password: P@ssw0rd

#  Use below for super admin
email: raishelmy97@gmail.com
username: raishelmy
password: P@ssw0rd

# Cloudflare token id access read and write all token
Account ID
6af8ff18a864c2b56f1a3aa78cb24f80
API Token
cfat_6FDF9ZAiXNLqHjGoLcY2xtIlW9CEPE0ZsFRCbjS2dd128125
Access Key ID
529a4dd4b309cbca92e068ee0a77d922
Secret Access Key
30144d21d8800170b941623512159a92d3a6a1cdc03d1d99566c925ee56908ce
S3 API endpoint
https://6af8ff18a864c2b56f1a3aa78cb24f80.r2.cloudflarestorage.com
Example Usage
curl -X GET "https://api.cloudflare.com/client/v4/accounts/6af8ff18a864c2b56f1a3aa78cb24f80/tokens/verify" \
     -H "Authorization: Bearer cfat_6FDF9ZAiXNLqHjGoLcY2xtIlW9CEPE0ZsFRCbjS2dd128125"


# ─────────────────────────────────────────────────────────────
# Rais Timesheet — production (added 2026-09-06)
# ─────────────────────────────────────────────────────────────

## URLs
Web app:  https://rais-timesheet.pages.dev
API:      https://rais-timesheet-api.raishelmy97.workers.dev
Login:    raishelmy97@gmail.com / P@ssw0rd   (role ADMIN)

## Jira (connected, live — not demo)
Site:        https://teamhira.atlassian.net
Auth type:   API_TOKEN (personal Atlassian API token, stored AES-256-GCM encrypted in DB)
Jira account: Rais Helmy
Real Jira project key: HIRA   (mapped to the app's INT / "Internal Tooling" project)
Note: BNM and TNB projects have NO Jira key now — they were demo-only. Demo data deleted.
Regenerate the Atlassian token at: https://id.atlassian.com/manage-profile/security/api-tokens

## Cloudflare Worker secrets (set via `wrangler secret put <NAME>` in apps/api)
ENCRYPTION_KEY       set  (AES-256-GCM key that encrypts stored Jira credentials — rotating it
                           invalidates the stored Jira connection; you'd have to reconnect Jira)
MCP_BOOTSTRAP_TOKEN  set  (value below)
CRON_SECRET          set  (pre-existing)
SESSION_SECRET       not set — declared in env.ts but unused by any code path; not needed
ANTHROPIC_API_KEY    not set — intentionally. AI extraction is done externally via Claude
                           Desktop + MCP, not the app's built-in Anthropic provider. This is why
                           the UI still says "AI uses the heuristic (rule-based) provider".

MCP_BOOTSTRAP_TOKEN value:
0c89c3b865e00a2d12f44829ca179452704333e1b22085251ce52a72890e9de8

## MCP (Claude Desktop → Rais Timesheet)
Server file: /Users/raishelmy/Downloads/raisproject/raistimesheet/mcp/rais-timesheet-mcp.mjs
Runs with:   /opt/homebrew/bin/node   (absolute path on purpose — Claude Desktop's PATH omits /opt/homebrew/bin)
Config:      ~/Library/Application Support/Claude/claude_desktop_config.json  (already wired up;
             a timestamped .backup-* of the previous config sits next to it)

Personal API token used by the MCP server ("Claude Desktop MCP"):
  token id: 5f7a5ee6-dd5e-4c65-ba14-375d17f82519
  token:    rts_apa8yzCfc_KODGSJWJvrihf80gigLq3GQmf2WWCcBoA

This token authenticates as the ADMIN user above. Anything with it can read and write
timesheets and push to Jira. Revoke it in the app under Settings → API tokens, or mint a
replacement server-to-server:

  curl -X POST https://rais-timesheet-api.raishelmy97.workers.dev/api/auth/mcp/bootstrap \
    -H "Content-Type: application/json" \
    -d '{"bootstrap_token":"<MCP_BOOTSTRAP_TOKEN>","email":"raishelmy97@gmail.com","name":"Claude Desktop MCP"}'

MCP tools exposed (18): whoami, list_projects, list_jira_projects, jira_connection, sync_jira,
list_jira_issues, get_jira_issue, list_timesheets, create_timesheet, update_timesheet,
submit_timesheet, approve_timesheet, jira_summary, jira_reconciliation, link_timesheet_to_issue,
create_jira_issue_from_timesheet, jira_sync_errors, dashboard

Intended flow: Claude Desktop reads WhatsApp → creates timesheets via create_timesheet →
submit/approve → link_timesheet_to_issue or create_jira_issue_from_timesheet → sync_jira.

## How to use it in Claude Desktop (plain instructions)

Setup, once:
  1. Fully quit and reopen Claude Desktop (it only reads its config on launch).
  2. Check the connector is live: the tools icon in the chat box should list
     "rais-timesheet". If it's missing, see Troubleshooting below.
  3. Sanity check — ask: "Use rais-timesheet whoami"
     Expect: raishelmy97@gmail.com, roles ADMIN.

Everyday use — just talk to it. Some prompts that work:

  Check what's in Jira
    "Show my HIRA tasks that are delayed"
    "List Jira issues with no timesheet against them"
    "What's HIRA-147 about?"

  Turn a WhatsApp chat into timesheets (the main flow)
    Paste or attach the WhatsApp export, then:
    "Read this WhatsApp conversation. For each piece of work I did, create a
     timesheet in rais-timesheet under project INT. Use the date from the
     message, estimate duration, and set work_status. Show me the list before
     you create anything."
    Then: "Submit them all."
    Then (you're ADMIN, so you can self-approve): "Approve them."

  Push to Jira
    "Sync Jira, then show me the reconciliation queue."
    "Link timesheet <id> to HIRA-149."
    "For any approved timesheet with no Jira match, create a Jira issue in HIRA."
    "Sync Jira again and confirm everything is linked."

  Status
    "Give me the timesheet dashboard"
    "Any Jira sync errors?"

Good habits:
  - Ask it to show you the planned timesheets BEFORE creating — it can create in
    bulk and you don't want 20 wrong entries.
  - project_id is what create_timesheet needs, not the code. INT = p-int (this is
    the one mapped to Jira HIRA). Ask "list projects" if unsure.
  - Only APPROVED timesheets reconcile against Jira. Draft/submitted ones won't
    show up in the reconciliation queue.
  - Creating a Jira issue is blocked if it looks like a duplicate; tell it
    "create anyway" to force.

Troubleshooting:
  - Connector missing after restart → check Settings → Developer → MCP logs, or run
    this in Terminal to see the real error:
      RAIS_TIMESHEET_TOKEN=<token above> /opt/homebrew/bin/node \
        /Users/raishelmy/Downloads/raisproject/raistimesheet/mcp/rais-timesheet-mcp.mjs
    (it should sit silently waiting for input — that means it started fine; Ctrl-C to exit)
  - "RAIS_TIMESHEET_TOKEN is not set" → the env block in claude_desktop_config.json got lost.
  - Every tool returns 401/UNAUTHORIZED → the API token was revoked; mint a new one with the
    bootstrap curl above and update claude_desktop_config.json.
  - Node was reinstalled / moved → update "command" in claude_desktop_config.json to the new
    `which node` path.


# ─────────────────────────────────────────────────────────────
# 玄知 AI / XuanZhi AI — production (added 2026-09-06)
# ─────────────────────────────────────────────────────────────

## URLs
Web app:  https://xuanzhi-a8r.pages.dev        (Pages project "xuanzhi")
API:      https://xuanzhi-api.raishelmy97.workers.dev   (Worker "xuanzhi-api")
Login:    raishelmy97@gmail.com / P@ssw0rd   (role super_admin — first registered account)
Repo:     /Users/raishelmy/Downloads/raisproject/xuanzhi   (README + docs/)

## Data
Postgres schema: xuanzhi (shared raishelmy DB over Hyperdrive 7a7777560d434c2b91ff37c52ab1b2c9)
pgvector 0.8.6 installed into the `postgres` container 2026-09-06 (apt postgresql-18-pgvector) — reinstall if the container is recreated.
R2 bucket xuanzhi-files · KV xuanzhi-cache (8faf21265e8e449ab2500f9f85dfcb81) · Queues xuanzhi-jobs / xuanzhi-jobs-dlq · Workers AI binding

## Worker secrets (set)
SESSION_SECRET, ENCRYPTION_KEY (encrypts admin-entered provider API keys), CRON_SECRET
CRON_SECRET value: 84179660bf76d0725786236aa9d7b6fbeac79485ed36a466c6a923ef7e5414ec
Not set (optional): OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY (or enter keys in Admin → Models → Providers),
GOOGLE_/MICROSOFT_/APPLE_ OAuth, STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET, RESEND_API_KEY + EMAIL_FROM.
Without email config new accounts are auto-verified; without Stripe admins assign plans in Admin → Users.

## Cron (Ubuntu) — add to crontab
*/30 * * * * curl -s -X POST -H "X-Cron-Secret: 84179660bf76d0725786236aa9d7b6fbeac79485ed36a466c6a923ef7e5414ec" https://xuanzhi-api.raishelmy97.workers.dev/internal/cron/housekeeping

## AI
Chat models live on Workers AI (Qwen3 30B default/fallback, Llama 3.3 70B, Qwen 3.8 27B, GLM-5.3 Flash, DeepSeek V4 Pro); OpenAI/Anthropic/Google models appear once a key is configured.
Embeddings: @cf/baai/bge-m3 (1024-d). Demo library (6 documents) loaded and indexed.
