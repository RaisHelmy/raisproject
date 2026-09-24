# Rais Fintech MCP Server (Python)

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants (Claude
Desktop, Claude Code, or any MCP client) control your Rais Fintech wealth over the
`/api/v1` Worker API: read your consolidated portfolio, screen instruments
(Shariah/risk/signals), run analyses, and — with a trade-scoped token — queue robo
orders.

It is a thin client: all authentication, scoping and data live in the Cloudflare
Worker. Nothing is stored locally.

## Setup

1. **Create an API token** in the Rais Fintech app: **System → Security → API Access**.
   - `read` scope: everything except order placement.
   - `read, trade`: additionally allows `queue_order`.
2. **Install** (Python ≥ 3.10):
   ```bash
   pip install ./integrations/mcp-python
   # or, with uv:  uv pip install ./integrations/mcp-python
   ```
3. **Configure environment**:
   ```bash
   export RAIS_API_URL="http://localhost:5199"   # or your deployed URL
   export RAIS_API_TOKEN="rfk_..."
   ```
4. **Run** (stdio):
   ```bash
   rais-fintech-mcp
   ```

## Register with Claude

**Claude Code:**
```bash
claude mcp add rais-fintech \
  -e RAIS_API_URL=http://localhost:5199 \
  -e RAIS_API_TOKEN=rfk_your_token \
  -- rais-fintech-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "rais-fintech": {
      "command": "rais-fintech-mcp",
      "env": {
        "RAIS_API_URL": "http://localhost:5199",
        "RAIS_API_TOKEN": "rfk_your_token"
      }
    }
  }
}
```

## Tools

| Tool | Scope | What it does |
| --- | --- | --- |
| `get_portfolio` | read | Consolidated MYR portfolio with provider/account breakdown and merged holdings |
| `list_holdings` | read | Per-account positions in native currencies |
| `list_transactions` / `list_dividends` / `list_orders` | read | Activity history across the scope |
| `list_connections` / `list_accounts` / `list_providers` | read | Broker connections, accounts, and the provider registry |
| `sync_connection` | read | Trigger an immediate broker sync |
| `list_instruments` | read | Screened universe: Shariah + risk flags, history, signals (filters: `shariah_only`, `max_risk`) |
| `analyze_instrument` | read | Full technique → method → algorithm breakdown for one symbol |
| `get_strategy_registry` | read | The robo engine's techniques, algorithms and decision library |
| `queue_analysis` | read | Queue an analysis job (one symbol or full universe) |
| `queue_order` | **trade** | Queue a robo order (paper by default; live also requires in-app consent) |
| `list_jobs` / `get_job` | read | Investment-queue status and results |
| `list_theories` | read | The admin-curated Theory Gallery |
| `get_rewards` | read | Points, tier, rank and leaderboard |

Example prompts once connected:

> "What's my portfolio worth, and which holdings aren't Shariah-compliant?"
> "Analyze AAPL and explain which algorithms disagree."
> "Queue a RM500 paper buy of the strongest compliant ETF."

## Notes

- Signals and analyses are informational, not financial advice.
- Live orders are refused unless live trading was explicitly enabled in the app —
  the Worker re-checks that consent at execution time, token or not.
- A .NET client/server remains a documented future option only
  (see `docs/architecture/future-dotnet-backend.md`); Python is the supported
  integration today.
