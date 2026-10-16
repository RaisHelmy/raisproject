// Shared, read-only performance report of the user's actual bot — behind a secret link
// (/mcp/r/<key>) the owner turns on, rotates or revokes. It is sanitised: no credentials, cookies,
// usernames or account identifiers, and nothing in it can place a trade.
// Formats: MCP server (POST), markdown (GET), JSON (GET …/report.json).

import type { Hono } from "hono";
import { BY_CODE, priceAt, round } from "../shared/market";
import { AGGRESSIVE_EXPOSURE, MAX_BOT_EXPOSURE, MAX_LOSS_STREAK, MAX_MARTINGALE_SHARE, TEMPLATE_BY_ID } from "../shared/strategies";
import { FEE_SCHEDULE } from "../shared/fees";
import { activityShariah, purification } from "../shared/shariah";
import { summarize, type SessionRow } from "./sessions";

type Env = { DB: D1Database };
const KEY = "report_share_key";

export async function shareKey(db: D1Database): Promise<string | null> {
  return (await db.prepare("SELECT value FROM settings WHERE key=?").bind(KEY).first<{ value: string }>())?.value ?? null;
}
async function setShareKey(db: D1Database, v: string | null) {
  if (v == null) await db.prepare("DELETE FROM settings WHERE key=?").bind(KEY).run();
  else await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(KEY, v, Date.now()).run();
}
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");

const METHOD = {
  market: "Prices come from RaisTrade's deterministic simulated market (a pure function of instrument and time) — not a live exchange feed. The same function draws the charts and settles every trade.",
  engine: "A Cloudflare Worker cron runs every minute. Each active robot evaluates its strategy on the last CLOSED candle only (no look-ahead) and opens at most one position at a time.",
  binary: "Fixed-payout binary options: a win pays stake × payout (e.g. 0.83–0.90), a loss loses the stake, an unchanged price refunds. Settled at the simulated price at expiry. Not a moomoo product; not Shariah-compliant.",
  stock: `Stock/futures-mapped trades fill at the ask (buy) / bid (sell) from a per-market spread model and pay moomoo Malaysia fees (schedule ${FEE_SCHEDULE.version}). Robot P/L is net of fees on both legs.`,
  risk_controls: [
    `Auto-stop after ${MAX_LOSS_STREAK} losses in a row`,
    `All open robot stakes together ≤ ${MAX_BOT_EXPOSURE * 100}% of the practice balance (${AGGRESSIVE_EXPOSURE * 100}% in aggressive mode)`,
    `Martingale stake resets to base once it would exceed ${MAX_MARTINGALE_SHARE * 100}% of the balance`,
    "Risk guards (crash / flash-move / volatility / account-drawdown detectors) block new trades while tripped; exits always allowed",
    "Duplicate robots (same strategy, asset, settings) are refused",
  ],
  limitations: [
    "Paper money on a simulated market. The simulated prices are mean-reverting by construction, which flatters short-term reversal strategies — real markets will be harder.",
    "Binary-option results do not transfer to moomoo (no such product).",
    "Small samples: robots with < 30 trades cannot be distinguished from luck; see win_rate_95 ranges.",
  ],
};

function wilson(w: number, n: number): [number, number] | null {
  if (!n) return null;
  const p = w / n, z = 1.96, den = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [round(Math.max(0, (c - m) / den), 3), round(Math.min(1, (c + m) / den), 3)];
}

