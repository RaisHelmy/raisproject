# Rais Fintech Wealth API

Control your wealth programmatically. Everything the app shows — your consolidated
portfolio, holdings, activity, market screening, the robo engine and the investment
queue — is available over a token-authenticated REST API served by the Cloudflare
Worker, plus an [MCP server](../../integrations/mcp-python/README.md) for AI
assistants.

- **Base URL**: `https://<your-deployment>/api/v1` (locally: `http://localhost:5199/api/v1`)
- **Format**: JSON in, JSON out. Errors: `{ "error": "human-readable message" }` with 4xx/5xx.
- **Versioning**: `/api/v1` is the stable alias; response changes are additive.
- **Currency**: consolidated values are MYR; per-account data keeps native currencies.

> Signals, analyses and theories are informational — not financial advice. Live
> trading additionally requires explicit consent inside the app, which the Worker
> re-checks at execution time.

---

## 1. Authentication

Create a personal token in the app: **System → Security → API Access**. The plaintext
token (`rfk_…`) is shown once; only its hash is stored.

Send it on every request:

```bash
curl -H "Authorization: Bearer rfk_YOUR_TOKEN" \
  "$BASE/investments/portfolio?accountId=all"
```

### Scopes

| Scope | Grants |
| --- | --- |
| `read` | All GET endpoints, analysis jobs, connection sync, queue processing |
| `trade` | Additionally: `POST /robo/orders` (queue robo orders) |

### Deliberately session-only (403 for any token)

Account shaping and sensitive areas require the app: creating/removing broker
connections, the document vault, guidance/journey state, token management, and all
`/admin/*` routes.

Revoke tokens anytime from the same screen; revocation is immediate.

---

## 2. Portfolio & wealth

Scope any of these with `?accountId=all|<accountId>` and/or `?providerId=<id>`.

### `GET /investments/portfolio`
Consolidated view: MYR total, per-provider and per-account breakdown, and holdings
**merged across brokers** (one AAPL line even if held at two brokers), each with
per-account drill-down, Shariah status, asset class and gain%.

```json
{
  "totalMYR": 482871.82,
  "byProvider": [{ "providerId": "moomoo", "valueMYR": 482871.82 }],
  "byAccount":  [{ "accountId": "…", "name": "Moomoo MY — Cash Account", "valueMYR": 179385.35 }],
  "holdings": [{
    "symbol": "AAPL", "totalQuantity": 120, "valueMYR": 242876.04,
    "shariahStatus": "compliant", "gainPct": 6.6,
    "accounts": [{ "accountName": "Moomoo — Global (USD)", "quantity": 70, "valueMYR": 141677.69 }]
  }]
}
```

### `GET /investments/holdings`
Un-merged positions, account by account, in native currencies — quantity, average
cost, last price, market value, Shariah flag.

### `GET /investments/transactions` · `GET /investments/dividends`
Activity history across the scope, newest first (≤200 rows), each row tagged with
its account and provider.

### `GET /investments/orders`
Robo orders with mode (paper/live), fill price/quantity and status.

### `GET /investments/accounts`
All investment accounts with provider, currency and cash balances.

---

## 3. Connections

### `GET /investments/connections`
Your broker connections with status (`connected · syncing · needs_attention ·
auth_expired · disconnected · error`), environment and last sync time.

### `POST /investments/connections/:id/sync`
Trigger an immediate synchronization; returns the refreshed connection. (Background
syncs also run on a Cloudflare Cron schedule per connection interval.)

### `GET /investments/providers`
The provider registry: capabilities, honest integration status (`implemented ·
configured · available · coming_soon`) and, where configured, account-opening links
with their mandatory disclosure text.

---

## 4. Markets & the quant engine

### `GET /instruments`
The screened universe. Every instrument carries:
- **flags** — Shariah status *with the reason*, risk (`low/medium/high`),
  annualized volatility, max drawdown
- **history** — latest price, 1M/3M/1Y returns, sparkline
- **decision** — aggregate BUY/HOLD/SELL with confidence, vote tally, triggered
  risk filters and position-sizing suggestions

### `GET /instruments/:symbol`
Full breakdown for one instrument: every **technique → method → algorithm** signal
(SMA 50/200, EMA 12/26, MACD, RSI-14, Bollinger, z-score, ROC, 90-day momentum,
Donchian-55) with its human-readable reading.

