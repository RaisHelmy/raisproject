import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { BY_CODE, INSTRUMENTS, KTYPES, klines, priceAt, round, snapshot } from "../shared/market";
import { MONEY_MGMT, RULE_KTYPES, TEMPLATE_BY_ID } from "../shared/strategies";
import { audit, openBinary, placeOrder, settle } from "./engine";
import { estimateCosts } from "../shared/costs";
import { activeSession, registerSessions, sessionParam } from "./sessions";
import { registerRisk, riskGate } from "./risk";
import { registerMcp } from "./mcp";

// Demo backend modelled on the moomoo OpenAPI (OpenD) trade/quote surface, always in
// TrdEnv.SIMULATE: quotes come from the deterministic local market in ../shared/market.

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_USER: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();
const COOKIE = "rt_session";
const SESSION_TTL = 7 * 86400;
const BINARY_EXPIRIES = [30, 60, 120, 300, 900];
const STALE_QUOTE_MS = 15_000;

const enc = new TextEncoder();
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function secret(env: Env) {
  return env.SESSION_SECRET || `${env.ADMIN_PASSWORD}:raistrade`;
}

app.get("/healthz", (c) => c.json({ ok: true, trd_env: "SIMULATE" }));

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>().catch(() => ({}) as any);
  if (!safeEqual(String(username ?? ""), c.env.ADMIN_USER) || !safeEqual(String(password ?? ""), c.env.ADMIN_PASSWORD)) {
    return c.json({ ret: -1, msg: "Invalid username or password" }, 401);
  }
  const payload = `${c.env.ADMIN_USER}.${Math.floor(Date.now() / 1000) + SESSION_TTL}`;
  setCookie(c, COOKIE, `${payload}.${await hmac(secret(c.env), payload)}`, {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_TTL,
  });
  return c.json({ ret: 0, user: c.env.ADMIN_USER });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ret: 0 });
});

registerMcp(app as never);

app.use("/api/*", async (c, next) => {
  const raw = getCookie(c, COOKIE) ?? "";
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  const [user, exp] = payload.split(".");
  const ok = i > 0 && Number(exp) > Date.now() / 1000 && safeEqual(raw.slice(i + 1), await hmac(secret(c.env), payload));
  if (!ok) return c.json({ ret: -1, msg: "Not logged in" }, 401);
  c.set("user" as never, user as never);
  await next();
});

app.get("/api/me", (c) => c.json({ ret: 0, user: c.get("user" as never), trd_env: "SIMULATE" }));

// ---- Quote (get_stock_basicinfo / get_market_snapshot / request_history_kline) ----

app.get("/api/quote/instruments", (c) => c.json({ ret: 0, data: INSTRUMENTS }));

app.get("/api/quote/snapshot", (c) => {
  const codes = (c.req.query("code") ?? INSTRUMENTS.map((i) => i.code).join(",")).split(",").filter((k) => BY_CODE[k]);
  const now = Date.now();
  return c.json({ ret: 0, data: codes.map((k) => snapshot(k, now)) });
});

app.get("/api/quote/kline", (c) => {
  const code = c.req.query("code") ?? "";
  const ktype = c.req.query("ktype") ?? "K_1M";
  if (!BY_CODE[code] || !KTYPES[ktype]) return c.json({ ret: -1, msg: "bad code or ktype" }, 400);
  const num = Math.min(Number(c.req.query("num") ?? 200) || 200, 1000);
  return c.json({ ret: 0, data: klines(code, ktype, num) });
});

// ---- Trade (accinfo_query / position_list_query / order_list_query / place_order / modify_order) ----