export async function buildReport(db: D1Database, sessionId?: number) {
  const sessions = (await db.prepare("SELECT * FROM sessions ORDER BY id DESC").all<SessionRow>()).results;
  const target = sessions.find((s) => s.id === sessionId) ?? sessions.find((s) => s.status === "ACTIVE") ?? sessions[0];
  const all = [];
  for (const s of sessions) {
    const x: any = await summarize(db, s);
    all.push({ session: x.id, name: x.name, status: x.status, started: new Date(x.created_at).toISOString(), stopped: x.stopped_at ? new Date(x.stopped_at).toISOString() : null,
      hours: round(x.duration_ms / 3_600_000, 1), start_balance_usd: x.start_total, balance_usd: x.end_total, net_pnl_usd: x.pnl, change_pct: round(x.change_pct, 2),
      trades: x.trades, win_rate: x.win_rate == null ? null : round(x.win_rate, 3), robots: x.rules, auto_stopped: x.stopped_rules, trading_costs_usd: x.costs, based_on_session: x.parent_id });
  }
  if (!target) return { generated_at: new Date().toISOString(), sessions: all, note: "No sessions yet" };
  const sid = target.id;
  const rules = (await db.prepare("SELECT id, name, template, mode, code, ktype, params, amount, expiry, money_mgmt, stop_loss_pct, take_profit_pct, status, stop_reason, wins, losses, ties, pnl, loss_streak, aggressive FROM rules WHERE session_id=? AND status!='DELETED' ORDER BY pnl DESC").bind(sid).all<any>()).results;
  const trades = (await db.prepare("SELECT rule_id, kind, status, pnl, opened_at, closed_at FROM rule_trades WHERE session_id=? AND status IN ('WON','LOST','TIE') ORDER BY closed_at").bind(sid).all<any>()).results;
  const bins = (await db.prepare("SELECT code, direction, amount, strike, payout, expire_time, status, close_price, profit, rule_id FROM binary_options WHERE session_id=? AND status!='OPEN' ORDER BY id DESC LIMIT 500").bind(sid).all<any>()).results;
  const events = (await db.prepare("SELECT event, COUNT(*) AS n FROM audit_log WHERE session_id=? GROUP BY event").bind(sid).all<{ event: string; n: number }>()).results;
  const risk = (await db.prepare("SELECT e.ts, e.kind, g.name FROM risk_events e LEFT JOIN risk_guards g ON g.id=e.guard_id WHERE e.session_id=? ORDER BY e.id DESC LIMIT 50").bind(sid).all<any>()).results;

  // Equity curve (hourly) + max drawdown from realised trades.
  let cum = 0, peak = 0, mdd = 0;
  const hourly = new Map<number, number>();
  for (const t of trades) { cum += t.pnl ?? 0; peak = Math.max(peak, cum); mdd = Math.max(mdd, peak - cum); hourly.set(Math.floor((t.closed_at ?? 0) / 3_600_000) * 3_600_000, round(cum, 2)); }

  // Replay check: recompute each settled binary from the market function and compare with what the engine stored.
  let ok = 0, bad = 0;
  const mismatches: object[] = [];
  for (const b of bins) {
    const close = priceAt(b.code, b.expire_time), won = b.direction === "CALL" ? close > b.strike : close < b.strike;
    const status = close === b.strike ? "TIE" : won ? "WON" : "LOST";
    const profit = status === "TIE" ? 0 : won ? round(b.amount * b.payout, 2) : -b.amount;
    if (status === b.status && Math.abs(profit - b.profit) < 0.011 && Math.abs(close - b.close_price) < 1e-9) ok++;
    else { bad++; if (mismatches.length < 5) mismatches.push({ code: b.code, expected: { status, profit }, stored: { status: b.status, profit: b.profit } }); }
  }

  const robots = rules.map((r) => {
    const n = r.wins + r.losses, be = r.mode === "BINARY" ? 1 / (1 + (BY_CODE[r.code]?.payout ?? 0.85)) : null;
    const ci = wilson(r.wins, n);
    return {
      robot: r.name, strategy: TEMPLATE_BY_ID[r.template]?.name ?? r.template, mode: r.mode, market: r.code, timeframe: r.ktype,
      params: JSON.parse(r.params), stake_or_qty: r.amount, expiry_s: r.expiry, money_mgmt: r.money_mgmt, stop_loss_pct: r.stop_loss_pct, take_profit_pct: r.take_profit_pct,
      aggressive: !!r.aggressive, status: r.status, stop_reason: r.stop_reason, wins: r.wins, losses: r.losses, ties: r.ties,
      win_rate: n ? round(r.wins / n, 3) : null, win_rate_95: ci, break_even_win_rate: be == null ? null : round(be, 3),
      verdict: !n || !ci || be == null ? "n/a" : ci[0] > be ? "proven above break-even" : ci[1] < be ? "proven below break-even" : "not proven yet",
      net_pnl_usd: round(r.pnl, 2), losing_streak: r.loss_streak, shariah: activityShariah(r.mode, r.code, r.money_mgmt).status,
    };
  });
  const s: any = await summarize(db, target);
  const pnls = trades.map((t) => t.pnl ?? 0), gp = pnls.filter((x) => x > 0).reduce((a, b) => a + b, 0), gl = -pnls.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const open = (await db.prepare("SELECT code, amount, rule_id FROM binary_options WHERE session_id=? AND status='OPEN'").bind(sid).all<any>()).results;
  const positions = (await db.prepare("SELECT code, qty, avg_cost FROM positions").all<any>()).results;
  const openStake = open.reduce((a, b) => a + b.amount, 0), byMarket = new Map<string, number>();
  for (const o of open) byMarket.set(o.code, (byMarket.get(o.code) ?? 0) + o.amount);
  const startEq = s.start_binary + s.start_stock, eq = s.end_binary + s.end_stock;
  const n = trades.filter((t) => t.status !== "TIE").length, w = trades.filter((t) => t.status === "WON").length;
  return {
    generated_at: new Date().toISOString(),
    disclaimer: "Paper trading on a simulated market. Not financial advice. Shared read-only by the owner; contains no credentials or account identifiers.",
    currency: "USD (the app displays MYR at the simulated USD/MYR rate)",
    session: {
      session: s.id, name: s.name, status: s.status, started: new Date(s.created_at).toISOString(), hours_running: round(s.duration_ms / 3_600_000, 1),
      start_balance_usd: { practice_binary: s.start_binary, stock: s.start_stock }, balance_usd: { practice_binary: s.end_binary, stock: s.end_stock },
      net_pnl_usd: s.pnl, binary_pnl_usd: s.bin_pnl, stock_pnl_after_costs_usd: s.stock_net, stock_trading_costs_usd: s.costs,
      closed_trades: trades.length, wins: w, losses: n - w, win_rate: n ? round(w / n, 3) : null, win_rate_95: wilson(w, n),
      expectancy_per_trade_usd: trades.length ? round(trades.reduce((a, t) => a + (t.pnl ?? 0), 0) / trades.length, 3) : null,
      max_drawdown_usd: round(mdd, 2), robots_total: rules.length, robots_running: rules.filter((r) => r.status === "ACTIVE").length,
      robots_auto_stopped: rules.filter((r) => r.status === "STOPPED").length, aggressive_mode: !!(target as any).aggressive,
    },
    key_metrics: {
      starting_equity_usd: round(startEq, 2), current_equity_usd: round(eq, 2), return_pct: round(((eq - startEq) / startEq) * 100, 2), net_realised_pnl_usd: s.pnl,
      closed_trades: trades.length, win_rate: n ? round(w / n, 3) : null, profit_factor: gl ? round(gp / gl, 3) : null, gross_profit_usd: round(gp, 2), gross_loss_usd: round(gl, 2),
      average_win_usd: w ? round(gp / w, 3) : null, average_loss_usd: n - w ? round(gl / (n - w), 3) : null,
      largest_win_usd: pnls.length ? round(Math.max(...pnls), 2) : null, largest_loss_usd: pnls.length ? round(Math.min(...pnls), 2) : null,
      max_drawdown_usd: round(mdd, 2), max_drawdown_pct_of_start: round((mdd / startEq) * 100, 2),
      open_binary_positions: open.length, open_binary_stake_usd: round(openStake, 2), open_stake_pct_of_equity: eq ? round((openStake / eq) * 100, 2) : 0,
      largest_open_market: [...byMarket].sort((a, b) => b[1] - a[1])[0] ?? null, open_stock_positions: positions.length,
      markets_traded: new Set(rules.map((r) => r.code)).size, robots: rules.length,
      data_basis: "paper trading, simulated market — see methodology.limitations",
    },
    equity_curve_hourly_usd: [...hourly].map(([t, v]) => [new Date(t).toISOString(), v]),
    robots,
    engine_check: { method: "Each settled binary trade re-computed from the market price function at its expiry and compared with the stored result.", checked: ok + bad, matching: ok, mismatching: bad, examples: mismatches },
    activity_counts: Object.fromEntries(events.map((e) => [e.event, e.n])),
    risk_events: risk.map((e) => ({ at: new Date(e.ts).toISOString(), kind: e.kind, guard: e.name })),
    shariah_cleansing: (() => { const p = purification(trades.map((t) => { const rr = rules.find((x) => x.id === t.rule_id); return { mode: rr?.mode ?? "BINARY", code: rr?.code ?? "", pnl: t.pnl ?? 0, mm: rr?.money_mgmt }; }));
      return { must_purify_usd: round(p.mustPurify, 2), recommended_purify_usd: round(p.recommendPurify, 2), halal_net_usd: round(p.halalNet, 2),
        by_status: Object.fromEntries(Object.entries(p.classes).map(([k, v]) => [k, { trades: v.trades, profit_usd: round(v.profit, 2), loss_usd: round(v.loss, 2), net_usd: round(v.net, 2), share_of_profit: round(v.shareOfProfit, 3) }])) }; })(),
    all_sessions: all,
    methodology: METHOD,
  };
}