### `GET /robo/registry`
The engine's structure: techniques, methods, algorithms and the decision library
(aggregators, risk filters, position sizing).

---

## 5. Investment queue

Work is asynchronous: you queue a job, the Worker executes it (immediately, and via
Cron as a safety net), and you read the result.

### `POST /robo/analyze`
Body: `{ "symbol": "AAPL" }` or `{}` for a full-universe scan. → `{ "jobId": "…" }`

### `POST /robo/orders` *(requires `trade` scope)*
Body: `{ "symbol": "SPUS", "side": "buy", "amount": 500, "mode": "paper" }`
`mode: "live"` is refused (403) unless live trading was enabled in the app — and the
consent is re-checked at execution time inside the job.

### `GET /jobs` · `GET /jobs/:id` · `POST /jobs/process`
List recent jobs, read one (payload + result: fill price, quantity, flags, signal at
fill), or force the queue to drain now.

---

## 6. Knowledge & community

### `GET /theories`
The admin-curated Theory Gallery: each theory with summary, full content, when to
use, risk notes, source and (where linked) the related quant technique.

### `POST /suggestions` · `GET /suggestions`
Propose an idea from anywhere (`{ "context": "theory-gallery", "title": "…",
"description": "…" }`) and follow its review status (`pending → approved/rejected →
implemented`, with the admin's note). Approved suggestions earn +150 points.

### `GET /affiliate` · `GET /achievements`
Rewards: points, tier, rank, referrals, leaderboard, achievement progress.

---

## 7. Recipes

**Morning wealth report (Python):**

```python
import httpx, os

api = httpx.Client(
    base_url=os.environ["RAIS_API_URL"] + "/api/v1",
    headers={"Authorization": f"Bearer {os.environ['RAIS_API_TOKEN']}"},
)

p = api.get("/investments/portfolio", params={"accountId": "all"}).json()
print(f"Total: RM {p['totalMYR']:,.0f}")
for h in p["holdings"][:5]:
    print(f"  {h['symbol']:8} RM {h['valueMYR']:>12,.0f}  {h['shariahStatus'] or 'unscreened'}")

divs = api.get("/investments/dividends").json()["dividends"][:3]
for d in divs:
    print(f"  dividend {d['symbol']} {d['currency']} {d['amount']} on {d['pay_date']}")
```

**Sync everything, then screen for compliant buys (bash):**

```bash
BASE=http://localhost:5199/api/v1; AUTH="Authorization: Bearer $RAIS_API_TOKEN"
for id in $(curl -s -H "$AUTH" $BASE/investments/connections | jq -r '.connections[].id'); do
  curl -s -X POST -H "$AUTH" $BASE/investments/connections/$id/sync > /dev/null
done
curl -s -H "$AUTH" $BASE/instruments | jq -r \
  '.instruments[] | select(.flags.shariah.status=="compliant" and .decision.action=="buy")
   | "\(.symbol)\t\(.decision.confidence)\t\(.flags.risk)"'
```

**Queue a paper order and wait for the fill:**

```bash
JOB=$(curl -s -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"symbol":"SPUS","side":"buy","amount":500,"mode":"paper"}' \
  $BASE/robo/orders | jq -r .jobId)
sleep 2
curl -s -H "$AUTH" $BASE/jobs/$JOB | jq '.job.result | fromjson'
```

---

## 8. MCP server (AI assistants)

The Python MCP server in [`integrations/mcp-python`](../../integrations/mcp-python/README.md)
exposes all of the above as 18 MCP tools, so Claude (Desktop/Code) can answer
questions like *"which of my holdings aren't Shariah-compliant?"* or *"queue a RM500
paper buy of the strongest compliant ETF"* directly against your account.

```bash
pip install ./integrations/mcp-python
claude mcp add rais-fintech \
  -e RAIS_API_URL=http://localhost:5199 -e RAIS_API_TOKEN=rfk_… \
  -- rais-fintech-mcp
```

A .NET client/backend remains a **future, documentation-only** option — see
[`docs/architecture/future-dotnet-backend.md`](../architecture/future-dotnet-backend.md).

---

## 9. Security model

- Tokens are stored **hashed** (SHA-256); plaintext is shown exactly once.
- Every token call stamps `last_used_at` — audit usage in Security → API Access.
- Scope failures and walls return clear 403 messages; invalid tokens 401.
- Broker credentials never transit this API; connection secrets live in Worker
  environment secrets, never in the database or responses.
