import { BY_CODE, KTYPES, klines, priceAt, round } from "../shared/market";
import { FEE_SCHEDULE, feeTotal, quoteFees } from "../shared/fees";
import { quoteAt } from "../shared/costs";
import { riskGate, type Gate } from "./risk";
import { AGGRESSIVE_EXPOSURE, MAX_BOT_EXPOSURE, MAX_MARTINGALE_SHARE, MAX_LOSS_STREAK, TEMPLATE_BY_ID, nextStake, type MoneyMgmt } from "../shared/strategies";

// Matching + auto-trade engine. Everything is lazy and idempotent: it runs on every API read and
// from the 1-minute cron, and uses conditional UPDATEs as claims so concurrent runs never double-trade.

export interface OrderRow {
  id: number; code: string; trd_side: "BUY" | "SELL"; order_type: string; qty: number; price: number | null; status: string; rule_id?: number | null;
}
interface BinaryRow {
  id: number; code: string; direction: "CALL" | "PUT"; amount: number; strike: number; payout: number; expire_time: number; rule_id: number | null;
}
export interface RuleRow {
  id: number; name: string; template: string; mode: "STOCK" | "BINARY"; code: string; ktype: string; params: string;
  amount: number; expiry: number | null; money_mgmt: MoneyMgmt; stop_loss_pct: number | null; take_profit_pct: number | null;
  status: string; wins: number; losses: number; pos_qty: number; entry_price: number | null; ref_price: number | null;
  cur_stake: number | null; last_bar: number; loss_streak: number; pnl: number; session_id: number | null; sess_aggressive?: number;
}

/** Session of a rule's activity, or the active session for manual activity. */
export const ACTIVE_SESSION = "(SELECT id FROM sessions WHERE status='ACTIVE' ORDER BY id DESC LIMIT 1)";
const SESSION_OF = `COALESCE((SELECT session_id FROM rules WHERE id=?), ${ACTIVE_SESSION})`;

export async function audit(db: D1Database, actor: string, event: string, detail: unknown, ruleId: number | null = null) {
  await db
    .prepare(`INSERT INTO audit_log (ts, rule_id, actor, event, detail, session_id) VALUES (?,?,?,?,?, ${SESSION_OF})`)
    .bind(Date.now(), ruleId, actor, event, typeof detail === "string" ? detail : JSON.stringify(detail), ruleId)
    .run();
}

/** Executes an order against the stock account; marks it FAILED if cash/holdings are insufficient.
 *  Records the confirmed cost breakdown: fees by line, spread paid, slippage vs. the quoted price,
 *  fee schedule version, and (on sells) realized P/L before and after all costs. */
