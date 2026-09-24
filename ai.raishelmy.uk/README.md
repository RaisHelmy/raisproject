# ai.raishelmy.uk — AI credential & budget portal

A small control plane in front of **Cloudflare AI Gateway** (`raisai`). Every app
(OpenHands, OpenCode, OpenClaw, VS Code, Zakat Digital, …) gets its own
`rais_sk_…` credential with a dollar budget, model permissions and a rate
limit, and talks plain OpenAI API to `https://ai.raishelmy.uk/v1`. Apps never
see the Cloudflare token or provider keys.

```
app ──OpenAI API──▶ ai.raishelmy.uk ──▶ ai-raishelmy.developer-530.workers.dev ──cf-aig-metadata──▶ AI Gateway "raisai" ──▶ Workers AI
                    (edge proxy,         (the app: Worker + D1, Hira account                          (Hira account)
                     raishelmy account)   530e4678…)
```

## Two accounts

- **Hira / developer account (530e4678…)** owns the app: Worker `ai-raishelmy`, D1 `ai-raishelmy`,
  AI Gateway `raisai`, and therefore all Workers AI billing. Deploy from this folder.
- **raishelmy account (6af8ff18…)** owns the `raishelmy.uk` zone. Cloudflare only allows a Worker
  custom domain inside the zone's own account, so `edge-proxy/` is a 20-line Worker (also named
  `ai-raishelmy`, custom domain `ai.raishelmy.uk`) that relays every request to the workers.dev
  URL above and adds `x-rais-edge: <EDGE_SECRET>`. The app refuses requests without it (HTTP 421),
  so the only public entry point is `ai.raishelmy.uk`.

```bash
# app (Hira account creds)
set -a; . /root/hira_monorepo/matah/.env.cloudflare; set +a; bun run deploy
# edge proxy (raishelmy account creds)
set -a; . /root/raisproject/.env.cloudflare; set +a; (cd edge-proxy && bunx wrangler deploy)
```

## What the Worker does per request

1. `Authorization: Bearer rais_sk_…` → SHA-256 → `api_keys` row (enabled, not expired).
2. Guard: requests/minute, credential daily/weekly/monthly budget, global budget
   (windows in `BUDGET_TIMEZONE`). Over budget → `429 budget_exceeded`, or the
   credential's fallback model when "use cheaper fallback" is chosen.
3. Resolve `model`: an alias (`auto`, `auto/coding`, `cheap`, `fast`, `premium`,
   `auto/reasoning`) expands to an ordered candidate list; a raw `provider/model`
   must exist in the catalog. Both are filtered by the credential's allowed list.
4. Forward to `gateway.ai.cloudflare.com/v1/<account>/raisai/compat/chat/completions`
   with `cf-aig-metadata: {project, credential, request_id}`. Upstream 5xx/429/404
   → next candidate. Streams are passed through untouched; `stream_options.include_usage`
   is injected so the final usage chunk is captured.
5. Record tokens + estimated cost in `usage` (Workers AI: neurons × $0.011/1k;
   others: catalog price per 1M tokens; OpenRouter `usage.cost` when present).
   Cloudflare's own `cost` per request is synced back onto rows (matched by
   `metadata.request_id`) at most every 5 min when the dashboard loads, or via
   Settings → Sync now.

Endpoints for apps: `POST /v1/chat/completions`, `GET /v1/models`.
Response headers: `x-rais-request-id`, `x-rais-model` (model actually used), `x-rais-fallbacks`.

## Portal

- Password login (`ADMIN_PASSWORD`) or suite SSO from https://saas.raishelmy.uk/admin.
- Dashboard: global today/week/month vs budget, per-project cards, per-credential bars.
- Create credential: presets (Cheap / Coding / Premium coding / Reasoning / Custom),
  budgets, block-or-fallback, allowed models, default + fallback model, RPM, expiry.
  The key is shown **once** with copy-ready snippets (env / cURL / Python / Node / SDK).
- Credential page: usage (30-day bars, per-model table, recent requests with our
  estimate and Cloudflare's figure), edit settings, enable/disable, rotate, delete.
- Models: catalog with prices, aliases with ordered candidates.
- Settings: global budgets, which providers have upstream keys, cost sync.

## Setup

```bash
bun install
bun run build
wrangler deploy                      # custom domain ai.raishelmy.uk, D1 ai-raishelmy
wrangler d1 migrations apply ai-raishelmy --remote

wrangler secret put ADMIN_PASSWORD
wrangler secret put SAAS_SSO_SECRET        # same value as the other suite apps
wrangler secret put CLOUDFLARE_API_TOKEN   # Hira-account token: Workers AI Run + AI Gateway Read
wrangler secret put EDGE_SECRET            # same value on edge-proxy (cd edge-proxy && wrangler secret put EDGE_SECRET)
wrangler secret put OPENROUTER_API_KEY     # optional
wrangler secret put ANTHROPIC_API_KEY      # optional — only if you enable anthropic/* models (Workers AI has none)
wrangler secret put OPENAI_API_KEY         # optional
# any other AI Gateway provider: <SLUG_UPPER_SNAKE>_API_KEY, e.g. GOOGLE_AI_STUDIO_API_KEY
# or store provider keys in the gateway (BYOK) and set AI_GATEWAY_TOKEN instead
```

Local dev: copy `.dev.vars.example` → `.dev.vars`, `bun run db:migrate:local`, `bun run dev`
(Worker + built assets on :8787) or `bun run dev:web` for Vite HMR proxied to it.

## Notes / limits

- Default setup is **Workers AI only** (migration 0002): every alias resolves to Workers AI
  models (Qwen, Kimi K2.7 Code, GLM 5.3, DeepSeek V4, GPT-OSS, Gemma 4, Llama). Anthropic /
  OpenAI / OpenRouter catalog rows exist but are disabled; enable them under Models after
  setting the matching `<PROVIDER>_API_KEY` secret.

- Budgets are enforced from this Worker's own ledger (Cloudflare's spend limits have
  no public API yet). The `project` metadata lets you add Cloudflare-side spend-limit
  rules in the AI Gateway dashboard as a second guard rail.
- Cost = estimate. Prices live in the `models` table; keep them current. Models with
  $0 prices count as free — fill in OpenAI/OpenRouter prices before enabling them.
- RPM is a 60 s sliding count of recorded requests; concurrency is not limited.
- Keys are hashed (SHA-256); losing one means rotate.