app.get("/api/trd/accinfo", async (c) => {
  const db = c.env.DB, now = Date.now();
  await settle(db, now);
  const accts = await db.prepare("SELECT * FROM accounts").all<{ id: string; cash: number; initial: number }>();
  const pos = await db.prepare("SELECT * FROM positions").all<{ code: string; qty: number; avg_cost: number }>();
  const positions = pos.results.map((p) => {
    const px = priceAt(p.code, now);
    const val = px * p.qty;
    return {
      code: p.code, stock_name: BY_CODE[p.code]?.name, qty: p.qty, cost_price: round(p.avg_cost, 4), nominal_price: px,
      market_val: round(val, 2), pl_val: round(val - p.avg_cost * p.qty, 2), pl_ratio: round(((px - p.avg_cost) / p.avg_cost) * 100, 2),
    };
  });
  const stock = accts.results.find((a) => a.id === "STOCK")!;
  const bin = accts.results.find((a) => a.id === "BINARY")!;
  const mv = positions.reduce((s, p) => s + p.market_val, 0);
  const openBin = await db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM binary_options WHERE status='OPEN'").first<{ v: number }>();
  return c.json({
    ret: 0, trd_env: "SIMULATE",
    stock: { cash: round(stock.cash, 2), market_val: round(mv, 2), total_assets: round(stock.cash + mv, 2), initial: stock.initial, positions },
    binary: { balance: round(bin.cash, 2), invested: openBin!.v, initial: bin.initial },
  });
});

app.get("/api/trd/orders", async (c) => {
  await settle(c.env.DB, Date.now());
  const sid = await sessionParam(c.env.DB, c.req.query("session"));
  const r = await c.env.DB.prepare("SELECT * FROM orders WHERE session_id=? ORDER BY id DESC LIMIT 100").bind(sid).all();
  return c.json({ ret: 0, data: r.results });
});

app.post("/api/trd/orders", async (c) => {
  if (!(await activeSession(c.env.DB))) return c.json({ ret: -1, code: "NO_SESSION", msg: "No active session — start a session first (Sessions page)." }, 409);
  const b = await c.req.json<{ code: string; trd_side: string; order_type: string; qty: number; price?: number; expected_px?: number; quote_ts?: number; max_cost_pct?: number; accept_costs?: boolean }>();
  const inst = BY_CODE[b.code];
  const qty = Number(b.qty);
  if (!inst) return c.json({ ret: -1, msg: "Unknown code" }, 400);
  if (b.trd_side !== "BUY" && b.trd_side !== "SELL") return c.json({ ret: -1, msg: "trd_side must be BUY or SELL" }, 400);
  if (!(qty > 0)) return c.json({ ret: -1, msg: "qty must be positive" }, 400);
  if (Math.abs(qty / inst.lot - Math.round(qty / inst.lot)) > 1e-9) return c.json({ ret: -1, msg: `qty must be a multiple of lot size ${inst.lot}` }, 400);
  const type = b.order_type === "NORMAL" ? "NORMAL" : "MARKET";
  const limit = type === "NORMAL" ? Number(b.price) : null;
  if (type === "NORMAL" && !(limit! > 0)) return c.json({ ret: -1, msg: "Limit price required" }, 400);

  // Order validation: refuse stale quotes, and hold orders whose estimated costs exceed the user's limit.
  const now = Date.now();
  if (type === "MARKET" && b.quote_ts && now - Number(b.quote_ts) > STALE_QUOTE_MS)
    return c.json({ ret: -1, code: "STALE_QUOTE", msg: `Quote is ${Math.round((now - Number(b.quote_ts)) / 1000)}s old — refresh the price and try again.` }, 409);
  const est = estimateCosts(b.code, b.trd_side as "BUY" | "SELL", qty, { limit });
  const maxPct = Number(b.max_cost_pct ?? 2);
  if (b.trd_side === "BUY" && est.roundTripPct > maxPct && !b.accept_costs)
    return c.json({ ret: -1, code: "COST_LIMIT", round_trip_pct: est.roundTripPct, round_trip: est.roundTrip,
      msg: `Estimated round-trip cost ${est.roundTripPct.toFixed(2)}% is above your ${maxPct}% limit. Confirm to place it anyway.` }, 409);

  { const why = (await riskGate(c.env.DB)).blockedBy(b.code); if (why && b.trd_side === "BUY") return c.json({ ret: -1, code: "RISK_HALT", msg: `Trading halted by risk guard — ${why}` }, 423); }
  const o = await placeOrder(c.env.DB, b.code, b.trd_side as "BUY" | "SELL", type, qty, limit, null, { expected_px: b.expected_px ?? null, quote_ts: b.quote_ts ?? null });
  const failed = o.status !== "SUBMITTED" && o.status !== "FILLED_ALL";
  await audit(c.env.DB, "admin", failed ? "ORDER_REJECTED" : "ORDER", { order_id: o.id, code: b.code, side: b.trd_side, type, qty, limit, status: o.status });
  return c.json({ ret: failed ? -1 : 0, order_id: o.id, status: failed ? "FAILED" : o.status, msg: failed ? o.status : undefined }, failed ? 400 : 200);
});