function toMarkdown(r: any) {
  if (!r.session) return `# RaisTrade performance report\n\nNo sessions yet.`;
  const s = r.session, pct = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`), usd = (x: number) => `${x < 0 ? "-" : ""}US$${Math.abs(x).toFixed(2)}`;
  return `# RaisTrade bot — read-only performance report

_Generated ${r.generated_at}. ${r.disclaimer}_

## Session ${s.session} · ${s.name} (${s.status}, ${s.hours_running} h)
| Metric | Value |
|---|---|
| Net P/L | **${usd(s.net_pnl_usd)}** (binary ${usd(s.binary_pnl_usd)}, stock after costs ${usd(s.stock_pnl_after_costs_usd)}) |
| Balance (practice / stock) | ${usd(s.balance_usd.practice_binary)} / ${usd(s.balance_usd.stock)} — started ${usd(s.start_balance_usd.practice_binary)} / ${usd(s.start_balance_usd.stock)} |
| Closed trades | ${s.closed_trades} — ${s.wins}W / ${s.losses}L, win rate ${pct(s.win_rate)}${s.win_rate_95 ? ` (95% range ${pct(s.win_rate_95[0])}–${pct(s.win_rate_95[1])})` : ""} |
| Expectancy / trade | ${s.expectancy_per_trade_usd == null ? "—" : usd(s.expectancy_per_trade_usd)} |
| Max drawdown | ${usd(s.max_drawdown_usd)} (${r.key_metrics.max_drawdown_pct_of_start}% of start) |
| Equity | ${usd(r.key_metrics.starting_equity_usd)} → ${usd(r.key_metrics.current_equity_usd)} (${r.key_metrics.return_pct}%) |
| Profit factor | ${r.key_metrics.profit_factor ?? "—"} (gross profit ${usd(r.key_metrics.gross_profit_usd)} / gross loss ${usd(r.key_metrics.gross_loss_usd)}) |
| Largest win / loss | ${r.key_metrics.largest_win_usd == null ? "—" : usd(r.key_metrics.largest_win_usd)} / ${r.key_metrics.largest_loss_usd == null ? "—" : usd(r.key_metrics.largest_loss_usd)} |
| Open now | ${r.key_metrics.open_binary_positions} binary positions, ${usd(r.key_metrics.open_binary_stake_usd)} staked (${r.key_metrics.open_stake_pct_of_equity}% of equity) · ${r.key_metrics.open_stock_positions} stock positions |
| Shariah cleansing | must purify ${usd(r.shariah_cleansing.must_purify_usd)} · recommended ${usd(r.shariah_cleansing.recommended_purify_usd)} · halal net ${usd(r.shariah_cleansing.halal_net_usd)} |
| Robots | ${s.robots_total} (${s.robots_running} running, ${s.robots_auto_stopped} auto-stopped)${s.aggressive_mode ? " · aggressive mode ON" : ""} |
| Engine check | ${r.engine_check.matching}/${r.engine_check.checked} settled binaries re-computed and matching${r.engine_check.mismatching ? ` — **${r.engine_check.mismatching} mismatches**` : ""} |

## Robots
| Robot | Market | Mode | W/L | Win (95%) | Needs | Verdict | Net P/L |
|---|---|---|---|---|---|---|---|
${r.robots.map((x: any) => `| ${x.robot} | ${x.market} | ${x.mode}${x.aggressive ? " ⚡" : ""} | ${x.wins}/${x.losses} | ${pct(x.win_rate)}${x.win_rate_95 ? ` (${pct(x.win_rate_95[0])}–${pct(x.win_rate_95[1])})` : ""} | ${pct(x.break_even_win_rate)} | ${x.verdict} | ${usd(x.net_pnl_usd)} |`).join("\n")}

## All sessions
| # | Name | Status | Hours | Net P/L | Trades | Win |
|---|---|---|---|---|---|---|
${r.all_sessions.map((x: any) => `| ${x.session} | ${x.name} | ${x.status} | ${x.hours} | ${usd(x.net_pnl_usd)} | ${x.trades} | ${pct(x.win_rate)} |`).join("\n")}

## Method
- ${r.methodology.market}
- ${r.methodology.engine}
- ${r.methodology.binary}
- ${r.methodology.stock}

**Risk controls:** ${r.methodology.risk_controls.join("; ")}.

**Limitations:** ${r.methodology.limitations.join(" ")}

Full data (equity curve, parameters, risk events): append \`/report.json\` to this URL.
`;
}

