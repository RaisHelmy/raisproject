# RaisAI Create

An AI creation platform on Cloudflare: a creative front end, a workflow engine,
prepaid billing in ringgit, and an API and MCP surface over the same services.

The product specification is [CLAUDE.md](CLAUDE.md). The design, plan and
verified external facts live in [docs/](docs/README.md).

## Status

Phases 0 to 3 are essentially complete. A beginner can sign up, add balance
and generate in under a minute; a creator can take a movie from an idea to an
exported cut; a power user can build workflows on a node canvas; a developer
can drive it all over REST; and an AI agent can over MCP.

| Working | Not yet built |
| --- | --- |
| Auth, prepaid ledger, usage dashboard | Node SDK package (phase 4) |
| Model registry with capability-driven UI | Webhook and schedule trigger nodes (phase 4) |
| Image, video, speech, transcription, text | Agent node with a spend budget (phase 4) |
| Workflow engine and visual node editor | Template marketplace (phase 4) |
| Movie mode: story, storyboard, timeline, export | Payment provider for deposits (needs an account) |
| Templates with version pinning and sharing | Music generation (needs a verified model) |
| REST API with keys, MCP server with 17 tools | Final video muxing (needs a render service) |
| Webhooks, rate limits, catalog sync, admin tools | |

Progress is tracked task by task in [docs/planning/TASKS.md](docs/planning/TASKS.md).

## Run it locally

```bash
bun install
bun run build                      # build the web app into apps/web/dist
bun run db:migrate:local           # apply D1 migrations to the local database
bun run dev                        # wrangler dev on http://localhost:8787
```

First-run setup, once the server is up:

```bash
# 1. Create an account (keeps cookies in /tmp/c.txt)
curl -s -c /tmp/c.txt -X POST localhost:8787/api/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'

# 2. Make yourself an admin
cd apps/worker && bunx wrangler d1 execute raisai --local \
  --command "UPDATE users SET role='admin' WHERE email='you@example.com';"

# 3. Load the model catalog and add balance
CSRF=$(grep rais_csrf /tmp/c.txt | awk '{print $7}')
ORG=$(curl -s -b /tmp/c.txt localhost:8787/api/v1/auth/me | python3 -c "import sys,json;print(json.load(sys.stdin)['orgId'])")
curl -s -b /tmp/c.txt -X POST localhost:8787/api/v1/admin/models/seed -H "x-csrf-token: $CSRF"
curl -s -b /tmp/c.txt -X POST localhost:8787/api/v1/admin/balance/deposits \
  -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d "{\"orgId\":\"$ORG\",\"amountSen\":5000,\"note\":\"Local credit\"}"
```

Generating for real needs Cloudflare AI credentials; `wrangler dev --remote`
routes the AI binding to Cloudflare. Every test uses a fake provider instead, so
`bun run test` never spends money.

### Live model prices

Admin → Models → **Sync from account** reads every model in your account's
catalog together with its current rate, so prices never have to be typed. It
needs a token with **Account → Workers AI → Read**. Locally, put it in
`apps/worker/.dev.vars` (gitignored); in production set both as secrets:

```bash
# apps/worker/.dev.vars
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

```bash
cd apps/worker && bunx wrangler secret put CLOUDFLARE_ACCOUNT_ID
cd apps/worker && bunx wrangler secret put CLOUDFLARE_API_TOKEN
```

Sync only ever writes rates it read from the account and refreshes those when
Cloudflare's price moves; a rate an admin typed by hand is never overwritten.
Nothing sync finds is offered to customers until it passes a test run and is
enabled. **Load full catalog** on the same page works without credentials but
brings no prices, since the public catalog page publishes none.

## Deploying

Set a real `database_id` in `apps/worker/wrangler.jsonc` (it ships as
`REPLACE_WITH_D1_ID`), create the D1 database, R2 bucket and queues, then:

```bash
bun run db:migrate:remote
cd apps/worker && bunx wrangler deploy
```

## Layout

```
apps/web        React + Bootstrap SPA (Bun bundler)
apps/worker     Cloudflare Worker: API, engine, services, D1 migrations
packages/shared Types, errors, money, ports, capability vocabulary
packages/sdk    Node client (phase 4)
packages/seed-models  Curated model catalog with verified rates
docs/           Architecture, plan, ADRs, Cloudflare knowledge
```

## Verifying

```bash
bun run typecheck
bun run test          # 273 unit and integration tests, no network, no spend
bun run e2e:install   # once: downloads Chromium
bun run e2e           # 10 browser tests on desktop and mobile viewports
```

Money, capability handling and failure recovery carry the heaviest coverage:
the ledger is asserted to be replayable from its own entries, concurrent holds
cannot overdraw, and listed model prices are asserted equal to what the user is
actually charged.