app.delete("/api/trd/orders/:id", async (c) => {
  const r = await c.env.DB
    .prepare("UPDATE orders SET status='CANCELLED_ALL', updated_time=? WHERE id=? AND status='SUBMITTED'")
    .bind(Date.now(), Number(c.req.param("id")))
    .run();
  return c.json({ ret: r.meta.changes ? 0 : -1, msg: r.meta.changes ? undefined : "Order not cancellable" });
});

// ---- Binary options (IQ Option-style practice account) ----

app.get("/api/binary/trades", async (c) => {
  await settle(c.env.DB, Date.now());
  const sid = await sessionParam(c.env.DB, c.req.query("session"));
  const r = await c.env.DB.prepare("SELECT * FROM binary_options WHERE session_id=? ORDER BY id DESC LIMIT 100").bind(sid).all();
  return c.json({ ret: 0, data: r.results, server_time: Date.now() });
});

app.post("/api/binary/trades", async (c) => {
  if (!(await activeSession(c.env.DB))) return c.json({ ret: -1, code: "NO_SESSION", msg: "No active session — start a session first (Sessions page)." }, 409);
  const b = await c.req.json<{ code: string; direction: "CALL" | "PUT"; amount: number; expiry: number }>();
  const inst = BY_CODE[b.code];
  const amount = round(Number(b.amount), 2);
  if (!inst) return c.json({ ret: -1, msg: "Unknown asset" }, 400);
  if (b.direction !== "CALL" && b.direction !== "PUT") return c.json({ ret: -1, msg: "direction must be CALL or PUT" }, 400);
  if (!(amount >= 1 && amount <= 20000)) return c.json({ ret: -1, msg: "Amount must be between $1 and $20,000" }, 400);
  if (!BINARY_EXPIRIES.includes(Number(b.expiry))) return c.json({ ret: -1, msg: "Invalid expiry" }, 400);

  { const why = (await riskGate(c.env.DB)).blockedBy(b.code); if (why && true) return c.json({ ret: -1, code: "RISK_HALT", msg: `Trading halted by risk guard — ${why}` }, 423); }
  const row = await openBinary(c.env.DB, b.code, b.direction, amount, Number(b.expiry), null);
  if (!row) return c.json({ ret: -1, msg: "Insufficient balance" }, 400);
  await audit(c.env.DB, "admin", "BINARY_OPEN", { option_id: row.id, code: b.code, direction: b.direction, amount, expiry: b.expiry, strike: row.strike });
  return c.json({ ret: 0, data: row });
});

app.post("/api/reset", async (c) => {
  const { account } = await c.req.json<{ account: "STOCK" | "BINARY" }>();
  const db = c.env.DB;
  if (account === "STOCK") {
    await db.batch([
      db.prepare("UPDATE accounts SET cash = initial WHERE id='STOCK'"),
      db.prepare("DELETE FROM positions"),
      db.prepare("DELETE FROM orders"),
    ]);
  } else {
    await db.batch([
      db.prepare("UPDATE accounts SET cash = initial WHERE id='BINARY'"),
      db.prepare("DELETE FROM binary_options"),
    ]);
  }
  await audit(db, "admin", "RESET", { account });
  return c.json({ ret: 0 });
});

// ---- Auto-trade rules ----

interface RuleInput {
  name?: string; aggressive?: boolean; template: string; mode: "STOCK" | "BINARY"; code: string; ktype: string; params?: Record<string, number>;
  amount: number; expiry?: number; money_mgmt?: string; stop_loss_pct?: number | null; take_profit_pct?: number | null;
}

