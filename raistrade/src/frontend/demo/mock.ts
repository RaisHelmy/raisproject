// In-browser stand-in for the Worker API, used only in demo mode. Seeded from the deterministic
// market (fills, binary settlements and robot histories are computed from real prices), so the
// showcase is consistent and never touches the real D1 account.

import { BY_CODE, KTYPES, klines, priceAt, round } from "../../shared/market";
import { TEMPLATE_BY_ID, backtest, type RuleConfig } from "../../shared/strategies";
import { FEE_SCHEDULE, feeTotal, quoteFees } from "../../shared/fees";
import { quoteAt } from "../../shared/costs";

type Row = Record<string, any>;
const S = {
  stock: { cash: 1_000_000, initial: 1_000_000 },
  bin: { cash: 10_000, initial: 10_000 },
  positions: new Map<string, { qty: number; avg_cost: number }>(),
  guards: [] as Row[], riskEvents: [] as Row[],
  orders: [] as Row[], binaries: [] as Row[], rules: [] as Row[], ruleTrades: [] as Row[], audit: [] as Row[],
  id: { order: 0, bin: 0, rule: 0, trade: 0, audit: 0 },
};

const audit = (event: string, detail: unknown, rule_id: number | null = null, actor = "admin", ts = Date.now()) =>
  S.audit.unshift({ id: ++S.id.audit, ts, rule_id, actor, event, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });

function fill(code: string, side: "BUY" | "SELL", qty: number, px: number, t: number) {
  const p = S.positions.get(code) ?? { qty: 0, avg_cost: 0 };
  const fee = feeTotal(code, side, qty, px, t);
  const gross = side === "SELL" ? (px - p.avg_cost) * qty : null;
  const buyFee = side === "SELL" ? feeTotal(code, "BUY", qty, p.avg_cost, t) : 0;
  if (side === "BUY") {
    S.stock.cash -= px * qty + fee;
    p.avg_cost = (p.avg_cost * p.qty + px * qty) / (p.qty + qty); p.qty += qty;
  } else {
    S.stock.cash += px * qty - fee; p.qty -= qty;
  }
  p.qty > 1e-9 ? S.positions.set(code, p) : S.positions.delete(code);
  S.orders.unshift({ id: ++S.id.order, code, trd_side: side, order_type: "MARKET", qty, price: null, status: "FILLED_ALL", dealt_avg_price: px, fee, remark: null, create_time: t, updated_time: t,
    expected_px: px, quote_ts: t, slippage: 0, spread_cost: (qty * quoteAt(code, t).spread) / 2, fee_version: FEE_SCHEDULE.version,
    costs: JSON.stringify(quoteFees(code, side, qty, px, t).lines), realized_gross: gross, realized_net: gross == null ? null : gross - fee - buyFee });
}

function settle(now = Date.now()) {
  for (const b of S.binaries) {
    if (b.status !== "OPEN" || b.expire_time > now) continue;
    const close = priceAt(b.code, b.expire_time);
    const won = b.direction === "CALL" ? close > b.strike : close < b.strike;
    b.close_price = close;
    b.status = close === b.strike ? "TIE" : won ? "WON" : "LOST";
    b.profit = b.status === "TIE" ? 0 : won ? round(b.amount * b.payout, 2) : -b.amount;
    if (!b.rule_id) S.bin.cash += b.status === "LOST" ? 0 : b.amount + b.profit;
    audit(`BINARY_${b.status}`, { option_id: b.id, code: b.code, close, profit: b.profit }, b.rule_id ?? null, b.rule_id ? "bot" : "system", b.expire_time);
  }
  for (const o of S.orders) {
    if (o.status !== "SUBMITTED") continue;
    const px = priceAt(o.code, now);
    if ((o.trd_side === "BUY" && px <= o.price) || (o.trd_side === "SELL" && px >= o.price)) {
      o.status = "FILLED_ALL"; o.dealt_avg_price = o.price; o.updated_time = now;
      const p = S.positions.get(o.code) ?? { qty: 0, avg_cost: 0 };
      if (o.trd_side === "BUY") { S.stock.cash -= o.price * o.qty; p.avg_cost = (p.avg_cost * p.qty + o.price * o.qty) / (p.qty + o.qty); p.qty += o.qty; }
      else { S.stock.cash += o.price * o.qty; p.qty -= o.qty; }
      p.qty > 1e-9 ? S.positions.set(o.code, p) : S.positions.delete(o.code);
    }
  }
}

