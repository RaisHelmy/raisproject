// Sessions: a trading run with its own rules and history. One session is ACTIVE at a time; stopping
// it pauses its rules (open trades still settle), and a new session can copy rules from any earlier one.

import type { Hono } from "hono";
import { KTYPES, priceAt, round } from "../shared/market";
import { ACTIVE_SESSION, audit } from "./engine";

type Env = { DB: D1Database };

export interface SessionRow {
  id: number; name: string; status: "ACTIVE" | "STOPPED"; parent_id: number | null; start_stock: number; start_binary: number;
  end_stock: number | null; end_binary: number | null; notes: string | null; created_at: number; stopped_at: number | null;
}

export async function activeSession(db: D1Database): Promise<SessionRow | null> {
  return db.prepare(`SELECT * FROM sessions WHERE id = ${ACTIVE_SESSION}`).first<SessionRow>();
}

/** Session id from ?session=…, else the active session (0 if none). */
export async function sessionParam(db: D1Database, q: string | undefined): Promise<number> {
  if (q && Number(q) > 0) return Number(q);
  return (await activeSession(db))?.id ?? 0;
}

async function balances(db: D1Database) {
  const acc = await db.prepare("SELECT id, cash FROM accounts").all<{ id: string; cash: number }>();
  const pos = await db.prepare("SELECT code, qty FROM positions").all<{ code: string; qty: number }>();
  const now = Date.now();
  const mv = pos.results.reduce((s, p) => s + priceAt(p.code, now) * p.qty, 0);
  const openBin = await db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM binary_options WHERE status='OPEN'").first<{ v: number }>();
  const cash = (id: string) => acc.results.find((a) => a.id === id)?.cash ?? 0;
  return { stock: round(cash("STOCK") + mv, 2), binary: round(cash("BINARY") + openBin!.v, 2) };
}