function validateRule(b: RuleInput): string | null {
  const tpl = TEMPLATE_BY_ID[b.template];
  const inst = BY_CODE[b.code];
  if (!tpl) return "Unknown template";
  if (!inst) return "Unknown asset";
  if (!tpl.modes.includes(b.mode)) return `${tpl.name} does not support ${b.mode} mode`;
  if (!RULE_KTYPES.includes(b.ktype)) return "Unsupported timeframe";
  const amt = Number(b.amount);
  if (b.mode === "BINARY") {
    if (!(amt >= 1 && amt <= 20000)) return "Stake must be $1–$20,000";
    if (!BINARY_EXPIRIES.includes(Number(b.expiry))) return "Invalid expiry";
  } else {
    if (!(amt > 0) || Math.abs(amt / inst.lot - Math.round(amt / inst.lot)) > 1e-9) return `Quantity must be a positive multiple of lot ${inst.lot}`;
  }
  if (b.money_mgmt && !(b.money_mgmt in MONEY_MGMT)) return "Invalid money management";
  for (const p of tpl.params) {
    const v = Number(b.params?.[p.key] ?? p.def);
    if (!Number.isFinite(v) || (p.min != null && v < p.min) || (p.max != null && v > p.max)) return `${p.label} out of range`;
  }
  return null;
}

app.get("/api/rules", async (c) => {
  await settle(c.env.DB);
  const sid = await sessionParam(c.env.DB, c.req.query("session"));
  const r = await c.env.DB.prepare("SELECT * FROM rules WHERE status != 'DELETED' AND session_id=? ORDER BY id DESC").bind(sid).all();
  return c.json({ ret: 0, data: r.results });
});

app.post("/api/rules", async (c) => {
  if (!(await activeSession(c.env.DB))) return c.json({ ret: -1, code: "NO_SESSION", msg: "No active session — start a session first (Sessions page)." }, 409);
  const b = await c.req.json<RuleInput>();
  const err = validateRule(b);
  if (err) return c.json({ ret: -1, msg: err }, 400);
  const tpl = TEMPLATE_BY_ID[b.template]!;
  const params = Object.fromEntries(tpl.params.map((p) => [p.key, Number(b.params?.[p.key] ?? p.def)]));
  const now = Date.now();
  const name = (b.name ?? "").trim().slice(0, 60) || `${tpl.name} · ${b.code}`;
  const sl = b.mode === "STOCK" && Number(b.stop_loss_pct) > 0 ? Number(b.stop_loss_pct) : null;
  const tp = b.mode === "STOCK" && Number(b.take_profit_pct) > 0 ? Number(b.take_profit_pct) : null;
  const ms = KTYPES[b.ktype]! * 1000;
  // The same robot twice just doubles the bet on one signal — refuse duplicates.
  const dup = await c.env.DB
    .prepare("SELECT id, name FROM rules WHERE status IN ('ACTIVE','PAUSED') AND template=? AND mode=? AND code=? AND ktype=? AND params=? AND COALESCE(expiry,0)=? AND money_mgmt=?")
    .bind(b.template, b.mode, b.code, b.ktype, JSON.stringify(params), b.mode === "BINARY" ? Number(b.expiry) : 0, b.mode === "BINARY" ? b.money_mgmt ?? "FIXED" : "FIXED")
    .first<{ id: number; name: string }>();
  if (dup) return c.json({ ret: -1, msg: `Already running as rule #${dup.id} (${dup.name}). Running it twice only doubles the risk on the same signal.` }, 409);
  // Start from the current bar so the rule acts on the next close, not a stale one.
  const row = await c.env.DB
    .prepare(`INSERT INTO rules (name, template, mode, code, ktype, params, amount, expiry, money_mgmt, stop_loss_pct, take_profit_pct, status, cur_stake, last_bar, created_at, updated_at, session_id, aggressive)
              VALUES (?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE', ?, ?, ?, ?, (SELECT id FROM sessions WHERE status='ACTIVE' ORDER BY id DESC LIMIT 1), ?) RETURNING *`)
    .bind(name, b.template, b.mode, b.code, b.ktype, JSON.stringify(params), Number(b.amount), b.mode === "BINARY" ? Number(b.expiry) : null,
      b.mode === "BINARY" ? b.money_mgmt ?? "FIXED" : "FIXED", sl, tp, Number(b.amount), Math.floor(now / ms) * ms - ms, now, now, b.aggressive ? 1 : 0)
    .first<{ id: number }>();
  await audit(c.env.DB, "admin", "RULE_CREATED", { name, template: b.template, mode: b.mode, code: b.code, ktype: b.ktype, params, amount: b.amount, expiry: b.expiry, money_mgmt: b.money_mgmt, sl, tp }, row!.id);
  return c.json({ ret: 0, data: row });
});

