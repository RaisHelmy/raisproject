# Deployment

## Cloudflare resources
| Resource | Name / id |
|---|---|
| Worker | `xuanzhi-api` → https://xuanzhi-api.raishelmy97.workers.dev |
| Pages | `xuanzhi` → https://xuanzhi-a8r.pages.dev |
| Hyperdrive | `7a7777560d434c2b91ff37c52ab1b2c9` (shared `raishelmy-hyperdrive`) |
| R2 | `xuanzhi-files` |
| KV | `xuanzhi-cache` (`8faf21265e8e449ab2500f9f85dfcb81`) |
| Queues | `xuanzhi-jobs`, `xuanzhi-jobs-dlq` |
| Workers AI | `AI` binding (chat: Qwen / GLM / DeepSeek / Llama; embeddings: `@cf/baai/bge-m3`) |

`infrastructure/cloudflare/provision.sh` creates them (idempotent).

## Environment variables (`apps/api/wrangler.jsonc → vars`)
| Var | Meaning |
|---|---|
| `WEB_ORIGIN` | Browser origin (CORS, CSRF origin check, email links, OAuth/Stripe return URLs) |
| `WEB_ORIGINS` | Extra trusted browser origins, comma-separated (custom domain `https://xuanzhi.raishelmy.uk`) — added to CORS + CSRF allow-list |
| `SSO_REDIRECT_TO` | Where `GET /api/auth/sso` sends the super-admin after suite SSO (`https://xuanzhi.raishelmy.uk/admin`) |
| `API_ORIGIN` | Public Worker origin (OAuth redirect URIs) |
| `JOB_MODE` | `queue` (Cloudflare Queue) or `inline` (run in the request's `waitUntil`; local dev) |
| `SESSION_TTL_HOURS` | Cookie session lifetime (336) |
| `MAX_UPLOAD_BYTES` | Upload limit (25 MB) |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | Workers AI embedding model and the `vector(N)` width (1024) |

## Secrets (`wrangler secret put NAME` in `apps/api`, or `.dev.vars` locally)
| Secret | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | Reserved for signed values |
| `ENCRYPTION_KEY` | yes | AES-256-GCM key for provider API keys stored by admins |
| `CRON_SECRET` | yes | Auth for `/internal/cron/*` |
| `SAAS_SSO_SECRET` | yes (suite SSO) | HMAC secret shared with saas.raishelmy.uk for `GET /api/auth/sso?token=…` (super-admin single sign-on); endpoint returns 503 when unset |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` | optional | Fallback keys when the admin has not stored one in Admin → Models → Providers |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY` | optional | OAuth sign-in buttons appear automatically when set. Redirect URI: `${API_ORIGIN}/api/auth/oauth/<provider>/callback` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Online billing. Webhook URL: `${API_ORIGIN}/api/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.*`). Set each plan's `stripe_price_id` in Admin → Plans |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Verification / reset emails. Without it, new accounts are auto-verified and reset links are logged (`wrangler tail`) |

## Deploy
```bash
cd apps/api && bunx wrangler deploy
cd ../web && bun run deploy          # vite build + wrangler pages deploy dist --project-name xuanzhi
```
`apps/web/.env.production` pins `VITE_API_URL` to the Worker; `WEB_ORIGIN` must equal the Pages origin. Cookies are `SameSite=None; Secure` because web and API are different sites.

## After first deploy
1. Register the first account — it becomes `super_admin`.
2. Admin → Knowledge Base → **Load demo content** (or `curl -X POST …/api/admin/knowledge/demo` with an admin session).
3. Optionally add provider keys under Admin → Models → Providers and assign plans.

## Cron (Ubuntu VM)
```
*/30 * * * * curl -s -X POST -H "X-Cron-Secret: $CRON_SECRET" https://xuanzhi-api.raishelmy97.workers.dev/internal/cron/housekeeping
```
Purges expired sessions, rate-limit rows and expired chat uploads (R2 objects included).

## Local development
```bash
bun install
cd apps/api && cp .dev.vars.example .dev.vars && bun run dev      # :8787 (remote Hyperdrive/AI/R2/KV/Queue bindings)
cd apps/web && bun run dev                                          # :5173, proxies /api
```
Set `JOB_MODE=inline` in `wrangler.jsonc` `vars` (or a `.dev.vars` override) if the local queue consumer is not running.