export async function fill(db: D1Database, o: OrderRow & { expected_px?: number | null }, px: number, now: number): Promise<string> {
  const side = o.trd_side as "BUY" | "SELL";
  const cost = round(px * o.qty, 2);
  const fq = quoteFees(o.code, side, o.qty, px, now);
  const fee = fq.total;
  const q = quoteAt(o.code, now);
  const spreadCost = o.order_type === "MARKET" ? round((o.qty * (q.ask - q.bid)) / 2, 4) : 0;
  const exp = o.expected_px ?? null;
  const slippage = exp == null ? null : round((side === "BUY" ? px - exp : exp - px) * o.qty, 4);
  const costs = JSON.stringify(fq.lines.map((l) => ({ ...l, status: "confirmed" })));
  const acct = await db.prepare("SELECT cash FROM accounts WHERE id='STOCK'").first<{ cash: number }>();
  const pos = await db.prepare("SELECT qty, avg_cost, fee_paid FROM positions WHERE code=?").bind(o.code).first<{ qty: number; avg_cost: number; fee_paid: number }>();
  const fail = (remark: string) =>
    db.prepare("UPDATE orders SET status='FAILED', remark=?, updated_time=? WHERE id=?").bind(remark, now, o.id).run().then(() => remark);
  const done = (gross: number | null, net: number | null) =>
    db.prepare("UPDATE orders SET status='FILLED_ALL', dealt_avg_price=?, fee=?, spread_cost=?, slippage=?, fee_version=?, costs=?, realized_gross=?, realized_net=?, updated_time=? WHERE id=?")
      .bind(px, fee, spreadCost, slippage, FEE_SCHEDULE.version, costs, gross, net, now, o.id);

  if (side === "BUY") {
    if (cost + fee > acct!.cash) return fail(`Insufficient buying power (need ${round(cost + fee, 2)} incl. fees ${fee})`);
    const qty = (pos?.qty ?? 0) + o.qty;
    const avg = ((pos?.qty ?? 0) * (pos?.avg_cost ?? 0) + cost) / qty;
    await db.batch([
      db.prepare("UPDATE accounts SET cash = cash - ? WHERE id='STOCK'").bind(round(cost + fee, 2)),
      db.prepare("INSERT INTO positions (code, qty, avg_cost, fee_paid) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET qty=excluded.qty, avg_cost=excluded.avg_cost, fee_paid=positions.fee_paid + ?")
        .bind(o.code, qty, avg, fee, fee),
      done(null, null),
    ]);
  } else {
    if (!pos || pos.qty + 1e-9 < o.qty) return fail("Insufficient position (short selling disabled)");
    const left = round(pos.qty - o.qty, 8);
    const buyFees = (pos.fee_paid ?? 0) * (o.qty / pos.qty);
    const gross = round((px - pos.avg_cost) * o.qty, 2);
    const net = round(gross - fee - buyFees, 2);
    await db.batch([
      db.prepare("UPDATE accounts SET cash = cash + ? WHERE id='STOCK'").bind(round(cost - fee, 2)),
      left > 0
        ? db.prepare("UPDATE positions SET qty=?, fee_paid=fee_paid - ? WHERE code=?").bind(left, buyFees, o.code)
        : db.prepare("DELETE FROM positions WHERE code=?").bind(o.code),
      done(gross, net),
    ]);
  }
  return "FILLED_ALL";
}

export async function placeOrder(
  db: D1Database, code: string, side: "BUY" | "SELL", type: "MARKET" | "NORMAL", qty: number, limit: number | null, ruleId: number | null,
  quote?: { expected_px?: number | null; quote_ts?: number | null },
) {
  const now = Date.now();
  const q = quoteAt(code, now);
  const expected = quote?.expected_px ?? (type === "MARKET" ? (side === "BUY" ? q.ask : q.bid) : limit);
  const ins = await db
    .prepare(`INSERT INTO orders (code, trd_side, order_type, qty, price, status, create_time, updated_time, rule_id, expected_px, quote_ts, session_id) VALUES (?,?,?,?,?, 'SUBMITTED', ?, ?, ?, ?, ?, ${SESSION_OF}) RETURNING id`)
    .bind(code, side, type, qty, limit, now, now, ruleId, expected, quote?.quote_ts ?? now, ruleId)
    .first<{ id: number }>();
  const row = { id: ins!.id, code, trd_side: side, order_type: type, qty, price: limit, status: "SUBMITTED", expected_px: expected };
  // Market orders take the executable side of the quote: buys pay the ask, sells receive the bid.
  const px = side === "BUY" ? q.ask : q.bid;
  let status = "SUBMITTED";
  if (type === "MARKET") status = await fill(db, row, px, now);
  else if ((side === "BUY" && q.ask <= limit!) || (side === "SELL" && q.bid >= limit!)) status = await fill(db, row, limit!, now);
  return { id: row.id, status, px: type === "MARKET" ? px : limit! };
}

export async function openBinary(db: D1Database, code: string, direction: "CALL" | "PUT", amount: number, expiry: number, ruleId: number | null) {
  const now = Date.now();
  const debit = await db.prepare("UPDATE accounts SET cash = cash - ? WHERE id='BINARY' AND cash >= ?").bind(amount, amount).run();
  if (!debit.meta.changes) return null;
  return db
    .prepare(`INSERT INTO binary_options (code, direction, amount, strike, payout, open_time, expire_time, status, rule_id, session_id) VALUES (?,?,?,?,?,?,?, 'OPEN', ?, ${SESSION_OF}) RETURNING *`)
    .bind(code, direction, amount, priceAt(code, now), BY_CODE[code]!.payout, now, now + expiry * 1000, ruleId, ruleId)
    .first<BinaryRow>();
}