app.patch("/api/rules/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { action } = await c.req.json<{ action: "pause" | "resume" | "reset" }>();
  const db = c.env.DB, now = Date.now();
  const sql = {
    pause: "UPDATE rules SET status='PAUSED', stop_reason='Paused by admin', updated_at=? WHERE id=? AND status='ACTIVE'",
    resume: "UPDATE rules SET status='ACTIVE', stop_reason=NULL, loss_streak=0, updated_at=? WHERE id=? AND status IN ('PAUSED','STOPPED')",
    reset: "UPDATE rules SET status='ACTIVE', stop_reason=NULL, wins=0, losses=0, ties=0, pnl=0, loss_streak=0, cur_stake=amount, updated_at=? WHERE id=? AND status != 'DELETED'",
  }[action];
  if (!sql) return c.json({ ret: -1, msg: "Unknown action" }, 400);
  if (action !== "pause") {
    const live = await db.prepare("SELECT s.status FROM rules r JOIN sessions s ON s.id=r.session_id WHERE r.id=?").bind(id).first<{ status: string }>();
    if (live?.status !== "ACTIVE") return c.json({ ret: -1, msg: "This rule's session is stopped — start a new session (you can copy this rule into it)." }, 409);
  }
  const r = await db.prepare(sql).bind(now, id).run();
  if (!r.meta.changes) return c.json({ ret: -1, msg: "Rule not in a state for that action" }, 400);
  await audit(db, "admin", { pause: "RULE_PAUSED", resume: "RULE_RESUMED", reset: "RULE_RESET" }[action], {}, id);
  return c.json({ ret: 0 });
});

app.delete("/api/rules/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const r = await c.env.DB.prepare("UPDATE rules SET status='DELETED', updated_at=? WHERE id=? AND status!='DELETED'").bind(Date.now(), id).run();
  if (r.meta.changes) await audit(c.env.DB, "admin", "RULE_DELETED", "Rule archived; open positions are kept in the account", id);
  return c.json({ ret: r.meta.changes ? 0 : -1 });
});

app.get("/api/rules/:id/trades", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM rule_trades WHERE rule_id=? ORDER BY id DESC LIMIT 200").bind(Number(c.req.param("id"))).all();
  return c.json({ ret: 0, data: r.results });
});

app.get("/api/audit", async (c) => {
  const rule = c.req.query("rule_id");
  const q = rule
    ? c.env.DB.prepare("SELECT a.*, r.name AS rule_name FROM audit_log a LEFT JOIN rules r ON r.id=a.rule_id WHERE a.rule_id=? ORDER BY a.id DESC LIMIT 300").bind(Number(rule))
    : c.env.DB.prepare("SELECT a.*, r.name AS rule_name FROM audit_log a LEFT JOIN rules r ON r.id=a.rule_id WHERE a.session_id=? ORDER BY a.id DESC LIMIT 300").bind(await sessionParam(c.env.DB, c.req.query("session")));
  return c.json({ ret: 0, data: (await q.all()).results });
});

app.get("/api/trades/all", async (c) => {
  const r = await c.env.DB
    .prepare("SELECT t.*, r.name AS rule_name, r.code FROM rule_trades t JOIN rules r ON r.id=t.rule_id WHERE t.session_id=? ORDER BY t.id DESC LIMIT 300")
    .bind(await sessionParam(c.env.DB, c.req.query("session")))
    .all();
  return c.json({ ret: 0, data: r.results });
});

registerSessions(app as never);
registerRisk(app as never);

app.all("/api/*", (c) => c.json({ ret: -1, msg: "Not found" }, 404));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Keeps auto-trade rules running while nobody has the app open.
  async scheduled(_e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(settle(env.DB));
  },
};
