import { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import { BY_CODE } from "../shared/market";
import { MAX_BOT_EXPOSURE, MAX_LOSS_STREAK, TEMPLATE_BY_ID } from "../shared/strategies";
import { groupOfCode, RISK_GROUPS } from "../shared/risk";
import { api, money } from "./api";
import { chartColors, useTheme } from "./theme";
import type { Rule } from "./AutoTrade";

// Comprehensive auto-trade summary for the active session: performance vs break-even, exposure,
// drawdown, hourly P/L, breakdowns by market and strategy, and warnings that need attention.

interface Trade { id: number; rule_id: number; rule_name: string; code: string; kind: string; side: string; qty: number; status: string; pnl: number | null; opened_at: number; closed_at: number | null }

const pct = (x: number | null, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const sgn = (v: number) => `${v >= 0 ? "+" : ""}${money(v)}`;

function HourlyBars({ trades }: { trades: Trade[] }) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const data = useMemo(() => {
    const h = 3600_000, now = Math.floor(Date.now() / h) * h, buckets = new Map<number, number>();
    for (let i = 23; i >= 0; i--) buckets.set(now - i * h, 0);
    for (const t of trades) if (t.closed_at && t.pnl != null) { const k = Math.floor(t.closed_at / h) * h; if (buckets.has(k)) buckets.set(k, buckets.get(k)! + t.pnl); }
    return [...buckets].map(([x, y]) => ({ x, y: +y.toFixed(2) }));
  }, [trades]);
  useEffect(() => {
    const C = chartColors();
    const ch = Highcharts.chart(el.current!, {
      chart: { type: "column", backgroundColor: "transparent", height: 150, spacing: [6, 2, 2, 2] }, title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
      time: { useUTC: false } as Highcharts.TimeOptions,
      xAxis: { type: "datetime", lineColor: C.axis, labels: { style: { color: C.label, fontSize: "10px" } } },
      yAxis: { title: { text: undefined }, gridLineColor: C.grid, labels: { style: { color: C.label, fontSize: "10px" }, formatter: function () { return money(Number(this.value)); } }, plotLines: [{ value: 0, color: C.axis, width: 1 }] },
      tooltip: { backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg }, xDateFormat: "%H:00", pointFormatter: function (this: Highcharts.Point) { return `P/L <b>${money(this.y ?? 0)}</b>`; } },
      plotOptions: { column: { borderWidth: 0, borderRadius: 2, color: C.up, negativeColor: C.down, threshold: 0 } },
      series: [{ type: "column", name: "P/L", data }],
    });
    return () => ch.destroy();
  }, [data, theme]);
  return <div ref={el} />;
}

function Kpi({ l, v, sub, cls, title }: { l: string; v: React.ReactNode; sub?: React.ReactNode; cls?: string; title?: string }) {
  return <div className="col-6 col-md-3 col-xxl"><div className="kpi h-100" title={title}><div className="kpi-l">{l}</div><div className={`kpi-v ${cls ?? ""}`} style={{ fontSize: "1.15rem" }}>{v}</div>{sub && <div className="text-secondary" style={{ fontSize: ".7rem" }}>{sub}</div>}</div></div>;
}