function openBinary(code: string, direction: string, amount: number, expiry: number, t: number, rule_id: number | null = null) {
  const row = { id: ++S.id.bin, code, direction, amount, strike: priceAt(code, t), payout: BY_CODE[code]!.payout, open_time: t, expire_time: t + expiry * 1000, status: "OPEN", close_price: null, profit: null, rule_id };
  if (!rule_id) S.bin.cash -= amount;
  S.binaries.unshift(row);
  return row;
}

function addRule(b: Row, stats = true) {
  const tpl = TEMPLATE_BY_ID[b.template]!;
  const params = Object.fromEntries(tpl.params.map((p) => [p.key, Number(b.params?.[p.key] ?? p.def)]));
  const now = Date.now();
  const r: Row = {
    id: ++S.id.rule, name: (b.name ?? "").trim() || `${tpl.name} · ${b.code}`, template: b.template, mode: b.mode, code: b.code, ktype: b.ktype,
    params: JSON.stringify(params), amount: Number(b.amount), expiry: b.mode === "BINARY" ? Number(b.expiry) : null, money_mgmt: b.money_mgmt ?? "FIXED",
    stop_loss_pct: b.mode === "STOCK" ? b.stop_loss_pct ?? null : null, take_profit_pct: b.mode === "STOCK" ? b.take_profit_pct ?? null : null,
    status: "ACTIVE", stop_reason: null, wins: 0, losses: 0, ties: 0, pnl: 0, loss_streak: 0, pos_qty: 0, entry_price: null, cur_stake: Number(b.amount), created_at: now, updated_at: now,
  };
  audit("RULE_CREATED", { name: r.name, template: r.template, mode: r.mode, code: r.code, ktype: r.ktype, params }, r.id);
  if (stats) {
    // Give seeded robots a believable track record: replay their real signals over recent history.
    const cfg: RuleConfig = { template: r.template, mode: r.mode, code: r.code, ktype: r.ktype, params, amount: r.amount, expiry: r.expiry ?? 60, money_mgmt: r.money_mgmt, stop_loss_pct: r.stop_loss_pct, take_profit_pct: r.take_profit_pct };
    const bt = backtest(cfg, klines(r.code, r.ktype, 160, now).slice(0, -1));
    for (const [t, d] of bt.fills.slice(-25)) {
      const won = d > 0;
      r.wins += won ? 1 : 0; r.losses += won ? 0 : 1; r.pnl = round(r.pnl + d, 2); r.loss_streak = won ? 0 : r.loss_streak + 1;
      const px = priceAt(r.code, t);
      S.ruleTrades.unshift({ id: ++S.id.trade, rule_id: r.id, rule_name: r.name, code: r.code, kind: r.mode, side: r.mode === "BINARY" ? (won ? "CALL" : "PUT") : "SELL", qty: r.amount,
        entry_price: px, exit_price: priceAt(r.code, t + (r.expiry ?? KTYPES[r.ktype]!) * 1000), status: won ? "WON" : "LOST", pnl: round(d, 2), reason: "signal", opened_at: t, closed_at: t + 60_000 });
      audit(won ? "TRADE_WON" : "TRADE_LOST", { code: r.code, pnl: round(d, 2) }, r.id, "bot", t);
    }
  }
  S.rules.unshift(r);
  return r;
}