const reportTools = [
  { name: "get_performance_report", description: "Read-only, sanitised performance report of the owner's RaisTrade bot: active session summary, every robot's record vs break-even, equity curve, drawdown, engine replay check, risk events, all sessions and methodology.", inputSchema: { type: "object", properties: { session: { type: "integer", description: "Optional session number (default: the active session)" } } } },
  { name: "list_sessions", description: "Summary of every trading session (P/L, trades, win rate, duration).", inputSchema: { type: "object", properties: {} } },
  { name: "verify_engine", description: "Re-computes every settled binary trade from the market price function and reports how many match the stored results.", inputSchema: { type: "object", properties: { session: { type: "integer" } } } },
  { name: "search", description: "Search the report (robots, sessions, methodology). Returns ids for fetch.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "fetch", description: "Fetch a report section by id: summary, robots, sessions, engine-check, methodology, or robot-<n>.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
];

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Owner endpoints — registered after the login middleware so only the logged-in owner can toggle sharing. */
export function registerReportOwner(app: Hono<{ Bindings: Env }>) {
  app.get("/api/share", async (c) => { const k = await shareKey(c.env.DB); return c.json({ ret: 0, enabled: !!k, key: k }); });
  app.post("/api/share", async (c) => {
    const { enable, rotate } = await c.req.json<{ enable: boolean; rotate?: boolean }>();
    const cur = await shareKey(c.env.DB);
    const k = enable ? (rotate || !cur ? newKey() : cur) : null;
    await setShareKey(c.env.DB, k);
    return c.json({ ret: 0, enabled: !!k, key: k });
  });
}

/** Public routes, valid only with the current secret key. */
export function registerReportPublic(app: Hono<{ Bindings: Env }>) {
  const _c = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  const valid = async (c: any) => { const k = await shareKey(c.env.DB); return !!k && c.req.param("key") === k; };
  const denied = () => new Response(JSON.stringify({ error: "Report link is invalid or was revoked by the owner." }), { status: 404, headers: { ...cors, "content-type": "application/json" } });

  app.options("/mcp/r/:key", () => new Response(null, { headers: cors }));
  app.get("/mcp/r/:key", async (c) => (await valid(c)) ? new Response(toMarkdown(await buildReport(c.env.DB, Number(c.req.query("session")) || undefined)), { headers: { ...cors, "content-type": "text/markdown; charset=utf-8" } }) : denied());
  app.get("/mcp/r/:key/report.json", async (c) => {
    if (!(await valid(c))) return denied();
    const r: any = await buildReport(c.env.DB, Number(c.req.query("session")) || undefined), sec = c.req.query("section");
    // ?section=key_metrics|session|robots|equity_curve_hourly_usd|engine_check|risk_events|all_sessions|methodology — for readers that truncate large JSON.
    if (sec) return r[sec] !== undefined ? c.json({ generated_at: r.generated_at, disclaimer: r.disclaimer, [sec]: r[sec] }, 200, cors) : c.json({ error: "Unknown section", sections: Object.keys(r) }, 404, cors);
    return c.json(r, 200, cors);
  });
  // Compact: just the numbers an analyst asks for first.
  app.get("/mcp/r/:key/summary.json", async (c) => {
    if (!(await valid(c))) return denied();
    const r: any = await buildReport(c.env.DB, Number(c.req.query("session")) || undefined);
    const top = [...r.robots].sort((a: any, b: any) => b.net_pnl_usd - a.net_pnl_usd);
    return c.json({ generated_at: r.generated_at, disclaimer: r.disclaimer, key_metrics: r.key_metrics, engine_check: { checked: r.engine_check.checked, matching: r.engine_check.matching },
      best_robots: top.slice(0, 5).map((x: any) => ({ robot: x.robot, net_pnl_usd: x.net_pnl_usd, wins: x.wins, losses: x.losses, verdict: x.verdict })),
      worst_robots: top.slice(-5).map((x: any) => ({ robot: x.robot, net_pnl_usd: x.net_pnl_usd, wins: x.wins, losses: x.losses, verdict: x.verdict })),
      shariah_cleansing: r.shariah_cleansing, sections: `${new URL(c.req.url).origin}/mcp/r/${c.req.param("key")}/report.json?section=<name>` }, 200, cors);
  });
  app.post("/mcp/r/:key", async (c) => {
    if (!(await valid(c))) return denied();
    const body = await c.req.json().catch(() => null);
    const handle = async (m: any) => {
      if (m?.id === undefined || m?.id === null) return null;
      const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
      const text = (o: unknown) => ok({ content: [{ type: "text", text: JSON.stringify(o, null, 2) }] });
      switch (m.method) {
        case "initialize": return ok({ protocolVersion: ["2025-06-18", "2025-03-26", "2024-11-05"].includes(m.params?.protocolVersion) ? m.params.protocolVersion : "2025-06-18",
          capabilities: { tools: { listChanged: false } }, serverInfo: { name: "raistrade-report", title: "RaisTrade bot performance (read-only)", version: "1.0.0" },
          instructions: "Read-only, sanitised performance data of the owner's paper-trading bot on a simulated market. Call get_performance_report first; verify_engine re-checks settled trades. Nothing here can trade." });
        case "ping": return ok({});
        case "tools/list": return ok({ tools: reportTools });
        case "tools/call": {
          const a = m.params?.arguments ?? {}, r: any = await buildReport(c.env.DB, Number(a.session) || undefined);
          switch (m.params?.name) {
            case "get_performance_report": return text(r);
            case "list_sessions": return text(r.all_sessions);
            case "verify_engine": return text(r.engine_check);
            case "search": {
              const q = String(a.query ?? "").toLowerCase();
              const docs = [["summary", "Session summary"], ["robots", "All robots"], ["sessions", "All sessions"], ["engine-check", "Engine replay check"], ["methodology", "Method, risk controls and limitations"],
                ...r.robots.map((x: any, i: number) => [`robot-${i + 1}`, `${x.robot} (${x.market}, ${x.verdict})`])] as [string, string][];
              return text({ results: docs.filter(([id, t]) => !q || (id + " " + t).toLowerCase().includes(q) || q.split(/\s+/).some((w) => t.toLowerCase().includes(w))).slice(0, 20).map(([id, title]) => ({ id, title, url: `${new URL(c.req.url).origin}/mcp/r/${c.req.param("key")}` })) });
            }
            case "fetch": {
              const id = String(a.id), url = `${new URL(c.req.url).origin}/mcp/r/${c.req.param("key")}`;
              const map: Record<string, unknown> = { summary: r.session, robots: r.robots, sessions: r.all_sessions, "engine-check": r.engine_check, methodology: r.methodology };
              const robot = id.startsWith("robot-") ? r.robots[Number(id.slice(6)) - 1] : undefined;
              const v = map[id] ?? robot;
              return v ? text({ id, title: id, text: JSON.stringify(v, null, 2), url }) : ok({ isError: true, content: [{ type: "text", text: `Unknown id ${id}` }] });
            }
          }
          return ok({ isError: true, content: [{ type: "text", text: "Unknown tool" }] });
        }
        default: return { jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } };
      }
    };
    if (Array.isArray(body)) { const out = (await Promise.all(body.map(handle))).filter(Boolean); return out.length ? c.json(out, 200, cors) : new Response(null, { status: 202, headers: cors }); }
    const out = await handle(body);
    return out ? c.json(out, 200, cors) : new Response(null, { status: 202, headers: cors });
  });
}