/** Counts a settled trial towards the rule and applies the auto-stop policy. */
async function recordOutcome(db: D1Database, ruleId: number, outcome: "WON" | "LOST" | "TIE", pnl: number) {
  const col = outcome === "WON" ? "wins" : outcome === "LOST" ? "losses" : "ties";
  const r = await db
    .prepare(`UPDATE rules SET ${col} = ${col} + 1, pnl = pnl + ?, loss_streak = ${outcome === "LOST" ? "loss_streak + 1" : outcome === "WON" ? "0" : "loss_streak"}, updated_at = ? WHERE id = ? RETURNING *`)
    .bind(pnl, Date.now(), ruleId)
    .first<RuleRow>();
  if (!r) return;
  await audit(db, "bot", outcome === "WON" ? "WIN" : outcome === "LOST" ? "LOSS" : "TIE", { pnl: round(pnl, 2), record: `${r.wins}W / ${r.losses}L` }, ruleId);
  if (r.mode === "BINARY" && outcome !== "TIE") {
    const stake = nextStake(r.money_mgmt, r.amount, r.cur_stake ?? r.amount, outcome === "WON");
    await db.prepare("UPDATE rules SET cur_stake=? WHERE id=?").bind(stake, ruleId).run();
  }
  if (r.status === "ACTIVE" && r.loss_streak >= MAX_LOSS_STREAK) {
    const reason = `${r.loss_streak} losses in a row — stopped (record ${r.wins}W / ${r.losses}L, P/L ${round(r.pnl, 2)})`;
    await db.prepare("UPDATE rules SET status='STOPPED', stop_reason=?, updated_at=? WHERE id=? AND status='ACTIVE'").bind(reason, Date.now(), ruleId).run();
    await audit(db, "system", "AUTO_STOP", reason, ruleId);
  }
}

async function exitStock(db: D1Database, r: RuleRow, reason: string) {
  // Claim the position so only one concurrent run exits it.
  const claim = await db.prepare("UPDATE rules SET pos_qty=0, updated_at=? WHERE id=? AND pos_qty>0").bind(Date.now(), r.id).run();
  if (!claim.meta.changes) return;
  const o = await placeOrder(db, r.code, "SELL", "MARKET", r.pos_qty, null, r.id);
  if (o.status !== "FILLED_ALL") {
    await db.prepare("UPDATE rules SET pos_qty=? WHERE id=?").bind(r.pos_qty, r.id).run();
    await audit(db, "bot", "ERROR", `Exit failed: ${o.status}`, r.id);
    return;
  }
  // Net of moomoo fees on both legs (buy fee estimated at the average entry price).
  const entry = r.entry_price ?? o.px;
  const fees = feeTotal(r.code, "BUY", r.pos_qty, entry) + feeTotal(r.code, "SELL", r.pos_qty, o.px);
  const pnl = round((o.px - entry) * r.pos_qty - fees, 2);
  const outcome = pnl > 0 ? "WON" : pnl < 0 ? "LOST" : "TIE";
  await db.batch([
    db.prepare("UPDATE rules SET entry_price=NULL, ref_price=? WHERE id=?").bind(o.px, r.id),
    db.prepare("UPDATE rule_trades SET status=?, exit_price=?, pnl=?, reason=?, closed_at=? WHERE rule_id=? AND kind='STOCK' AND status='OPEN'")
      .bind(outcome, o.px, pnl, reason, Date.now(), r.id),
  ]);
  await audit(db, "bot", "CLOSE", { side: "SELL", qty: r.pos_qty, price: o.px, reason, order_id: o.id }, r.id);
  await recordOutcome(db, r.id, outcome, pnl);
}

