import { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import {
  COMBOS, COMBO_BY_ID, DETECTORS, DETECTOR_BY_ID, RISK_GROUPS, type Combo, type GuardConfig, type RiskGroup, codesIn, evaluateGuard, riskSnapshot,
} from "../shared/risk";
import { priceAt } from "../shared/market";
import { api } from "./api";
import { chartColors, useTheme } from "./theme";
import { toast } from "./toast";

interface Guard { id: number; combo_id: string; name: string; config: string; status: string; tripped_until: number | null; blocked: string | null; last_reason: string | null; last_trip: number | null; trips: number }
interface RiskData { guards: Guard[]; events: any[]; halts: { id: number; name: string; until: number; codes: string[]; reason: string }[]; context: { accountDDPct: number; robotsStopped30m: number } }

const t = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const left = (ms: number) => { const m = Math.max(0, Math.round((ms - Date.now()) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };

function useRisk() {
  const [d, setD] = useState<RiskData | null>(null);
  const load = () => api("/api/risk").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 10_000); return () => clearInterval(i); }, []);
  return { d, load };
}

/** 24h equal-weight index of a market group with markers where a combo would have tripped. */
function AnomalyChart({ group, combo }: { group: RiskGroup; combo: Combo }) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const data = useMemo(() => {
    const codes = codesIn(group), now = Math.floor(Date.now() / 900_000) * 900_000, idx: [number, number][] = [], flags: any[] = [];
    const base = Object.fromEntries(codes.map((c) => [c, priceAt(c, now - 96 * 900_000)]));
    const cfg: GuardConfig = { ...combo, scope: group };
    for (let i = 96; i >= 0; i--) {
      const ts = now - i * 900_000;
      const v = (codes.reduce((s, c) => s + priceAt(c, ts) / base[c]!, 0) / codes.length - 1) * 100;
      idx.push([ts, +v.toFixed(3)]);
      const r = evaluateGuard(cfg, riskSnapshot(ts, codes));
      if (r.hits.length) flags.push({ x: ts, y: +v.toFixed(3), name: r.hits.map((h) => h.text).join("<br/>") });
    }
    return { idx, flags };
  }, [group, combo.id]);
  useEffect(() => {
    const C = chartColors();
    const ch = Highcharts.chart(el.current!, {
      chart: { backgroundColor: "transparent", height: 230, spacing: [8, 4, 4, 4] }, title: { text: undefined }, credits: { enabled: false },
      legend: { enabled: true, itemStyle: { color: C.label, fontWeight: "500" } }, time: { useUTC: false } as Highcharts.TimeOptions,
      xAxis: { type: "datetime", lineColor: C.axis, labels: { style: { color: C.label } } },
      yAxis: { title: { text: undefined }, gridLineColor: C.grid, labels: { format: "{value}%", style: { color: C.label } }, plotLines: [{ value: 0, color: C.axis, width: 1 }] },
      tooltip: { backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg }, xDateFormat: "%b %e %H:%M", valueDecimals: 2, valueSuffix: "%" },
      series: [
        { type: "line", name: `${RISK_GROUPS.find((g) => g.id === group)!.label} index (24h)`, data: data.idx, color: C.accent, lineWidth: 2, marker: { enabled: false } },
        { type: "scatter", name: `${combo.name} would trip`, data: data.flags, color: C.down, marker: { symbol: "triangle-down", radius: 7 },
          tooltip: { pointFormat: "<b>{point.name}</b>" } },
      ] as any,
    });
    return () => ch.destroy();
  }, [data, theme]);
  return <div><div ref={el} /><div className="small text-secondary">{data.flags.length ? `${data.flags.length} anomaly point${data.flags.length > 1 ? "s" : ""} in the last 24 h — new trades would have been blocked there.` : "No anomalies in the last 24 h for this combo."}</div></div>;
}

