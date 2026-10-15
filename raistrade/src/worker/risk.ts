// Server-side risk gate: evaluates the user's ACTIVE guards (at most once a minute per isolate) and
// answers "may a NEW trade open on this instrument?". Exits are never blocked.

import type { Hono } from "hono";
import { COMBO_BY_ID, DETECTOR_BY_ID, evaluateGuard, riskSnapshot, type GuardConfig, type RiskContext } from "../shared/risk";
import { ACTIVE_SESSION, audit } from "./engine";

type Env = { DB: D1Database };
interface GuardRow { id: number; combo_id: string; name: string; config: string; status: string; tripped_until: number | null; blocked: string | null; last_reason: string | null; last_trip: number | null; trips: number }

export interface Gate { blockedBy: (code: string) => string | null; halts: { id: number; name: string; until: number; codes: string[]; reason: string }[] }

let cache: { minute: number; gate: Gate } | null = null;
export const invalidateGate = () => { cache = null; };

async function context(db: D1Database): Promise<RiskContext> {
  const s = await db.prepare(`SELECT start_stock + start_binary AS start FROM sessions WHERE id = ${ACTIVE_SESSION}`).first<{ start: number }>();
  const acc = await db.prepare("SELECT SUM(cash) AS cash FROM accounts").first<{ cash: number }>();
  const open = await db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM binary_options WHERE status='OPEN'").first<{ v: number }>();
  const stopped = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE event='AUTO_STOP' AND ts > ?").bind(Date.now() - 30 * 60_000).first<{ n: number }>();
  const equity = (acc?.cash ?? 0) + (open?.v ?? 0);
  return { accountDDPct: s?.start ? Math.max(0, ((s.start - equity) / s.start) * 100) : 0, robotsStopped30m: stopped?.n ?? 0 };
}

/** Evaluates guards, records TRIP/CLEAR transitions, and returns the gate for this minute. */
export async function riskGate(db: D1Database, now = Date.now()): Promise<Gate> {
  const minute = Math.floor(now / 60_000);
  if (cache && cache.minute === minute) return cache.gate;
  const guards = (await db.prepare("SELECT * FROM risk_guards WHERE status='ACTIVE'").all<GuardRow>()).results;
  const halts: Gate["halts"] = [];
  if (guards.length) {
    const snap = riskSnapshot(now), ctx = await context(db);
    for (const g of guards) {
      const cfg = JSON.parse(g.config) as GuardConfig;
      const r = evaluateGuard(cfg, snap, ctx);
      const wasTripped = (g.tripped_until ?? 0) > now;
      if (r.hits.length) {
        const until = now + cfg.cooldownMin * 60_000, reason = r.hits.slice(0, 4).map((h) => h.text).join("; ");
        const codes = [...new Set([...(wasTripped && g.blocked ? (JSON.parse(g.blocked) as string[]) : []), ...r.blocked])];
        await db.prepare("UPDATE risk_guards SET tripped_until=?, blocked=?, last_reason=?, last_trip=?, trips=trips + ? WHERE id=?")
          .bind(until, JSON.stringify(codes), reason, now, wasTripped ? 0 : 1, g.id).run();
        if (!wasTripped) {
          await db.prepare(`INSERT INTO risk_events (guard_id, ts, kind, detail, session_id) VALUES (?, ?, 'TRIP', ?, ${ACTIVE_SESSION})`).bind(g.id, now, JSON.stringify({ reason, codes, hits: r.hits.slice(0, 10) })).run();
          await audit(db, "system", "RISK_HALT", `${g.name}: ${reason} — new trades blocked for ${cfg.cooldownMin} min after it clears`);
        }
        halts.push({ id: g.id, name: g.name, until, codes, reason });
      } else if (wasTripped) {
        halts.push({ id: g.id, name: g.name, until: g.tripped_until!, codes: JSON.parse(g.blocked ?? "[]"), reason: `cooling down — ${g.last_reason ?? ""}` });
      } else if (g.tripped_until && g.tripped_until <= now && g.blocked) {
        await db.prepare("UPDATE risk_guards SET blocked=NULL WHERE id=?").bind(g.id).run();
        await db.prepare(`INSERT INTO risk_events (guard_id, ts, kind, detail, session_id) VALUES (?, ?, 'CLEAR', ?, ${ACTIVE_SESSION})`).bind(g.id, now, "risk cleared and cool-down finished").run();
        await audit(db, "system", "RISK_CLEAR", `${g.name}: trading resumed`);
      }
    }
  }
  const gate: Gate = {
    halts,
    blockedBy: (code) => { const h = halts.find((x) => x.codes.includes(code)); return h ? `${h.name} (until ${new Date(h.until).toISOString().slice(11, 16)} UTC): ${h.reason}` : null; },
  };
  cache = { minute, gate };
  return gate;
}