(function seed() {
  const now = Date.now(), H = 3600_000;
  fill("US.AAPL", "BUY", 50, priceAt("US.AAPL", now - 26 * H), now - 26 * H);
  fill("CC.BTCUSD", "BUY", 0.05, priceAt("CC.BTCUSD", now - 20 * H), now - 20 * H);
  fill("HK.00700", "BUY", 100, priceAt("HK.00700", now - 6 * H), now - 6 * H);
  fill("US.TSLA", "BUY", 20, priceAt("US.TSLA", now - 50 * H), now - 50 * H);
  // Demo record: sell TSLA at the best hour of the following day (a winning round trip after costs).
  let sellAt = now - 30 * H;
  for (let h = 40; h >= 25; h--) if (priceAt("US.TSLA", now - h * H) > priceAt("US.TSLA", sellAt)) sellAt = now - h * H;
  fill("US.TSLA", "SELL", 20, priceAt("US.TSLA", sellAt), sellAt);
  // Demo record: 6 of 8 seeded binaries won (two deliberate losses keep it realistic).
  for (let i = 0; i < 8; i++) {
    const code = ["FX.EURUSD", "CC.ETHUSD", "CM.XAUUSD", "US.NVDA"][i % 4]!, t = now - (i + 1) * 7 * 60_000;
    const up = priceAt(code, t + 60_000) > priceAt(code, t), lose = i === 2 || i === 5;
    openBinary(code, up !== lose ? "CALL" : "PUT", [50, 100, 200][i % 3]!, 60, t);
  }
  settle(now);
  addRule({ template: "stoch_cross", mode: "STOCK", code: "US.NVDA", ktype: "K_5M", amount: 10, stop_loss_pct: 1, take_profit_pct: 1.5, name: "🏆 Stochastic · NVDA · intraday" });
  addRule({ template: "zscore", mode: "BINARY", code: "FX.GBPUSD", ktype: "K_1M", amount: 50, expiry: 60, name: "Z-Score scalper · GBPUSD" });
  addRule({ template: "grid", mode: "STOCK", code: "HK.00700", ktype: "K_60M", amount: 100, stop_loss_pct: 8, name: "Grid · Tencent · position" });
  addRule({ template: "williams_r", mode: "STOCK", code: "CM.WTI", ktype: "K_5M", amount: 10, stop_loss_pct: 1, take_profit_pct: 1.5, name: "Williams %R · Crude oil" });
  addRule({ template: "rsi_reversal", mode: "BINARY", code: "CC.ETHUSD", ktype: "K_1M", amount: 25, expiry: 60, name: "RSI bounce · ETH" });
  const stopped = addRule({ template: "bb_breakout", mode: "BINARY", code: "US.AAPL", ktype: "K_1M", amount: 25, expiry: 60, name: "Bollinger breakout · AAPL" });
  stopped.loss_streak = 4; stopped.status = "STOPPED"; stopped.stop_reason = `4 losses in a row — stopped (record ${stopped.wins}W / ${stopped.losses}L)`;
})();

const ok = (o: Row = {}) => ({ ret: 0, ...o });