function MarketBoard({ snapAt }: { snapAt: number }) {
  const snap = useMemo(() => riskSnapshot(snapAt), [snapAt]);
  const cfg = COMBO_BY_ID.max_protect!;
  return (
    <div className="row g-2">
      {RISK_GROUPS.filter((g) => g.id !== "ALL").map((g) => {
        const codes = codesIn(g.id), xs = codes.map((c) => snap.assets[c]!);
        const r = evaluateGuard({ ...cfg, scope: g.id }, snap);
        const worst = xs.reduce((a, b) => (b.r60 / b.sigma < a.r60 / a.sigma ? b : a));
        const vol = Math.max(...xs.map((a) => a.volRatio));
        const lvl = r.hits.length ? "bad" : vol > 1.8 || worst.r60 < -2 * worst.sigma ? "mid" : "good";
        return (
          <div className="col-sm-6 col-lg-4 col-xxl" key={g.id}>
            <div className={`risk-card ${lvl}`}>
              <div className="d-flex align-items-center gap-2 mb-1"><span>{g.icon}</span><b>{g.label}</b>
                <span className="ms-auto small fw-semibold">{lvl === "bad" ? "⚠ ANOMALY" : lvl === "mid" ? "Elevated" : "Normal"}</span></div>
              <div className="small d-flex justify-content-between"><span className="text-secondary">Worst 1h</span><span className={worst.r60 < 0 ? "text-down" : "text-up"}>{worst.code.split(".")[1]} {worst.r60.toFixed(2)}%</span></div>
              <div className="small d-flex justify-content-between"><span className="text-secondary">Peak volatility</span><span>{vol.toFixed(1)}× normal</span></div>
              {r.hits.slice(0, 2).map((h) => <div key={h.text} className="small text-down text-truncate">• {h.text}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function backtest7d(c: Combo) {
  let trips = 0, haltedSteps = 0, until = 0;
  const now = Date.now();
  for (let i = 672; i >= 0; i--) {
    const ts = now - i * 900_000, r = evaluateGuard(c, riskSnapshot(ts, codesIn(c.scope)));
    if (r.hits.length) { if (ts >= until) trips++; until = ts + c.cooldownMin * 60_000 + 900_000; }
    if (ts < until) haltedSteps++;
  }
  return { trips, haltedPct: (haltedSteps / 673) * 100 };
}

export function Risk() {
  const { d, load } = useRisk();
  const [tick, setTick] = useState(Math.floor(Date.now() / 30_000));
  useEffect(() => { const i = setInterval(() => setTick(Math.floor(Date.now() / 30_000)), 5000); return () => clearInterval(i); }, []);
  const [chartGroup, setChartGroup] = useState<RiskGroup>("CRYPTO");
  const [chartCombo, setChartCombo] = useState("max_protect");
  const [bt, setBt] = useState<Record<string, { trips: number; haltedPct: number }>>({});
  const running = new Map((d?.guards ?? []).filter((g) => g.status === "ACTIVE").map((g) => [g.combo_id, g]));

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.ok(ok); load(); } catch (e) { toast.err((e as Error).message); } };
  const run = (c: Combo) => act(() => api("/api/risk/guards", { body: { combo_id: c.id } }), `${c.name} is now guarding your bots`);
  const halted = d?.halts ?? [];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div><h2 className="h4 fw-bold mb-1">🛡 Risk indicator</h2>
          <div className="small text-secondary">Watches the market for crash and panic patterns. When a guard trips, <b>no new trades open</b> in its markets until the risk has passed — exits and stop-losses still run.</div></div>
      </div>

      <div className={`risk-banner ${halted.length ? "bad" : "good"} mb-3`}>
        {halted.length ? (
          <>
            <div className="fw-bold fs-6">⛔ New trading halted by {halted.length} guard{halted.length > 1 ? "s" : ""}</div>
            {halted.map((h) => <div key={h.id} className="small">{h.name} — {h.codes.length} market{h.codes.length > 1 ? "s" : ""} blocked, {left(h.until)} left · {h.reason}</div>)}
          </>
        ) : (
          <div className="fw-bold">🟢 All clear — {running.size ? `${running.size} guard${running.size > 1 ? "s" : ""} watching` : "no guards running yet; pick a combo below"}{d ? ` · session drawdown ${d.context.accountDDPct.toFixed(1)}% · ${d.context.robotsStopped30m} robots auto-stopped in 30 min` : ""}</div>
        )}
      </div>

      <div className="step-title">Market risk right now</div>
      <MarketBoard snapAt={tick * 30_000} />

      <div className="panel p-3 my-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <div className="step-title mb-0">Anomaly pattern (last 24 h)</div>
          <div className="seg seg-sm ms-auto">{RISK_GROUPS.filter((g) => g.id !== "ALL").map((g) => <button key={g.id} className={chartGroup === g.id ? "active" : ""} onClick={() => setChartGroup(g.id)}>{g.icon} {g.label}</button>)}</div>
          <select className="form-select form-select-sm w-auto" value={chartCombo} onChange={(e) => setChartCombo(e.target.value)}>
            {COMBOS.filter((c) => !DETECTORS.filter((x) => x.kind === "account").some((x) => c.detectors.length === 1 && c.detectors[0]!.id === x.id)).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <AnomalyChart group={chartGroup} combo={COMBO_BY_ID[chartCombo]!} />
      </div>

      <div className="step-title">1 · Detector templates</div>
      <div className="row g-2 mb-3">
        {DETECTORS.map((x) => (
          <div className="col-sm-6 col-lg-4 col-xxl-3" key={x.id}>
            <div className="tpl-card h-100" style={{ cursor: "default" }}>
              <div className="d-flex align-items-center gap-2 mb-1"><span className="tpl-icon">{x.icon}</span><b>{x.name}</b></div>
              <div className="small text-secondary">{x.desc}</div>
              <div className="small mt-1"><span className="badge text-bg-secondary">default k = {x.param.def}{x.param.unit}</span> <span className="badge text-bg-info">{x.kind === "asset" ? "per market" : x.kind === "group" ? "market-wide" : "your account"}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="step-title">2 · Guard combos — choose what to protect against</div>
      <div className="row g-2 mb-3">
        {COMBOS.map((c) => {
          const g = running.get(c.id), b = bt[c.id];
          return (
            <div className="col-md-6 col-xxl-4" key={c.id}>
              <div className={`panel p-3 h-100 d-flex flex-column ${g ? "risk-running" : ""}`}>
                <div className="d-flex align-items-start gap-2 mb-1">
                  <span className="tpl-icon">{c.icon}</span>
                  <div className="flex-grow-1"><div className="fw-semibold">{c.name}</div><div className="text-secondary" style={{ fontSize: ".72rem" }}>Scenario: {c.scenario} · {RISK_GROUPS.find((x) => x.id === c.scope)!.label} · {c.perAsset ? "blocks only the affected market" : "blocks the whole scope"} · cool-down {c.cooldownMin} min</div></div>
                  {g && <span className="badge text-bg-success">running</span>}
                </div>
                <div className="small text-secondary mb-2">{c.desc}</div>
                <div className="d-flex flex-wrap gap-1 mb-2">{c.detectors.map((x) => <span key={x.id} className="chip" style={{ cursor: "default" }}>{DETECTOR_BY_ID[x.id]!.icon} {DETECTOR_BY_ID[x.id]!.name} · {x.k}{DETECTOR_BY_ID[x.id]!.param.unit}</span>)}</div>
                {b && <div className="small mb-2">Last 7 days: would have tripped <b>{b.trips}×</b>, blocking new trades <b>{b.haltedPct.toFixed(1)}%</b> of the time.</div>}
                <div className="d-flex gap-2 mt-auto">
                  {!g ? <button className="btn btn-sm btn-accent" onClick={() => run(c)}>▶ Run this combo</button>
                    : <button className="btn btn-sm btn-outline-secondary" onClick={() => act(() => api(`/api/risk/guards/${g.id}`, { method: "PATCH", body: { action: "off" } }), `${c.name} turned off`)}>Turn off</button>}
                  {!DETECTORS.some((x) => x.kind === "account" && c.detectors.every((y) => y.id === x.id)) && !b &&
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setBt((s) => ({ ...s, [c.id]: backtest7d(c) }))}>📊 Check last 7 days</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="step-title">3 · My running guards</div>
      <div className="panel table-responsive mb-3">
        <table className="table table-sm small-table tabular mb-0 align-middle">
          <thead><tr><th>Guard</th><th>Scope</th><th>Detectors</th><th>State</th><th className="text-end">Trips</th><th>Last trigger</th><th /></tr></thead>
          <tbody>
            {(d?.guards ?? []).map((g) => {
              const cfg = JSON.parse(g.config) as GuardConfig, tripped = (g.tripped_until ?? 0) > Date.now();
              return (
                <tr key={g.id}>
                  <td><b>{COMBO_BY_ID[g.combo_id]?.icon} {g.name}</b></td>
                  <td>{RISK_GROUPS.find((x) => x.id === cfg.scope)?.label}{cfg.perAsset ? " · per market" : ""}</td>
                  <td className="text-secondary">{cfg.detectors.map((x) => DETECTOR_BY_ID[x.id]?.icon).join(" ")}</td>
                  <td>{g.status !== "ACTIVE" ? <span className="badge text-bg-secondary">OFF</span> : tripped ? <span className="badge text-bg-danger">⛔ HALTED · {left(g.tripped_until!)}</span> : <span className="badge text-bg-success">● ARMED</span>}</td>
                  <td className="text-end">{g.trips}</td>
                  <td className="text-secondary text-truncate" style={{ maxWidth: 280 }} title={g.last_reason ?? ""}>{g.last_trip ? `${t(g.last_trip)} · ${g.last_reason}` : "—"}</td>
                  <td className="text-nowrap">
                    {g.status === "ACTIVE"
                      ? <button className="btn btn-sm btn-outline-secondary py-0 me-1" onClick={() => act(() => api(`/api/risk/guards/${g.id}`, { method: "PATCH", body: { action: "off" } }), "Guard off")}>Off</button>
                      : <button className="btn btn-sm btn-outline-success py-0 me-1" onClick={() => act(() => api(`/api/risk/guards/${g.id}`, { method: "PATCH", body: { action: "on" } }), "Guard on")}>On</button>}
                    {tripped ? <button className="btn btn-sm btn-outline-warning py-0 me-1" onClick={() => confirm("Clear the halt and allow new trades now?") && act(() => api(`/api/risk/guards/${g.id}`, { method: "PATCH", body: { action: "clear" } }), "Halt cleared")}>Clear halt</button>
                      : <button className="btn btn-sm btn-outline-warning py-0 me-1" title="Trip the guard now to test that trading halts" onClick={() => act(() => api(`/api/risk/guards/${g.id}`, { method: "PATCH", body: { action: "drill" } }), "Drill: guard tripped — new trades blocked")}>🔥 Drill</button>}
                    <button className="btn btn-sm btn-outline-danger py-0" onClick={() => confirm(`Delete ${g.name}?`) && act(() => api(`/api/risk/guards/${g.id}`, { method: "DELETE" }), "Guard deleted")}>✕</button>
                  </td>
                </tr>
              );
            })}
            {!d?.guards.length && <tr><td colSpan={7} className="text-center text-secondary py-3">No guards yet — run a combo above. Suggested start: 🛡 Market crash shield + 🪙 Crypto crash shield + 🏦 Account drawdown brake.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="step-title">Risk events</div>
      <div className="panel table-responsive" style={{ maxHeight: 320 }}>
        <table className="table table-sm small-table mb-0">
          <thead className="sticky-top"><tr><th>Time</th><th>Guard</th><th>Event</th><th>Detail</th></tr></thead>
          <tbody>
            {(d?.events ?? []).map((e) => {
              let detail = e.detail ?? "";
              try { const j = JSON.parse(detail); detail = j.reason ? `${j.reason} · ${j.codes?.length ?? 0} markets blocked` : detail; } catch { /* plain text */ }
              return <tr key={e.id}><td className="text-secondary">{new Date(e.ts).toLocaleString()}</td><td>{e.guard_name ?? "—"}</td>
                <td><span className={`badge ${e.kind === "TRIP" ? "text-bg-danger" : e.kind === "DRILL" ? "text-bg-warning" : "text-bg-success"}`}>{e.kind}</span></td>
                <td style={{ whiteSpace: "normal" }}>{detail}</td></tr>;
            })}
            {!d?.events.length && <tr><td colSpan={4} className="text-center text-secondary py-3">No risk events yet</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="small text-secondary mt-2">Detectors measure moves against each market's own normal volatility (σ). The simulated market rarely crashes — use 🔥 Drill to see a halt in action. Blocked robot signals appear in each robot's audit trail as RISK_BLOCKED.</div>
    </div>
  );
}

