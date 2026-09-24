"""
Rais Fintech MCP server.

Exposes the Rais Fintech Wealth API (/api/v1 on the Cloudflare Worker) as MCP
tools, so AI assistants can read a user's consolidated portfolio, run
analyses, and — with a trade-scoped token — queue robo orders.

Configuration (environment variables):
    RAIS_API_URL    Base URL of the deployment (default: http://localhost:5199)
    RAIS_API_TOKEN  Personal API token (create in Security → API Access).
                    'read' scope covers everything except queue_order,
                    which needs the 'trade' scope.

The server is a thin client: all authorization, scoping and data live in the
Worker. Nothing is cached or stored locally.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

try:  # mcp >= 2.0
    from mcp.server.mcpserver import MCPServer
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as MCPServer  # type: ignore[no-redef]

mcp = MCPServer(
    "rais-fintech",
    instructions=(
        "Wealth control for Rais Fintech. Read the consolidated portfolio, "
        "holdings, transactions and dividends across connected brokers; check "
        "instrument flags (Shariah compliance, risk, signals); run analyses; "
        "and, if the token allows trading, queue paper/live robo orders. "
        "Amounts are RM (MYR) unless stated otherwise. Signals are "
        "informational, not financial advice."
    ),
)


def _client() -> httpx.Client:
    base = os.environ.get("RAIS_API_URL", "http://localhost:5199").rstrip("/")
    token = os.environ.get("RAIS_API_TOKEN", "")
    if not token:
        raise RuntimeError(
            "RAIS_API_TOKEN is not set. Create a token in Rais Fintech under "
            "Security → API Access and export it before starting the server."
        )
    return httpx.Client(
        base_url=f"{base}/api/v1",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30.0,
    )


def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    with _client() as c:
        r = c.get(path, params=params)
        body = r.json() if "json" in r.headers.get("content-type", "") else {}
        if r.status_code >= 400:
            raise RuntimeError(body.get("error", f"API error {r.status_code}"))
        return body


def _post(path: str, payload: dict[str, Any] | None = None) -> Any:
    with _client() as c:
        r = c.post(path, json=payload or {})
        body = r.json() if "json" in r.headers.get("content-type", "") else {}
        if r.status_code >= 400:
            raise RuntimeError(body.get("error", f"API error {r.status_code}"))
        return body


def _scope_params(account_id: str, provider_id: str) -> dict[str, str]:
    params = {"accountId": account_id or "all"}
    if provider_id:
        params["providerId"] = provider_id
    return params


# ---------------------------------------------------------------- portfolio


@mcp.tool()
def get_portfolio(account_id: str = "all", provider_id: str = "") -> dict:
    """Consolidated portfolio: MYR total, per-provider and per-account
    breakdown, and holdings merged across brokers (with per-account
    drill-down, Shariah status and gain%). Scope with account_id (an account
    id or 'all') and/or provider_id (e.g. 'moomoo')."""
    return _get("/investments/portfolio", _scope_params(account_id, provider_id))


@mcp.tool()
def list_holdings(account_id: str = "all", provider_id: str = "") -> dict:
    """Un-merged holdings, account by account, in native currencies —
    the detailed ledger behind the consolidated portfolio."""
    return _get("/investments/holdings", _scope_params(account_id, provider_id))


@mcp.tool()
def list_transactions(account_id: str = "all", provider_id: str = "") -> dict:
    """Transaction history (buys, sells, deposits…) across the scope,
    newest first (up to 200)."""
    return _get("/investments/transactions", _scope_params(account_id, provider_id))


@mcp.tool()
def list_dividends(account_id: str = "all", provider_id: str = "") -> dict:
    """Dividend payouts across the scope, newest first."""
    return _get("/investments/dividends", _scope_params(account_id, provider_id))


@mcp.tool()
def list_orders() -> dict:
    """Robo orders placed through the investment queue, with fill details."""
    return _get("/investments/orders")


# -------------------------------------------------------------- connections


@mcp.tool()
def list_connections() -> dict:
    """Broker connections: provider, status (connected / syncing /
    needs_attention / …), environment and last sync time."""
    return _get("/investments/connections")


@mcp.tool()
def list_accounts() -> dict:
    """Investment accounts across all connections, with provider, currency
    and cash balances."""
    return _get("/investments/accounts")


@mcp.tool()
def sync_connection(connection_id: str) -> dict:
    """Trigger an immediate synchronization of one broker connection and
    return its refreshed status."""
    return _post(f"/investments/connections/{connection_id}/sync")


@mcp.tool()
def list_providers() -> dict:
    """The provider registry: capabilities, honest integration status
    (implemented / configured / available / coming_soon) and, where
    configured, account-opening links with their disclosure text."""
    return _get("/investments/providers")


# ------------------------------------------------------------------ markets


@mcp.tool()
def list_instruments(shariah_only: bool = False, max_risk: str = "") -> list[dict]:
    """The screened market universe. Each instrument carries flags
    (Shariah status + reason, low/medium/high risk, volatility, max
    drawdown), past performance (1M/3M/1Y) and the aggregate BUY/HOLD/SELL
    signal with confidence. Optionally filter to Shariah-compliant only
    and/or a maximum risk level ('low' or 'medium')."""
    data = _get("/instruments")["instruments"]
    order = {"low": 0, "medium": 1, "high": 2}
    out = []
    for a in data:
        if shariah_only and a["flags"]["shariah"]["status"] != "compliant":
            continue
        if max_risk and order.get(a["flags"]["risk"], 2) > order.get(max_risk, 2):
            continue
        out.append(
            {
                "symbol": a["symbol"],
                "name": a["name"],
                "type": a["type"],
                "market": a["market"],
                "price": a["history"]["latest"],
                "shariah": a["flags"]["shariah"]["status"],
                "risk": a["flags"]["risk"],
                "return_1m_pct": a["history"]["r1m"],
                "return_1y_pct": a["history"]["r1y"],
                "signal": a["decision"]["action"],
                "confidence": a["decision"]["confidence"],
            }
        )
    return out


@mcp.tool()
def analyze_instrument(symbol: str) -> dict:
    """Full algorithm breakdown for one instrument: every technique →
    method → algorithm signal with its reading, the vote tally, triggered
    risk filters, position-sizing suggestions, flags and history."""
    return _get(f"/instruments/{symbol}")["analysis"]


@mcp.tool()
def get_strategy_registry() -> dict:
    """The robo engine's structure: mechanical techniques, their methods
    and concrete algorithms, plus the decision library (aggregators, risk
    filters, position sizing)."""
    return _get("/robo/registry")


# -------------------------------------------------------------------- queue


@mcp.tool()
def queue_analysis(symbol: str = "") -> dict:
    """Queue an analysis job in the investment queue — one symbol, or the
    whole universe when symbol is empty. Returns the job id; poll
    list_jobs / get_job for the result."""
    return _post("/robo/analyze", {"symbol": symbol} if symbol else {})


@mcp.tool()
def queue_order(symbol: str, side: str, amount_rm: float, mode: str = "paper") -> dict:
    """Queue a robo order (side: 'buy' or 'sell'; amount in RM; mode
    'paper' or 'live'). Requires a token with the 'trade' scope. Live mode
    additionally requires live trading to be enabled in the app — the
    worker re-checks that consent at execution time. Returns the job id."""
    return _post("/robo/orders", {"symbol": symbol, "side": side, "amount": amount_rm, "mode": mode})


@mcp.tool()
def list_jobs() -> dict:
    """Recent investment-queue jobs (analyses and orders) with status and
    results."""
    return _get("/jobs")


@mcp.tool()
def get_job(job_id: str) -> dict:
    """One queue job with its full payload and result."""
    return _get(f"/jobs/{job_id}")


# ------------------------------------------------------------ knowledge etc.


@mcp.tool()
def list_theories(category: str = "") -> list[dict]:
    """The Theory Gallery: admin-curated investment theories (summary,
    when to use, risk notes, source). Optional category filter:
    technical | fundamental | risk | islamic | behavioral | general."""
    theories = _get("/theories")["theories"]
    if category:
        theories = [t for t in theories if t["category"] == category]
    return theories


@mcp.tool()
def get_rewards() -> dict:
    """Gamification snapshot: points, tier, rank, referral stats and the
    community leaderboard."""
    data = _get("/affiliate")
    return {
        "points": data["stats"]["points"],
        "rank": data["stats"]["rank"],
        "referrals": data["stats"]["referrals"],
        "tier": data["tier"]["current"],
        "next_tier": data["tier"]["next"],
        "leaderboard": data["leaderboard"],
    }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