export async function mockApi(path: string, method: string, body: any): Promise<{ status: number; data: any }> {
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120));
  const now = Date.now();
  const [p = "", query] = path.split("?");
  const q = new URLSearchParams(query);
  settle(now);
  const R = (data: any, status = 200) => ({ status, data });

  if (p === "/api/me" || p === "/api/login") return R(ok({ user: "demo", trd_env: "SIMULATE" }));
  if (p === "/api/logout") return R(ok());
  if (p === "/api/trd/accinfo") {
    const positions = [...S.positions].map(([code, x]) => {
      const px = priceAt(code, now), val = px * x.qty;
      return { code, stock_name: BY_CODE[code]!.name, qty: x.qty, cost_price: round(x.avg_cost, 4), nominal_price: px, market_val: round(val, 2), pl_val: round(val - x.avg_cost * x.qty, 2), pl_ratio: round(((px - x.avg_cost) / x.avg_cost) * 100, 2) };
    });
    const mv = positions.reduce((s, x) => s + x.market_val, 0);
    const invested = S.binaries.filter((b) => b.status === "OPEN" && !b.rule_id).reduce((s, b) => s + b.amount, 0);
    return R(ok({ trd_env: "SIMULATE", stock: { cash: round(S.stock.cash, 2), market_val: round(mv, 2), total_assets: round(S.stock.cash + mv, 2), initial: S.stock.initial, positions }, binary: { balance: round(S.bin.cash, 2), invested, initial: S.bin.initial } }));
  }
  if (p === "/api/trd/orders" && method === "GET") return R(ok({ data: S.orders.slice(0, 100) }));
  if (p === "/api/trd/orders" && method === "POST") {
    const qty = Number(body.qty), inst = BY_CODE[body.code]!;
    if (body.order_type === "NORMAL") {
      const o = { id: ++S.id.order, code: body.code, trd_side: body.trd_side, order_type: "NORMAL", qty, price: Number(body.price), status: "SUBMITTED", dealt_avg_price: null, remark: null, create_time: now, updated_time: now };
      S.orders.unshift(o); settle(now);
      audit("ORDER", { order_id: o.id, code: o.code, side: o.trd_side, type: "NORMAL", qty, limit: o.price, status: o.status });
      return R(ok({ order_id: o.id, status: o.status }));
    }
    if (body.trd_side === "SELL" && (S.positions.get(body.code)?.qty ?? 0) < qty) return R({ ret: -1, msg: "Insufficient position" }, 400);
    fill(body.code, body.trd_side, qty, body.trd_side === "BUY" ? quoteAt(body.code, now).ask : quoteAt(body.code, now).bid, now);
    audit("ORDER", { order_id: S.id.order, code: body.code, side: body.trd_side, type: "MARKET", qty, status: "FILLED_ALL", lot: inst.lot });
    return R(ok({ order_id: S.id.order, status: "FILLED_ALL" }));
  }
  if (p.startsWith("/api/trd/orders/") && method === "DELETE") {
    const o = S.orders.find((x) => x.id === Number(p.split("/").pop()) && x.status === "SUBMITTED");
    if (o) { o.status = "CANCELLED_ALL"; o.updated_time = now; }
    return R(o ? ok() : { ret: -1, msg: "Order not cancellable" });
  }
  if (p === "/api/binary/trades" && method === "GET") return R(ok({ data: S.binaries.filter((b) => !b.rule_id).slice(0, 100), server_time: now }));
  if (p === "/api/binary/trades" && method === "POST") {
    if (S.bin.cash < body.amount) return R({ ret: -1, msg: "Insufficient balance" }, 400);
    const row = openBinary(body.code, body.direction, Number(body.amount), Number(body.expiry), now);
    audit("BINARY_OPEN", { option_id: row.id, code: row.code, direction: row.direction, amount: row.amount, expiry: body.expiry, strike: row.strike });
    return R(ok({ data: row }));
  }
  if (p === "/api/reset") {
    if (body.account === "STOCK") { S.stock.cash = S.stock.initial; S.positions.clear(); S.orders = []; }
    else { S.bin.cash = S.bin.initial; S.binaries = []; }
    return R(ok());
  }
  if (p === "/api/rules" && method === "GET") return R(ok({ data: S.rules.filter((r) => r.status !== "DELETED") }));
  if (p === "/api/rules" && method === "POST") return R(ok({ data: addRule(body, false) }));
  const m = p.match(/^\/api\/rules\/(\d+)(\/trades)?$/);
  if (m) {
    const r = S.rules.find((x) => x.id === Number(m[1]));
    if (!r) return R({ ret: -1, msg: "Not found" }, 404);
    if (m[2]) return R(ok({ data: S.ruleTrades.filter((t) => t.rule_id === r.id) }));
    if (method === "DELETE") { r.status = "DELETED"; audit("RULE_DELETED", "Rule archived", r.id); return R(ok()); }
    const a = body.action;
    if (a === "pause") { r.status = "PAUSED"; r.stop_reason = "Paused by admin"; }
    if (a === "resume") { r.status = "ACTIVE"; r.stop_reason = null; }
    if (a === "reset") Object.assign(r, { status: "ACTIVE", stop_reason: null, wins: 0, losses: 0, ties: 0, pnl: 0 });
    audit({ pause: "RULE_PAUSED", resume: "RULE_RESUMED", reset: "RULE_RESET" }[a as string] ?? "RULE_UPDATED", {}, r.id);
    return R(ok());
  }
  if (p === "/api/audit") {
    const rid = q.get("rule_id");
    const rows = S.audit.filter((a) => !rid || a.rule_id === Number(rid)).map((a): Row => ({ ...a, rule_name: S.rules.find((r) => r.id === a.rule_id)?.name ?? null }));
    return R(ok({ data: rows.sort((a, b) => b.ts - a.ts).slice(0, 300) }));
  }
  if (p.startsWith("/api/risk")) {
    if (p === "/api/risk") return R(ok({ data: { guards: S.guards, events: S.riskEvents, halts: [], context: { accountDDPct: 0, robotsStopped30m: 0 }, server_time: now } }));
    if (p === "/api/risk/guards" && method === "POST") { S.guards.unshift({ id: S.guards.length + 1, combo_id: body.combo_id, name: body.combo_id, config: JSON.stringify((await import("../../shared/risk")).COMBO_BY_ID[body.combo_id]), status: "ACTIVE", tripped_until: null, blocked: null, last_reason: null, last_trip: null, trips: 0 }); return R(ok()); }
    return R(ok());
  }
  if (p === "/api/sessions" || p.startsWith("/api/sessions/")) {
    const bins = S.binaries.filter((b) => b.status !== "OPEN"), wins = bins.filter((b) => b.status === "WON").length;
    const sells = S.orders.filter((o) => o.realized_net != null);
    const pnl = bins.reduce((t, b) => t + (b.profit ?? 0), 0) + sells.reduce((t, o) => t + o.realized_net, 0);
    const start = S.stock.initial + S.bin.initial;
    const summary = { id: 1, name: "Demo session", status: "ACTIVE", parent_id: null, notes: null, created_at: now - 6 * 3600_000, stopped_at: null,
      start_stock: S.stock.initial, start_binary: S.bin.initial, end_stock: S.stock.cash, end_binary: S.bin.cash, start_total: start, end_total: start + pnl,
      pnl, change_pct: (pnl / start) * 100, trades: bins.length + sells.length, wins: wins + sells.filter((o) => o.realized_net > 0).length,
      win_rate: bins.length + sells.length ? (wins + sells.filter((o) => o.realized_net > 0).length) / (bins.length + sells.length) : null,
      costs: S.orders.reduce((t, o) => t + (o.fee ?? 0) + (o.spread_cost ?? 0), 0), duration_ms: 6 * 3600_000,
      rules: S.rules.length, active_rules: S.rules.filter((r) => r.status === "ACTIVE").length, stopped_rules: S.rules.filter((r) => r.status === "STOPPED").length,
      bin_trades: bins.length, bin_wins: wins, bin_losses: bins.filter((b) => b.status === "LOST").length, bin_pnl: bins.reduce((t, b) => t + (b.profit ?? 0), 0),
      bin_volume: bins.reduce((t, b) => t + b.amount, 0), bin_payout: 0.85, bin_open: S.binaries.length - bins.length, fills: S.orders.length,
      stock_net: sells.reduce((t, o) => t + o.realized_net, 0), stock_gross: sells.reduce((t, o) => t + o.realized_gross, 0), fees: S.orders.reduce((t, o) => t + (o.fee ?? 0), 0) };
    if (p === "/api/sessions") return R(ok({ data: [summary], active_id: 1 }));
    let cum = 0;
    const equity = [...bins.map((b) => [b.expire_time, b.profit]), ...sells.map((o) => [o.updated_time, o.realized_net])].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, (cum += v)]);
    return R(ok({ data: { summary, rules: S.rules, equity, parent: null } }));
  }
  if (p === "/api/trades/all") return R(ok({ data: S.ruleTrades.slice().sort((a, b) => b.opened_at - a.opened_at).slice(0, 300) }));
  return R({ ret: -1, msg: "Not found" }, 404);
}