async function runRule(db: D1Database, r: RuleRow, now: number, gate: Gate) {
  const tpl = TEMPLATE_BY_ID[r.template];
  if (!tpl || !BY_CODE[r.code]) return;
  const ms = (KTYPES[r.ktype] ?? 60) * 1000;
  const barStart = Math.floor(now / ms) * ms;

  // Stop-loss / take-profit are checked on every run, not just at bar close.
  if (r.mode === "STOCK" && r.pos_qty > 0 && r.entry_price) {
    const ch = ((priceAt(r.code, now) - r.entry_price) / r.entry_price) * 100;
    if (r.stop_loss_pct && ch <= -r.stop_loss_pct) return exitStock(db, r, `Stop-loss ${r.stop_loss_pct}%`);
    if (r.take_profit_pct && ch >= r.take_profit_pct) return exitStock(db, r, `Take-profit ${r.take_profit_pct}%`);
  }

  const lastClosed = barStart - ms;
  if (lastClosed <= r.last_bar) return;
  const claim = await db.prepare("UPDATE rules SET last_bar=? WHERE id=? AND last_bar<? AND status='ACTIVE'").bind(lastClosed, r.id, lastClosed).run();
  if (!claim.meta.changes) return;

  const candles = klines(r.code, r.ktype, 301, barStart).slice(0, -1);
  const sig = tpl.prepare(candles, JSON.parse(r.params))(candles.length - 1, { posQty: r.pos_qty, entryPrice: r.entry_price, refPrice: r.ref_price });
  if (!sig) return;

  // Risk guard: no NEW positions while a guard covering this instrument is tripped (exits still run).
  const halted = r.mode === "BINARY" || sig === "BUY" ? gate.blockedBy(r.code) : null;
  if (halted && (r.mode === "BINARY" || r.pos_qty === 0 || r.template === "dca")) {
    await audit(db, "system", "RISK_BLOCKED", `Signal ${sig} skipped — ${halted}`, r.id);
    return;
  }

  if (r.mode === "BINARY") {
    const busy = await db.prepare("SELECT COUNT(*) AS n FROM binary_options WHERE rule_id=? AND status='OPEN'").bind(r.id).first<{ n: number }>();
    if (busy!.n > 0) return;
    const dir = sig === "BUY" ? "CALL" : "PUT";
    let stake = round(r.cur_stake ?? r.amount, 2);
    const acct = await db.prepare("SELECT cash FROM accounts WHERE id='BINARY'").first<{ cash: number }>();
    const open = await db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM binary_options WHERE status='OPEN' AND rule_id IS NOT NULL").first<{ v: number }>();
    const equity = acct!.cash + open!.v;
    if (r.money_mgmt === "MARTINGALE" && stake > r.amount && stake > equity * MAX_MARTINGALE_SHARE) {
      await db.prepare("UPDATE rules SET cur_stake=amount WHERE id=?").bind(r.id).run();
      await audit(db, "system", "MARTINGALE_CAPPED", `Next stake ${stake} would exceed ${MAX_MARTINGALE_SHARE * 100}% of equity ${round(equity, 2)} — reset to ${r.amount}`, r.id);
      stake = r.amount;
    }
    const cap = r.sess_aggressive ? AGGRESSIVE_EXPOSURE : MAX_BOT_EXPOSURE;
    if (open!.v + stake > equity * cap) {
      await audit(db, "system", "SKIPPED", `Exposure limit: open bot stakes ${open!.v} + ${stake} would exceed ${cap * 100}% of equity ${round(equity, 2)}`, r.id);
      return;
    }
    const b = await openBinary(db, r.code, dir, stake, r.expiry ?? 60, r.id);
    if (!b) {
      await db.prepare("UPDATE rules SET status='PAUSED', stop_reason='Insufficient practice balance' WHERE id=?").bind(r.id).run();
      await audit(db, "system", "PAUSED", "Insufficient practice balance", r.id);
      return;
    }
    await db
      .prepare("INSERT INTO rule_trades (rule_id, kind, ref_id, side, qty, entry_price, status, reason, opened_at, session_id) VALUES (?, 'BINARY', ?, ?, ?, ?, 'OPEN', ?, ?, ?)")
      .bind(r.id, b.id, dir, stake, b.strike, `${tpl.name} signal`, now, r.session_id)
      .run();
    await audit(db, "bot", "OPEN", { direction: dir, stake, strike: b.strike, expiry: r.expiry, option_id: b.id }, r.id);
    return;
  }

  if (sig === "BUY" && (r.pos_qty === 0 || r.template === "dca")) {
    const o = await placeOrder(db, r.code, "BUY", "MARKET", r.amount, null, r.id);
    if (o.status !== "FILLED_ALL") {
      await audit(db, "bot", "ERROR", `Buy failed: ${o.status}`, r.id);
      return;
    }
    const qty = r.pos_qty + r.amount;
    const entry = r.pos_qty ? ((r.entry_price ?? o.px) * r.pos_qty + o.px * r.amount) / qty : o.px;
    await db.prepare("UPDATE rules SET pos_qty=?, entry_price=?, updated_at=? WHERE id=?").bind(qty, entry, now, r.id).run();
    if (r.pos_qty === 0) {
      await db
        .prepare("INSERT INTO rule_trades (rule_id, kind, side, qty, entry_price, status, reason, opened_at, session_id) VALUES (?, 'STOCK', 'BUY', ?, ?, 'OPEN', ?, ?, ?)")
        .bind(r.id, qty, entry, `${tpl.name} signal`, now, r.session_id)
        .run();
    } else {
      await db.prepare("UPDATE rule_trades SET qty=?, entry_price=? WHERE rule_id=? AND kind='STOCK' AND status='OPEN'").bind(qty, entry, r.id).run();
    }
    await audit(db, "bot", "OPEN", { side: "BUY", qty: r.amount, price: o.px, order_id: o.id }, r.id);
  } else if (sig === "SELL" && r.pos_qty > 0 && r.template !== "dca") {
    await exitStock(db, r, `${tpl.name} exit signal`);
  }
}