export function AutoSummary({ rules }: { rules: Rule[] }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [acc, setAcc] = useState<any>(null);
  const [halts, setHalts] = useState<any[]>([]);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("rt.summaryOpen") !== "0"; } catch { return true; } });
  useEffect(() => {
    const load = () => {
      api("/api/trades/all").then((r) => setTrades(r.data)).catch(() => {});
      api("/api/trd/accinfo").then(setAcc).catch(() => {});
      api("/api/risk").then((r) => setHalts(r.data.halts)).catch(() => {});
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);
  const toggle = () => setOpen((o) => { try { localStorage.setItem("rt.summaryOpen", o ? "0" : "1"); } catch { /* ignore */ } return !o; });

  const s = useMemo(() => {
    const closed = trades.filter((t) => t.status === "WON" || t.status === "LOST");
    const wins = closed.filter((t) => t.status === "WON").length, n = closed.length;
    const now = Date.now(), inLast = (ms: number) => closed.filter((t) => (t.closed_at ?? 0) >= now - ms).reduce((a, t) => a + (t.pnl ?? 0), 0);
    const bin = closed.filter((t) => t.kind === "BINARY");
    const be = bin.length ? bin.reduce((a, t) => a + 1 / (1 + (BY_CODE[t.code]?.payout ?? 0.85)), 0) / bin.length : null;
    const sorted = [...closed].sort((a, b) => (a.closed_at ?? 0) - (b.closed_at ?? 0));
    let cum = 0, peak = 0, mdd = 0;
    for (const t of sorted) { cum += t.pnl ?? 0; peak = Math.max(peak, cum); mdd = Math.max(mdd, peak - cum); }
    const by = <K extends string>(key: (t: Trade) => K) => {
      const m = new Map<K, { n: number; w: number; pnl: number }>();
      for (const t of closed) { const k = key(t), x = m.get(k) ?? { n: 0, w: 0, pnl: 0 }; x.n++; x.w += t.status === "WON" ? 1 : 0; x.pnl += t.pnl ?? 0; m.set(k, x); }
      return [...m].sort((a, b) => b[1].pnl - a[1].pnl);
    };
    const tplOf = (t: Trade) => TEMPLATE_BY_ID[rules.find((r) => r.id === t.rule_id)?.template ?? ""]?.name ?? "Other";
    const openStake = trades.filter((t) => t.status === "OPEN" && t.kind === "BINARY").reduce((a, t) => a + t.qty, 0);
    const equity = acc ? acc.binary.balance + (acc.binary.invested ?? 0) : null;
    const pnl = rules.reduce((a, r) => a + r.pnl, 0);
    const ranked = [...rules].filter((r) => r.wins + r.losses > 0).sort((a, b) => b.pnl - a.pnl);
    return {
      n, wins, rate: n ? wins / n : null, be, pnl, h1: inLast(3600_000), h24: inLast(86_400_000), mdd,
      exp: n ? closed.reduce((a, t) => a + (t.pnl ?? 0), 0) / n : null, avgWin: wins ? closed.filter((t) => t.status === "WON").reduce((a, t) => a + (t.pnl ?? 0), 0) / wins : 0,
      avgLoss: n - wins ? -closed.filter((t) => t.status === "LOST").reduce((a, t) => a + (t.pnl ?? 0), 0) / (n - wins) : 0,
      openN: trades.filter((t) => t.status === "OPEN").length, openStake, equity, expoPct: equity ? openStake / equity : 0,
      best: ranked[0], worst: ranked.at(-1), byMarket: by((t) => groupOfCode(t.code)), byStrat: by(tplOf),
      perHour: n && sorted.length > 1 ? n / Math.max(1, ((sorted.at(-1)!.closed_at ?? 0) - (sorted[0]!.closed_at ?? 0)) / 3600_000) : null,
    };
  }, [trades, rules, acc]);

  const counts = { act: rules.filter((r) => r.status === "ACTIVE").length, pau: rules.filter((r) => r.status === "PAUSED").length, stp: rules.filter((r) => r.status === "STOPPED").length };
  const warnings: { lvl: "bad" | "mid"; text: string }[] = [];
  for (const h of halts) warnings.push({ lvl: "bad", text: `⛔ Risk guard "${h.name}" is blocking new trades on ${h.codes.length} market(s) — ${h.reason}` });
  const nearStop = rules.filter((r) => r.status === "ACTIVE" && (r.loss_streak ?? 0) >= MAX_LOSS_STREAK - 1);
  if (nearStop.length) warnings.push({ lvl: "mid", text: `🔥 ${nearStop.length} robot(s) one loss away from auto-stop: ${nearStop.slice(0, 4).map((r) => r.name).join(", ")}` });
  const losing = rules.filter((r) => { const n = r.wins + r.losses; if (r.mode !== "BINARY" || n < 20) return false; const be = 1 / (1 + BY_CODE[r.code]!.payout), p = r.wins / n; return p + 1.96 * Math.sqrt((p * (1 - p)) / n) < be; });
  if (losing.length) warnings.push({ lvl: "bad", text: `📉 ${losing.length} robot(s) proven below break-even (20+ trades): ${losing.slice(0, 4).map((r) => r.name).join(", ")} — consider stopping them` });
  const broke = rules.filter((r) => r.status === "PAUSED" && /balance/i.test(r.stop_reason ?? ""));
  if (broke.length) warnings.push({ lvl: "bad", text: `💸 ${broke.length} robot(s) paused for insufficient balance` });
  if (s.expoPct > MAX_BOT_EXPOSURE * 0.8) warnings.push({ lvl: "mid", text: `⚖ Open stakes are ${pct(s.expoPct)} of the balance — near the ${MAX_BOT_EXPOSURE * 100}% cap, new signals may be skipped` });
  if (s.rate != null && s.be != null && s.n >= 30 && s.rate < s.be) warnings.push({ lvl: "bad", text: `Overall win rate ${pct(s.rate)} is below the ${pct(s.be)} break-even over ${s.n} trades` });
  const untested = rules.filter((r) => r.status === "ACTIVE" && r.wins + r.losses < 10).length;
  if (untested) warnings.push({ lvl: "mid", text: `⏳ ${untested} robot(s) have fewer than 10 trades — too early to judge` });

  return (
    <div className="panel p-3 mb-3 auto-summary">
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="step-title mb-0">📊 Auto-trade summary · this session</div>
        <span className="small text-secondary">{s.n} closed trades{s.perHour ? ` · ~${s.perHour.toFixed(1)}/hour` : ""}{s.openN ? ` · ${s.openN} open now` : ""}</span>
        <button className="btn btn-sm btn-outline-secondary ms-auto py-0" onClick={toggle}>{open ? "Hide details" : "Show details"}</button>
      </div>
      <div className="row g-2">
        <Kpi l="Robots" v={<>{counts.act} <span className="text-secondary fs-6">running</span></>} sub={`${counts.pau} paused · ${counts.stp} auto-stopped · ${rules.length} total`} />
        <Kpi l="Net P/L" v={sgn(s.pnl)} cls={s.pnl >= 0 ? "text-up" : "text-down"} sub={<>last hour <span className={s.h1 >= 0 ? "text-up" : "text-down"}>{sgn(s.h1)}</span> · 24h <span className={s.h24 >= 0 ? "text-up" : "text-down"}>{sgn(s.h24)}</span></>} />
        <Kpi l="Win rate" v={pct(s.rate)} cls={s.rate != null && s.be != null ? (s.rate >= s.be ? "text-up" : "text-down") : ""} sub={s.be != null ? `needs ${pct(s.be)} to break even · ${s.wins}W/${s.n - s.wins}L` : `${s.wins}W/${s.n - s.wins}L`} />
        <Kpi l="Expected per trade" v={s.exp == null ? "—" : sgn(s.exp)} cls={s.exp == null ? "" : s.exp >= 0 ? "text-up" : "text-down"} sub={`avg win ${money(s.avgWin)} · avg loss ${money(s.avgLoss)}`} title="Average result of a closed trade, after costs" />
        <Kpi l="Open exposure" v={money(s.openStake)} cls={s.expoPct > MAX_BOT_EXPOSURE * 0.8 ? "text-warning" : ""} sub={s.equity ? `${pct(s.expoPct)} of balance · cap ${MAX_BOT_EXPOSURE * 100}%` : ""} />
        <Kpi l="Max drawdown" v={s.mdd ? `−${money(s.mdd)}` : "—"} cls={s.mdd ? "text-down" : ""} sub="worst peak-to-trough of the P/L curve" />
      </div>
      {warnings.length > 0 && <div className="d-flex flex-column gap-1 mt-2">{warnings.map((w) => <div key={w.text} className={`fee-check ${w.lvl}`}>{w.text}</div>)}</div>}
      {open && (
        <div className="row g-3 mt-1">
          <div className="col-xl-5">
            <div className="small text-secondary mb-1">P/L per hour · last 24 h</div>
            <HourlyBars trades={trades} />
            <div className="d-flex gap-3 small mt-1">
              {s.best && <span>🏆 Best: <b>{s.best.name}</b> <span className="text-up">{sgn(s.best.pnl)}</span></span>}
              {s.worst && s.worst !== s.best && <span>🐢 Worst: <b>{s.worst.name}</b> <span className={s.worst.pnl >= 0 ? "text-up" : "text-down"}>{sgn(s.worst.pnl)}</span></span>}
            </div>
          </div>
          {[["By market", s.byMarket.map(([k, v]) => [`${RISK_GROUPS.find((g) => g.id === k)?.icon ?? ""} ${RISK_GROUPS.find((g) => g.id === k)?.label ?? k}`, v] as const)],
            ["By strategy", s.byStrat.map(([k, v]) => [k, v] as const)]].map(([title, rows]) => (
            <div className="col-md-6 col-xl" key={title as string}>
              <div className="small text-secondary mb-1">{title as string}</div>
              <table className="table table-sm small-table tabular mb-0">
                <thead><tr><th /><th className="text-end">Trades</th><th className="text-end">Win</th><th className="text-end">P/L</th></tr></thead>
                <tbody>
                  {(rows as (readonly [string, { n: number; w: number; pnl: number }])[]).slice(0, 7).map(([k, v]) => (
                    <tr key={k}><td className="text-truncate" style={{ maxWidth: 170 }}>{k}</td><td className="text-end">{v.n}</td><td className="text-end">{pct(v.w / v.n, 0)}</td>
                      <td className={`text-end ${v.pnl >= 0 ? "text-up" : "text-down"}`}>{money(v.pnl)}</td></tr>
                  ))}
                  {!(rows as unknown[]).length && <tr><td colSpan={4} className="text-center text-secondary py-2">No closed trades yet</td></tr>}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
