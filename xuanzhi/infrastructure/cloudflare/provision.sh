#!/usr/bin/env bash
# Provision Cloudflare resources for 玄知 AI. Safe to re-run. Requires wrangler 4 (`bun install`) and `wrangler login`.
set -euo pipefail
cd "$(dirname "$0")/../../apps/api"
echo "== KV namespace (entitlement / model-config cache)"; bunx wrangler kv namespace create xuanzhi-cache 2>/dev/null || echo "   (exists) — copy the id into wrangler.jsonc kv_namespaces"
echo "== R2 bucket (documents & chat uploads)"; bunx wrangler r2 bucket create xuanzhi-files 2>/dev/null || echo "   (exists)"
echo "== Queues (background document processing)"; bunx wrangler queues create xuanzhi-jobs 2>/dev/null || echo "   (exists)"; bunx wrangler queues create xuanzhi-jobs-dlq 2>/dev/null || echo "   (exists)"
echo "== Secrets (Enter to skip)"
for s in SESSION_SECRET ENCRYPTION_KEY CRON_SECRET OPENAI_API_KEY ANTHROPIC_API_KEY GOOGLE_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY EMAIL_FROM; do
  read -r -s -p "   $s: " v; echo; if [ -n "$v" ]; then printf '%s' "$v" | bunx wrangler secret put "$s"; fi
done
echo "== Pages project"; bunx wrangler pages project create xuanzhi --production-branch main 2>/dev/null || echo "   (exists)"
echo "Done. Apply migrations (docs/database.md), then: bun run deploy"
