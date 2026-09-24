#!/usr/bin/env bash
# Provision Cloudflare resources for Rais Timesheet. Idempotent-ish: re-run safely; prompts for secrets.
# Requires: wrangler 4 (bun install), `wrangler login` done.
set -euo pipefail
cd "$(dirname "$0")/../../apps/api"

echo "== D1 database"
bunx wrangler d1 create rais-timesheet 2>/dev/null || echo "   (exists)"
echo "   → copy the database_id into apps/api/wrangler.jsonc if this is the first run"

echo "== R2 bucket"
bunx wrangler r2 bucket create rais-timesheet-files 2>/dev/null || echo "   (exists)"

echo "== Queues"
bunx wrangler queues create rais-timesheet-jobs 2>/dev/null || echo "   (exists)"
bunx wrangler queues create rais-timesheet-jobs-dlq 2>/dev/null || echo "   (exists)"

echo "== Secrets (press Enter to skip any you don't have yet)"
for s in SESSION_SECRET ENCRYPTION_KEY ANTHROPIC_API_KEY JIRA_OAUTH_CLIENT_ID JIRA_OAUTH_CLIENT_SECRET MCP_BOOTSTRAP_TOKEN; do
  read -r -s -p "   $s: " v; echo
  if [ -n "$v" ]; then printf '%s' "$v" | bunx wrangler secret put "$s"; fi
done

echo "== Migrations"
bunx wrangler d1 migrations apply rais-timesheet --remote

echo "Done. Next: set WEB_ORIGIN in wrangler.jsonc, then 'bun run deploy' in apps/api and deploy apps/web (see docs/deployment.md)."