export async function summarize(db: D1Database, s: SessionRow) {
  const r = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM rules WHERE session_id=?1 AND status!='DELETED') AS rules,
      (SELECT COUNT(*) FROM rules WHERE session_id=?1 AND status='ACTIVE') AS active_rules,
      (SELECT COUNT(*) FROM rules WHERE session_id=?1 AND status='STOPPED') AS stopped_rules,
      (SELECT COUNT(*) FROM binary_options WHERE session_id=?1 AND status!='OPEN') AS bin_trades,
      (SELECT COALESCE(SUM(status='WON'),0) FROM binary_options WHERE session_id=?1) AS bin_wins,
      (SELECT COALESCE(SUM(status='LOST'),0) FROM binary_options WHERE session_id=?1) AS bin_losses,
      (SELECT COALESCE(SUM(profit),0) FROM binary_options WHERE session_id=?1 AND status!='OPEN') AS bin_pnl,
      (SELECT COALESCE(SUM(amount),0) FROM binary_options WHERE session_id=?1 AND status!='OPEN') AS bin_volume,
      (SELECT COALESCE(AVG(payout),0) FROM binary_options WHERE session_id=?1) AS bin_payout,
      (SELECT COUNT(*) FROM binary_options WHERE session_id=?1 AND status='OPEN') AS bin_open,
      (SELECT COUNT(*) FROM orders WHERE session_id=?1 AND status='FILLED_ALL') AS fills,
      (SELECT COUNT(*) FROM orders WHERE session_id=?1 AND realized_net IS NOT NULL) AS stock_closed,
      (SELECT COALESCE(SUM(realized_net > 0),0) FROM orders WHERE session_id=?1 AND realized_net IS NOT NULL) AS stock_wins,
      (SELECT COALESCE(SUM(realized_gross),0) FROM orders WHERE session_id=?1) AS stock_gross,
      (SELECT COALESCE(SUM(realized_net),0) FROM orders WHERE session_id=?1) AS stock_net,
      (SELECT COALESCE(SUM(fee),0) FROM orders WHERE session_id=?1) AS fees,
      (SELECT COALESCE(SUM(spread_cost),0) FROM orders WHERE session_id=?1) AS spread,
      (SELECT COALESCE(SUM(CASE WHEN slippage > 0 THEN slippage ELSE 0 END),0) FROM orders WHERE session_id=?1) AS slippage`).bind(s.id).first<Record<string, number>>();
  const k = (key: string) => r?.[key] ?? 0;
  const now = s.status === "ACTIVE" ? await balances(db) : { stock: s.end_stock ?? s.start_stock, binary: s.end_binary ?? s.start_binary };
  const start = s.start_stock + s.start_binary, end = now.stock + now.binary;
  const trades = k("bin_trades") + k("stock_closed"), wins = k("bin_wins") + k("stock_wins");
  return {
    ...s, ...r, start_total: round(start, 2), end_stock: now.stock, end_binary: now.binary, end_total: round(end, 2),
    pnl: round(k("bin_pnl") + k("stock_net"), 2), change_pct: start ? ((end - start) / start) * 100 : 0,
    trades, wins, win_rate: trades ? wins / trades : null, costs: round(k("fees") + k("spread") + k("slippage"), 2),
    duration_ms: (s.stopped_at ?? Date.now()) - s.created_at,
  };
}

export function registerSessions(app: Hono<{ Bindings: Env }>) {
  app.get("/api/sessions", async (c) => {
    const rows = await c.env.DB.prepare("SELECT * FROM sessions ORDER BY id DESC").all<SessionRow>();
    const data = [];
    for (const s of rows.results) data.push(await summarize(c.env.DB, s));
    return c.json({ ret: 0, data, active_id: rows.results.find((s) => s.status === "ACTIVE")?.id ?? null });
  });

  app.get("/api/sessions/:id", async (c) => {
    const db = c.env.DB, id = Number(c.req.param("id"));
    const s = await db.prepare("SELECT * FROM sessions WHERE id=?").bind(id).first<SessionRow>();
    if (!s) return c.json({ ret: -1, msg: "Session not found" }, 404);
    const summary = await summarize(db, s);
    const rules = await db.prepare("SELECT id, name, template, mode, code, ktype, params, amount, expiry, money_mgmt, stop_loss_pct, take_profit_pct, status, stop_reason, wins, losses, ties, pnl, loss_streak, created_at FROM rules WHERE session_id=? AND status!='DELETED' ORDER BY pnl DESC").bind(id).all();
    const curve = await db.prepare(`SELECT t, p FROM (
        SELECT expire_time AS t, profit AS p FROM binary_options WHERE session_id=?1 AND status!='OPEN'
        UNION ALL SELECT updated_time AS t, realized_net AS p FROM orders WHERE session_id=?1 AND realized_net IS NOT NULL) ORDER BY t`).bind(id).all<{ t: number; p: number }>();
    let cum = 0;
    const equity = curve.results.map((x) => [x.t, round((cum += x.p), 2)]);
    const parent = s.parent_id ? await db.prepare("SELECT * FROM sessions WHERE id=?").bind(s.parent_id).first<SessionRow>() : null;
    return c.json({ ret: 0, data: { summary, rules: rules.results, equity, parent: parent ? await summarize(db, parent) : null } });
  });

  // Aggressive mode: on → resume this session's aggressive robots; off → pause them (others keep running).
  app.post("/api/sessions/:id/aggressive", async (c) => {
    const db = c.env.DB, id = Number(c.req.param("id")), { on } = await c.req.json<{ on: boolean }>(), now = Date.now();
    const s = await db.prepare("SELECT * FROM sessions WHERE id=? AND status='ACTIVE'").bind(id).first<SessionRow>();
    if (!s) return c.json({ ret: -1, msg: "Session is not active" }, 400);
    await db.prepare("UPDATE sessions SET aggressive=? WHERE id=?").bind(on ? 1 : 0, id).run();
    const r = on
      ? await db.prepare("UPDATE rules SET status='ACTIVE', stop_reason=NULL, loss_streak=0, updated_at=? WHERE session_id=? AND aggressive=1 AND status='PAUSED' AND (stop_reason='Aggressive mode off' OR stop_reason IS NULL)").bind(now, id).run()
      : await db.prepare("UPDATE rules SET status='PAUSED', stop_reason='Aggressive mode off', updated_at=? WHERE session_id=? AND aggressive=1 AND status='ACTIVE'").bind(now, id).run();
    await audit(db, "admin", on ? "AGGRESSIVE_ON" : "AGGRESSIVE_OFF", { session_id: id, robots: r.meta.changes });
    return c.json({ ret: 0, changed: r.meta.changes });
  });

  app.post("/api/sessions/:id/stop", async (c) => {
    const db = c.env.DB, id = Number(c.req.param("id"));
    const done = await stopSession(db, id);
    return done ? c.json({ ret: 0 }) : c.json({ ret: -1, msg: "Session is not active" }, 400);
  });

  app.post("/api/sessions", async (c) => {
    const db = c.env.DB, now = Date.now();
    const b = await c.req.json<{ name?: string; ref_id?: number | null; copy_rule_ids?: number[]; deposit_usd?: number | null; notes?: string }>();
    const prev = await activeSession(db);
    if (prev) await stopSession(db, prev.id);
    if (b.deposit_usd != null) {
      const dep = round(Number(b.deposit_usd), 2);
      if (!(dep >= 1 && dep <= 10_000_000)) return c.json({ ret: -1, msg: "Deposit must be between 1 and 10,000,000" }, 400);
      // A fresh deposit starts both accounts clean; positions from the previous session are closed out of the books.
      await db.batch([
        db.prepare("UPDATE accounts SET cash=?, initial=?").bind(dep, dep),
        db.prepare("DELETE FROM positions"),
      ]);
    }
    const bal = await balances(db);
    const count = await db.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>();
    const name = (b.name ?? "").trim().slice(0, 60) || `Session ${count!.n + 1}`;
    const s = await db.prepare("INSERT INTO sessions (name, status, parent_id, start_stock, start_binary, notes, created_at) VALUES (?, 'ACTIVE', ?, ?, ?, ?, ?) RETURNING *")
      .bind(name, b.ref_id ?? null, bal.stock, bal.binary, (b.notes ?? "").slice(0, 500) || null, now).first<SessionRow>();
    let copied = 0;
    if (b.ref_id && b.copy_rule_ids?.length) {
      const src = await db.prepare(`SELECT * FROM rules WHERE session_id=? AND id IN (${b.copy_rule_ids.map(() => "?").join(",")})`).bind(b.ref_id, ...b.copy_rule_ids).all<any>();
      for (const r of src.results) {
        const ms = (KTYPES[r.ktype] ?? 60) * 1000;
        await db.prepare(`INSERT INTO rules (name, template, mode, code, ktype, params, amount, expiry, money_mgmt, stop_loss_pct, take_profit_pct, status, cur_stake, last_bar, created_at, updated_at, session_id, aggressive)
            VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(r.name, r.template, r.mode, r.code, r.ktype, r.params, r.amount, r.expiry, r.money_mgmt, r.stop_loss_pct, r.take_profit_pct,
            r.aggressive ? "PAUSED" : "ACTIVE", r.amount, Math.floor(now / ms) * ms - ms, now, now, s!.id, r.aggressive ?? 0).run();
        copied++;
      }
    }
    await audit(db, "admin", "SESSION_STARTED", { session_id: s!.id, name, ref_id: b.ref_id ?? null, copied_rules: copied, deposit_usd: b.deposit_usd ?? "carried over", start_stock: bal.stock, start_binary: bal.binary });
    return c.json({ ret: 0, data: { ...s, copied } });
  });
}

/** Stops a session: its rules are paused and open no new trades; trades already open still settle. */
export async function stopSession(db: D1Database, id: number): Promise<boolean> {
  const s = await db.prepare("SELECT * FROM sessions WHERE id=? AND status='ACTIVE'").bind(id).first<SessionRow>();
  if (!s) return false;
  const bal = await balances(db), now = Date.now();
  await audit(db, "admin", "SESSION_STOPPED", { session_id: id, name: s.name, end_stock: bal.stock, end_binary: bal.binary });
  await db.batch([
    db.prepare("UPDATE sessions SET status='STOPPED', stopped_at=?, end_stock=?, end_binary=? WHERE id=?").bind(now, bal.stock, bal.binary, id),
    db.prepare("UPDATE rules SET status='PAUSED', stop_reason='Session stopped — open trades will still settle', updated_at=? WHERE session_id=? AND status='ACTIVE'").bind(now, id),
  ]);
  return true;
}