/** Fills resting limit orders, settles expired binaries, then runs every active rule. */
export async function settle(db: D1Database, now = Date.now()) {
  const pending = await db.prepare("SELECT * FROM orders WHERE status = 'SUBMITTED'").all<OrderRow>();
  for (const o of pending.results) {
    const q = quoteAt(o.code, now);
    if ((o.trd_side === "BUY" && q.ask <= o.price!) || (o.trd_side === "SELL" && q.bid >= o.price!)) await fill(db, o, o.price!, now);
  }

  const expired = await db.prepare("SELECT * FROM binary_options WHERE status = 'OPEN' AND expire_time <= ?").bind(now).all<BinaryRow>();
  for (const b of expired.results) {
    const close = priceAt(b.code, b.expire_time);
    const win = b.direction === "CALL" ? close > b.strike : close < b.strike;
    const status = close === b.strike ? "TIE" : win ? "WON" : "LOST";
    const credit = status === "TIE" ? b.amount : status === "WON" ? round(b.amount * (1 + b.payout), 2) : 0;
    const profit = round(credit - b.amount, 2);
    const upd = await db.prepare("UPDATE binary_options SET status=?, close_price=?, profit=? WHERE id=? AND status='OPEN'").bind(status, close, profit, b.id).run();
    if (!upd.meta.changes) continue; // settled by a concurrent run
    await db.prepare("UPDATE accounts SET cash = cash + ? WHERE id='BINARY'").bind(credit).run();
    if (b.rule_id) {
      await db
        .prepare("UPDATE rule_trades SET status=?, exit_price=?, pnl=?, closed_at=? WHERE kind='BINARY' AND ref_id=?")
        .bind(status, close, profit, b.expire_time, b.id)
        .run();
      await recordOutcome(db, b.rule_id, status as "WON" | "LOST" | "TIE", profit);
    }
  }

  // Only rules of an ACTIVE session open new trades; open trades of stopped sessions still settle above.
  const rules = await db.prepare("SELECT r.*, s.aggressive AS sess_aggressive FROM rules r JOIN sessions s ON s.id = r.session_id WHERE r.status='ACTIVE' AND s.status='ACTIVE'").all<RuleRow>();
  const gate = rules.results.length ? await riskGate(db, now) : { blockedBy: () => null, halts: [] };
  for (const r of rules.results) {
    try { await runRule(db, r, now, gate); }
    catch (e) { await audit(db, "system", "ERROR", String((e as Error).message ?? e), r.id); }
  }
}