export function registerRisk(app: Hono<{ Bindings: Env }>) {
  app.get("/api/risk", async (c) => {
    const db = c.env.DB, gate = await riskGate(db);
    const guards = (await db.prepare("SELECT * FROM risk_guards ORDER BY id DESC").all<GuardRow>()).results;
    const events = (await db.prepare("SELECT e.*, g.name AS guard_name FROM risk_events e LEFT JOIN risk_guards g ON g.id=e.guard_id ORDER BY e.id DESC LIMIT 100").all()).results;
    return c.json({ ret: 0, data: { guards, events, halts: gate.halts, context: await context(db), server_time: Date.now() } });
  });
  app.post("/api/risk/guards", async (c) => {
    const db = c.env.DB, b = await c.req.json<{ combo_id: string; cooldownMin?: number; scope?: string; detectors?: { id: string; k: number }[] }>();
    const combo = COMBO_BY_ID[b.combo_id];
    if (!combo) return c.json({ ret: -1, msg: "Unknown combo" }, 400);
    const dets = (b.detectors ?? combo.detectors).filter((d) => DETECTOR_BY_ID[d.id] && Number.isFinite(Number(d.k)));
    const cfg: GuardConfig = { scope: (b.scope as GuardConfig["scope"]) ?? combo.scope, perAsset: combo.perAsset, detectors: dets, cooldownMin: Math.max(1, Math.min(1440, Number(b.cooldownMin ?? combo.cooldownMin))) };
    const dup = await db.prepare("SELECT id FROM risk_guards WHERE combo_id=? AND status='ACTIVE'").bind(combo.id).first();
    if (dup) return c.json({ ret: -1, msg: `${combo.name} is already running` }, 409);
    const row = await db.prepare("INSERT INTO risk_guards (combo_id, name, config, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?) RETURNING *")
      .bind(combo.id, combo.name, JSON.stringify(cfg), Date.now()).first();
    await audit(db, "admin", "RISK_GUARD_ON", { name: combo.name, ...cfg });
    invalidateGate();
    return c.json({ ret: 0, data: row });
  });
  app.patch("/api/risk/guards/:id", async (c) => {
    const db = c.env.DB, id = Number(c.req.param("id")), { action } = await c.req.json<{ action: "on" | "off" | "drill" | "clear" }>();
    const g = await db.prepare("SELECT * FROM risk_guards WHERE id=?").bind(id).first<GuardRow>();
    if (!g) return c.json({ ret: -1, msg: "Guard not found" }, 404);
    const now = Date.now(), cfg = JSON.parse(g.config) as GuardConfig;
    if (action === "on" || action === "off") await db.prepare("UPDATE risk_guards SET status=? WHERE id=?").bind(action === "on" ? "ACTIVE" : "OFF", id).run();
    if (action === "drill") {
      // Fire drill: trip the guard for its cool-down so you can see trading halt.
      const codes = (await import("../shared/risk")).codesIn(cfg.scope);
      await db.prepare("UPDATE risk_guards SET status='ACTIVE', tripped_until=?, blocked=?, last_reason=?, last_trip=?, trips=trips+1 WHERE id=?")
        .bind(now + cfg.cooldownMin * 60_000, JSON.stringify(codes), "Drill (manual test)", now, id).run();
      await db.prepare(`INSERT INTO risk_events (guard_id, ts, kind, detail, session_id) VALUES (?, ?, 'DRILL', ?, ${ACTIVE_SESSION})`).bind(id, now, `manual drill — ${codes.length} instruments blocked for ${cfg.cooldownMin} min`).run();
    }
    if (action === "clear") {
      await db.prepare("UPDATE risk_guards SET tripped_until=NULL, blocked=NULL WHERE id=?").bind(id).run();
      await db.prepare(`INSERT INTO risk_events (guard_id, ts, kind, detail, session_id) VALUES (?, ?, 'CLEAR', 'cleared manually', ${ACTIVE_SESSION})`).bind(id, now).run();
    }
    await audit(db, "admin", `RISK_GUARD_${action.toUpperCase()}`, g.name);
    invalidateGate();
    return c.json({ ret: 0 });
  });
  app.delete("/api/risk/guards/:id", async (c) => {
    await c.env.DB.prepare("DELETE FROM risk_guards WHERE id=?").bind(Number(c.req.param("id"))).run();
    invalidateGate();
    return c.json({ ret: 0 });
  });
}
