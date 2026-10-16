import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import { BY_CODE, INSTRUMENTS, KTYPES, klines, priceAt } from "../shared/market";
import {
  MAX_LOSS_STREAK, MIN_SUCCESS, MONEY_MGMT, RULE_KTYPES, TEMPLATES, TEMPLATE_BY_ID, backtest,
  type MoneyMgmt, type RuleConfig, type RuleMode, type Template,
} from "../shared/strategies";
import { api, fmt, money } from "./api";
import { fromUSD, symbol, toUSD } from "./currency";
import { modeShown, moomooOnly } from "./scope";
import { RuleCosts } from "./RuleCosts";
import { AutoSummary } from "./AutoSummary";
import { AggressivePanel } from "./AggressivePanel";
import { RuleGrid } from "./RuleGrid";
import { AssetIcon, AssetLabel, ShariahBadge } from "./Watchlist";
import { toast } from "./toast";
import { LIBRARY, PRESET_BY_ID, PRESETS, type LibRule } from "../shared/library";
import { chartColors, useTheme } from "./theme";
import { AssetPicker, type AssetStats, GROUPS, ModeHelp, groupOf, preferredCode } from "./pickers";

const KLABEL: Record<string, string> = { K_1M: "1 min", K_5M: "5 min", K_15M: "15 min", K_60M: "1 hour", K_DAY: "1 day" };
const EXPIRIES: [number, string][] = [[30, "30s"], [60, "1m"], [120, "2m"], [300, "5m"], [900, "15m"]];
const CATS = ["All", "Trend", "Momentum", "Mean reversion", "Breakout", "Volatility", "Pattern", "Systematic"] as const;

export interface Rule {
  id: number; name: string; template: string; mode: RuleMode; code: string; ktype: string; params: string; amount: number;
  expiry: number | null; money_mgmt: MoneyMgmt; stop_loss_pct: number | null; take_profit_pct: number | null; status: string;
  stop_reason: string | null; wins: number; losses: number; ties: number; pnl: number; pos_qty: number; entry_price: number | null;
  cur_stake: number | null; created_at: number; loss_streak?: number; aggressive?: number;
}

export function SuccessBar({ wins, losses, streak = 0 }: { wins: number; losses: number; streak?: number }) {
  const n = wins + losses;
  const rate = n ? wins / n : 0;
  const ok = rate >= MIN_SUCCESS;
  return (
    <div>
      <div className="d-flex justify-content-between small mb-1">
        <span className="text-secondary">Success rate</span>
        <span className={`fw-semibold tabular ${n === 0 ? "text-secondary" : ok ? "text-up" : "text-down"}`}>{n ? `${(rate * 100).toFixed(0)}%` : "—"}</span>
      </div>
      <div className="rate-bar">
        <div className={`rate-fill ${ok ? "ok" : "bad"}`} style={{ width: `${rate * 100}%` }} />
      </div>
      <div className="d-flex justify-content-between mt-1" style={{ fontSize: ".72rem" }}>
        <span className="text-secondary">{wins}W · {losses}L</span>
        <span className={streak >= MAX_LOSS_STREAK - 1 ? "text-down fw-semibold" : "text-secondary"} title={`Auto-stops after ${MAX_LOSS_STREAK} losses in a row`}>
          Losing streak {streak}/{MAX_LOSS_STREAK} {Array.from({ length: MAX_LOSS_STREAK }, (_, i) => (i < streak ? "●" : "○")).join("")}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls = { ACTIVE: "text-bg-success", PAUSED: "text-bg-secondary", STOPPED: "text-bg-danger" }[s] ?? "text-bg-dark";
  return <span className={`badge ${cls}`}>{s === "ACTIVE" ? "● RUNNING" : s}</span>;
}

function describe(r: { template: string; params: string | Record<string, number> }) {
  const tpl = TEMPLATE_BY_ID[r.template];
  const p = typeof r.params === "string" ? JSON.parse(r.params) : r.params;
  return tpl?.params.map((d) => `${d.label} ${p[d.key]}`).join(" · ") ?? "";
}

/** Index of the latest closed bar; changes when a candle closes so backtests re-run live. */
export function useBar(ktype: string) {
  const ms = (KTYPES[ktype] ?? 60) * 1000;
  const [bar, setBar] = useState(() => Math.floor(Date.now() / ms));
  useEffect(() => {
    setBar(Math.floor(Date.now() / ms));
    const t = setInterval(() => setBar(Math.floor(Date.now() / ms)), 1000);
    return () => clearInterval(t);
  }, [ms]);
  return bar;
}

export function LiveTag({ ktype }: { ktype: string }) {
  return <span className="small text-secondary d-inline-flex align-items-center gap-1"><span className="live-dot" /> live · refreshes every {KLABEL[ktype]} candle</span>;
}

// ---------------- Builder ----------------

export function EquityChart({ data }: { data: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const C = chartColors();
    const last = data.at(-1)?.[1] ?? 0;
    const c = Highcharts.chart(el.current!, {
      chart: { backgroundColor: "transparent", height: 150, spacing: [6, 4, 4, 4], animation: false },
      title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
      time: { useUTC: false } as Highcharts.TimeOptions,
      xAxis: { type: "datetime", labels: { style: { color: C.label, fontSize: "10px" } }, lineColor: C.axis },
      yAxis: { title: { text: undefined }, gridLineColor: C.grid, labels: { style: { color: C.label, fontSize: "10px" } }, plotLines: [{ value: 0, color: C.axis, width: 1 }] },
      tooltip: { pointFormatter: function (this: Highcharts.Point) { return `P/L: <b>${money(this.y ?? 0)}</b>`; }, xDateFormat: "%b %e %H:%M", backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg } },
      series: [{ type: "areaspline", name: "Backtest P/L", data, color: last >= 0 ? C.up : C.down, lineWidth: 2, marker: { enabled: false },
        fillOpacity: 0.15, threshold: 0, negativeColor: C.down } as any],
    });
    return () => c.destroy();
  }, [data, theme]);
  return <div ref={el} />;
}

function Builder({ tpl, init, defaultCode, onClose, onCreated }: { tpl: Template; init?: LibRule | null; defaultCode: string; onClose: () => void; onCreated: () => void }) {
  const ip = init ? PRESET_BY_ID[init.preset]! : null;
  const [mode, setMode] = useState<RuleMode>(moomooOnly() ? "STOCK" : ip ? ip.mode : tpl.modes.includes("BINARY") && !tpl.modes.includes("STOCK") ? "BINARY" : tpl.modes[0]!);
  const [code, setCode] = useState(() => preferredCode(defaultCode));
  const [ktype, setKtype] = useState(ip ? ip.ktype : tpl.id === "golden_cross" ? "K_60M" : "K_1M");
  const [params, setParams] = useState<Record<string, number>>(() => init ? { ...init.params } : Object.fromEntries(tpl.params.map((p) => [p.key, p.def])));
  const inst = BY_CODE[code]!;
  const [amount, setAmount] = useState(10);
  const [expiry, setExpiry] = useState(60);
  const [mm, setMm] = useState<MoneyMgmt>("FIXED");
  const [sl, setSl] = useState<number | "">(ip ? ip.sl ?? "" : 2);
  const [tp, setTp] = useState<number | "">(ip ? ip.tp ?? "" : 3);
  const [name, setName] = useState(init ? init.name : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tpl.id === "price_level") {
      const px = priceAt(code, Date.now());
      setParams({ buy_below: +(px * 0.99).toFixed(inst.decimals), sell_above: +(px * 1.01).toFixed(inst.decimals) });
    }
    setAmount(mode === "BINARY" ? 100 : inst.lot >= 100 ? inst.lot : inst.lot < 1 ? inst.lot * 10 : 10);
  }, [code, mode]);

  const cfg: RuleConfig = {
    template: tpl.id, mode, code, ktype, params, amount, expiry, money_mgmt: mm,
    stop_loss_pct: sl === "" ? null : sl, take_profit_pct: tp === "" ? null : tp,
  };
  const bar = useBar(ktype);
  const bt = useMemo(() => backtest(cfg, klines(code, ktype, 400).slice(0, -1)), [JSON.stringify(cfg), bar]);
  const rate = bt.trades ? bt.wins / bt.trades : 0;
  const assetStats = useMemo<AssetStats>(() => Object.fromEntries(INSTRUMENTS.map((i) => {
    const r = backtest({ ...cfg, code: i.code, params: tpl.id === "price_level" ? { buy_below: priceAt(i.code, Date.now()) * 0.99, sell_above: priceAt(i.code, Date.now()) * 1.01 } : params,
      amount: mode === "BINARY" ? amount : BY_CODE[i.code]!.lot * 10 }, klines(i.code, ktype, 400).slice(0, -1));
    return [i.code, { wins: r.wins, trials: r.trades, pnl: r.pnl }];
  })), [mode, ktype, JSON.stringify(params), expiry, mm, sl, tp, mode === "BINARY" ? amount : 0, bar]);

  async function create() {
    setBusy(true);
    try {
      await api("/api/rules", { body: { ...cfg, name } });
      toast.ok("Rule created and running");
      onCreated();
    } catch (e) { toast.err((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal d-block rt-modal" onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content panel">
          <div className="modal-header border-secondary-subtle">
            <span className="tpl-icon me-2">{tpl.icon}</span>
            <div>
              <h5 className="modal-title mb-0">{tpl.name}</h5>
              <div className="small text-secondary">{tpl.description}</div>
            </div>
            <button className="btn-close ms-auto" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-4">
              <div className="col-lg-6">
                <div className="step-title">1 · Market</div>
                <div className="row g-2 mb-3">
                  <div className="col-12 d-flex align-items-center gap-2">
                    <div className="seg">
                      {(["STOCK", "BINARY"] as RuleMode[]).filter(modeShown).map((m) => (
                        <button key={m} disabled={!tpl.modes.includes(m)} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                          {m === "STOCK" ? "📈 Stocks (buy / sell)" : "⏱ Binary (higher / lower)"}
                        </button>
                      ))}
                    </div>
                    <ModeHelp />
                  </div>
                  <div className="col-sm-7">
                    <label className="form-label small text-secondary mb-1">Asset</label>
                    <AssetPicker value={code} onChange={setCode} stats={assetStats} statsLabel={`${tpl.name} backtest per asset · ${KLABEL[ktype]}`} />
                  </div>
                  <div className="col-sm-5">
                    <label className="form-label small text-secondary mb-1">Timeframe</label>
                    <select className="form-select form-select-sm" value={ktype} onChange={(e) => setKtype(e.target.value)}>
                      {RULE_KTYPES.map((k) => <option key={k} value={k}>{KLABEL[k]} candles</option>)}
                    </select>
                  </div>
                </div>

                <div className="step-title">2 · Strategy parameters</div>
                <div className="row g-2 mb-3">
                  {tpl.params.map((p) => (
                    <div className="col-6" key={p.key}>
                      <label className="form-label small text-secondary mb-1">{p.label}</label>
                      <input className="form-control form-control-sm tabular" type="number" step={p.step ?? 1} min={p.min} max={p.max}
                        value={params[p.key]} onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })} />
                    </div>
                  ))}
                </div>

                <div className="step-title">3 · Position & risk</div>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label small text-secondary mb-1">{mode === "BINARY" ? `Stake (${symbol()})` : `Quantity (lot ${inst.lot})`}</label>
                    <input className="form-control form-control-sm tabular" type="number" step={mode === "BINARY" ? 1 : inst.lot} value={mode === "BINARY" ? Math.round(fromUSD(amount)) : amount} onChange={(e) => setAmount(mode === "BINARY" ? toUSD(Number(e.target.value)) : Number(e.target.value))} />
                  </div>
                  {mode === "BINARY" ? (
                    <>
                      <div className="col-6">
                        <label className="form-label small text-secondary mb-1">Expiry</label>
                        <select className="form-select form-select-sm" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
                          {EXPIRIES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label small text-secondary mb-1">Money management</label>
                        <select className="form-select form-select-sm" value={mm} onChange={(e) => setMm(e.target.value as MoneyMgmt)}>
                          {Object.entries(MONEY_MGMT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-3">
                        <label className="form-label small text-secondary mb-1">Stop-loss %</label>
                        <input className="form-control form-control-sm tabular" type="number" step={0.1} placeholder="off" value={sl} onChange={(e) => setSl(e.target.value === "" ? "" : Number(e.target.value))} />
                      </div>
                      <div className="col-3">
                        <label className="form-label small text-secondary mb-1">Take-profit %</label>
                        <input className="form-control form-control-sm tabular" type="number" step={0.1} placeholder="off" value={tp} onChange={(e) => setTp(e.target.value === "" ? "" : Number(e.target.value))} />
                      </div>
                    </>
                  )}
                  <div className="col-12">
                    <label className="form-label small text-secondary mb-1">Rule name (optional)</label>
                    <input className="form-control form-control-sm" placeholder={`${tpl.name} · ${code}`} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="d-flex align-items-center justify-content-between flex-wrap"><div className="step-title">Backtest preview <span className="text-secondary fw-normal">· last ~400 {KLABEL[ktype]} bars</span></div><LiveTag ktype={ktype} /></div>
                <div className="row g-2 mb-2">
                  <div className="col-4"><div className="kpi"><div className="kpi-l">Trials</div><div className="kpi-v">{bt.trades}</div></div></div>
                  <div className="col-4"><div className="kpi"><div className="kpi-l">Success</div><div className={`kpi-v ${bt.trades ? (rate >= MIN_SUCCESS ? "text-up" : "text-down") : ""}`}>{bt.trades ? `${(rate * 100).toFixed(0)}%` : "—"}</div></div></div>
                  <div className="col-4"><div className="kpi"><div className="kpi-l">P/L</div><div className={`kpi-v ${bt.pnl >= 0 ? "text-up" : "text-down"}`}>{money(bt.pnl)}</div></div></div>
                </div>
                <EquityChart data={bt.equity} />
                <div className={`alert py-2 small mt-2 mb-0 ${bt.wouldStopAt ? "alert-warning" : "alert-secondary"}`}>
                  {bt.wouldStopAt
                    ? <>⚠ On this history the rule would have <b>hit {MAX_LOSS_STREAK} losses in a row at trade {bt.wouldStopAt}</b> and been auto-stopped.</>
                    : <>🛡 Safety: the rule stops automatically after <b>{MAX_LOSS_STREAK} losses in a row</b>. A win resets the count.</>}
                </div>
                <div className="text-secondary mt-2" style={{ fontSize: ".72rem" }}>
                  Past simulated performance only. The live rule checks signals at each candle close (server-side, also while the app is closed).
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer border-secondary-subtle">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-accent px-4" disabled={busy} onClick={create}>{busy ? "Starting…" : "▶ Start rule"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Rule library picker ----------------

function LibraryPicker({ cat, setCat, onPick }: { cat: (typeof CATS)[number]; setCat: (c: (typeof CATS)[number]) => void; onPick: (r: LibRule) => void }) {
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("ALL");
  const [n, setN] = useState(48);
  const list = useMemo(() => LIBRARY.filter((r) => modeShown(PRESET_BY_ID[r.preset]!.mode)).filter((r) => {
    const t = TEMPLATE_BY_ID[r.template]!;
    return (cat === "All" || t.category === cat) && (style === "ALL" || r.preset === style) && (!q || `${r.name} ${t.name}`.toLowerCase().includes(q.toLowerCase()));
  }), [q, style, cat]);
  useEffect(() => setN(48), [q, style, cat]);
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-1 mb-3">
        {CATS.map((c) => <button key={c} className={`chip ${c === cat ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
        <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 220 }} placeholder="🔍 Search presets…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-select form-select-sm w-auto" value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="ALL">All styles</option>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="small text-secondary mb-2">{list.length.toLocaleString()} ready-made rules with tuned parameters and a trading style. Click one to open it in the builder, pre-filled — check the live backtest, pick an asset, then start. For a ranked list, see 🏆 Combos.</div>
      <div className="row g-2">
        {list.slice(0, n).map((r) => {
          const t = TEMPLATE_BY_ID[r.template]!, p = PRESET_BY_ID[r.preset]!;
          return (
            <div className="col-sm-6 col-lg-4 col-xxl-3" key={r.id}>
              <div className="tpl-card w-100 text-start" role="button" onClick={() => onPick(r)}>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="tpl-icon">{t.icon}</span>
                  <div className="flex-grow-1 text-truncate">
                    <div className="fw-semibold text-truncate">{r.name}{r.isDefault && <span className="badge text-bg-secondary ms-1">default</span>}</div>
                    <div className="text-secondary" style={{ fontSize: ".7rem" }}>{t.category} · {p.label}</div>
                  </div>
                </div>
                <div className="small text-secondary text-truncate">{t.params.map((d) => `${d.label} ${r.params[d.key]}`).join(" · ")}</div>
                <div className="text-secondary" style={{ fontSize: ".7rem" }}>{p.blurb}</div>
              </div>
            </div>
          );
        })}
      </div>
      {list.length > n && <div className="text-center mt-3"><button className="btn btn-sm btn-outline-secondary" onClick={() => setN(n + 48)}>Show more ({(list.length - n).toLocaleString()} left)</button></div>}
    </>
  );
}

// ---------------- Bulk builder ----------------

function BulkBuilder({ tpls, defaultCode, onClose, onCreated }: { tpls: Template[]; defaultCode: string; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<RuleMode>(moomooOnly() ? "STOCK" : "BINARY");
  const [codes, setCodes] = useState<string[]>(() => [preferredCode(defaultCode)]);
  const [ktype, setKtype] = useState("K_1M");
  const [stake, setStake] = useState(50);
  const [qtyMult, setQtyMult] = useState(1);
  const [expiry, setExpiry] = useState(60);
  const [mm, setMm] = useState<MoneyMgmt>("FIXED");
  const [sl, setSl] = useState<number | "">(1);
  const [tp, setTp] = useState<number | "">(1.5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const usable = tpls.filter((t) => t.modes.includes(mode));
  const skipped = tpls.filter((t) => !t.modes.includes(mode));
  const qtyFor = (c: string) => { const l = BY_CODE[c]!.lot; return +((l >= 100 ? l : l < 1 ? l * 10 : 10) * qtyMult).toFixed(6); };
  const cfgFor = (t: Template, c: string): RuleConfig => {
    const params = Object.fromEntries(t.params.map((p) => [p.key, p.def]));
    if (t.id === "price_level") { const px = priceAt(c, Date.now()); params.buy_below = +(px * 0.995).toFixed(BY_CODE[c]!.decimals); params.sell_above = +(px * 1.005).toFixed(BY_CODE[c]!.decimals); }
    return { template: t.id, mode, code: c, ktype, params, amount: mode === "BINARY" ? stake : qtyFor(c), expiry, money_mgmt: mm,
      stop_loss_pct: sl === "" ? null : sl, take_profit_pct: tp === "" ? null : tp };
  };
  const bar = useBar(ktype);
  const preview = useMemo(() => {
    const hist = Object.fromEntries(codes.map((c) => [c, klines(c, ktype, 400).slice(0, -1)]));
    return usable.flatMap((t) => codes.map((c) => ({ t, c, r: backtest(cfgFor(t, c), hist[c]!) })));
  }, [mode, codes.join(), ktype, stake, qtyMult, expiry, mm, sl, tp, usable.map((t) => t.id).join(), bar]);
  const total = usable.length * codes.length;
  // Success rate per asset (aggregated over the chosen templates) to rank assets inside the picker.
  const assetStats = useMemo<AssetStats>(() => Object.fromEntries(INSTRUMENTS.map((i) => {
    const hist = klines(i.code, ktype, 400).slice(0, -1);
    const agg = { wins: 0, trials: 0, pnl: 0 };
    for (const t of usable) { const r = backtest(cfgFor(t, i.code), hist); agg.wins += r.wins; agg.trials += r.trades; agg.pnl += r.pnl; }
    return [i.code, agg];
  })), [mode, ktype, stake, qtyMult, expiry, mm, sl, tp, usable.map((t) => t.id).join(), bar]);

  async function create() {
    setBusy(true); setProgress(0);
    let ok = 0, fail = 0;
    for (const t of usable) for (const c of codes) {
      try { await api("/api/rules", { body: cfgFor(t, c) }); ok++; } catch { fail++; }
      setProgress((p) => p + 1);
    }
    setBusy(false);
    fail ? toast.err(`Created ${ok}, failed ${fail}`) : toast.ok(`Created ${ok} rules — all running`);
    onCreated();
  }

  return (
    <div className="modal d-block rt-modal" onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content panel">
          <div className="modal-header border-secondary-subtle">
            <span className="tpl-icon me-2">⧉</span>
            <div><h5 className="modal-title mb-0">Bulk create {total} rule{total === 1 ? "" : "s"}</h5>
              <div className="small text-secondary">{usable.length} template{usable.length === 1 ? "" : "s"} × {codes.length} asset{codes.length === 1 ? "" : "s"} · default parameters</div></div>
            <button className="btn-close ms-auto" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-2 mb-3 align-items-end">
              <div className="col-12 d-flex align-items-center gap-2">
                <div className="seg">
                  {(["BINARY", "STOCK"] as RuleMode[]).filter(modeShown).map((m) => (
                    <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>{m === "STOCK" ? "📈 Stocks" : "⏱ Binary"}</button>
                  ))}
                </div>
                <ModeHelp />
              </div>
              <div className="col-md-5"><label className="form-label small text-secondary mb-1">Assets</label><AssetPicker multi value={codes} onChange={setCodes} stats={assetStats} statsLabel={`Backtest success over ${usable.length} template(s), last ~400 ${KLABEL[ktype]} bars`} /></div>
              <div className="col-md-2"><label className="form-label small text-secondary mb-1">Timeframe</label>
                <select className="form-select form-select-sm" value={ktype} onChange={(e) => setKtype(e.target.value)}>{RULE_KTYPES.map((k) => <option key={k} value={k}>{KLABEL[k]}</option>)}</select></div>
              {mode === "BINARY" ? (
                <>
                  <div className="col-md-1"><label className="form-label small text-secondary mb-1">Stake {symbol()}</label><input className="form-control form-control-sm" type="number" value={Math.round(fromUSD(stake))} onChange={(e) => setStake(toUSD(Number(e.target.value)))} /></div>
                  <div className="col-md-1"><label className="form-label small text-secondary mb-1">Expiry</label>
                    <select className="form-select form-select-sm" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>{EXPIRIES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select></div>
                  <div className="col-md-3"><label className="form-label small text-secondary mb-1">Money mgmt</label>
                    <select className="form-select form-select-sm" value={mm} onChange={(e) => setMm(e.target.value as MoneyMgmt)}>{Object.entries(MONEY_MGMT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                </>
              ) : (
                <>
                  <div className="col-md-1"><label className="form-label small text-secondary mb-1" title="Multiplier of the default quantity per asset">Qty ×</label><input className="form-control form-control-sm" type="number" min={1} value={qtyMult} onChange={(e) => setQtyMult(Math.max(1, Number(e.target.value)))} /></div>
                  <div className="col-md-2"><label className="form-label small text-secondary mb-1">Stop-loss %</label><input className="form-control form-control-sm" type="number" step={0.1} value={sl} onChange={(e) => setSl(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                  <div className="col-md-2"><label className="form-label small text-secondary mb-1">Take-profit %</label><input className="form-control form-control-sm" type="number" step={0.1} value={tp} onChange={(e) => setTp(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                </>
              )}
            </div>
            {skipped.length > 0 && <div className="alert alert-secondary py-2 small">Skipped (no {mode === "BINARY" ? "binary" : "stock"} mode): {skipped.map((t) => t.name).join(", ")}</div>}
            <div className="d-flex align-items-center justify-content-between"><div className="step-title">Backtest preview</div><LiveTag ktype={ktype} /></div>
            <div className="table-responsive" style={{ maxHeight: 340 }}>
              <table className="table table-sm table-hover small-table tabular mb-0">
                <thead className="sticky-top"><tr><th>Template</th><th>Asset</th><th className="text-end">Trials</th><th style={{ width: 160 }}>Success</th><th className="text-end">P/L</th><th>Auto-stop?</th></tr></thead>
                <tbody>
                  {preview.sort((a, b) => (b.r.trades ? b.r.wins / b.r.trades : -1) - (a.r.trades ? a.r.wins / a.r.trades : -1)).map(({ t, c, r }) => {
                    const rate = r.trades ? r.wins / r.trades : 0;
                    return (
                      <tr key={t.id + c}>
                        <td><span className="text-warning me-1">{t.icon}</span>{t.name}</td>
                        <td><AssetLabel code={c} /></td>
                        <td className="text-end">{r.trades}</td>
                        <td>{r.trades ? <div className="d-flex align-items-center gap-2"><div className="rate-bar flex-grow-1"><div className={`rate-fill ${rate >= MIN_SUCCESS ? "ok" : "bad"}`} style={{ width: `${rate * 100}%` }} /><div className="rate-mark" style={{ left: "70%" }} /></div><span className={rate >= MIN_SUCCESS ? "text-up" : "text-down"}>{(rate * 100).toFixed(0)}%</span></div> : <span className="text-secondary">no signals</span>}</td>
                        <td className={`text-end ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{money(r.pnl)}</td>
                        <td>{r.wouldStopAt ? <span className="text-down">after #{r.wouldStopAt}</span> : <span className="text-secondary">—</span>}</td>
                      </tr>
                    );
                  })}
                  {!preview.length && <tr><td colSpan={6} className="text-center text-secondary py-3">Select at least one asset</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer border-secondary-subtle">
            {busy && <div className="progress flex-grow-1" style={{ height: 6 }}><div className="progress-bar bg-warning" style={{ width: `${(progress / total) * 100}%` }} /></div>}
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-accent px-4" disabled={busy || !total} onClick={create}>{busy ? `Creating ${progress}/${total}…` : `▶ Start ${total} rules`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Rule detail ----------------

export function RuleDetail({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const [tab, setTab] = useState<"trades" | "audit">("trades");
  const [trades, setTrades] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => {
    const load = () => {
      api(`/api/rules/${rule.id}/trades`).then((r) => setTrades(r.data)).catch(() => {});
      api(`/api/audit?rule_id=${rule.id}`).then((r) => setLog(r.data)).catch(() => {});
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [rule.id]);
  const d = BY_CODE[rule.code]!.decimals;
  return (
    <div className="modal d-block rt-modal" onClick={onClose}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content panel">
          <div className="modal-header border-secondary-subtle">
            <AssetIcon code={rule.code} />
            <div className="ms-2">
              <h5 className="modal-title mb-0">{rule.name} <StatusBadge s={rule.status} /></h5>
              <div className="small text-secondary">{TEMPLATE_BY_ID[rule.template]?.name} · {describe(rule)} · {KLABEL[rule.ktype]}</div>
            </div>
            <button className="btn-close ms-auto" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-2 mb-3">
              <div className="col-md-4"><div className="kpi"><SuccessBar wins={rule.wins} losses={rule.losses} streak={rule.loss_streak ?? 0} /></div></div>
              <div className="col-6 col-md-4"><div className="kpi"><div className="kpi-l">Realised P/L</div><div className={`kpi-v ${rule.pnl >= 0 ? "text-up" : "text-down"}`}>{money(rule.pnl)}</div></div></div>
              <div className="col-6 col-md-4"><div className="kpi"><div className="kpi-l">{rule.mode === "STOCK" ? "Open position" : "Next stake"}</div>
                <div className="kpi-v">{rule.mode === "STOCK" ? (rule.pos_qty ? `${rule.pos_qty} @ ${fmt(rule.entry_price ?? 0, d)}` : "Flat") : money(rule.cur_stake ?? rule.amount)}</div></div></div>
            </div>
            {rule.stop_reason && <div className={`alert py-2 small ${rule.status === "STOPPED" ? "alert-danger" : "alert-secondary"}`}>{rule.stop_reason}</div>}
            <RuleCosts rule={rule} trades={trades} />
            <ul className="nav nav-tabs mb-2">
              <li className="nav-item"><button className={`nav-link ${tab === "trades" ? "active" : ""}`} onClick={() => setTab("trades")}>Trade history ({trades.length})</button></li>
              <li className="nav-item"><button className={`nav-link ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>Audit trail ({log.length})</button></li>
            </ul>
            {tab === "trades" ? <TradeTable rows={trades} /> : <AuditTable rows={log} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TradeTable({ rows, showRule }: { rows: any[]; showRule?: boolean }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0 small-table tabular">
        <thead><tr><th>#</th>{showRule && <th>Rule</th>}<th>Opened</th><th>Side</th><th className="text-end">Size</th><th className="text-end">Entry</th><th className="text-end">Exit</th><th>Result</th><th className="text-end">P/L</th><th>Reason</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="text-secondary">{t.id}</td>
              {showRule && <td>{t.code && <AssetIcon code={t.code} size={18} />} {t.rule_name}</td>}
              <td>{new Date(t.opened_at).toLocaleString()}</td>
              <td className={["BUY", "CALL"].includes(t.side) ? "text-up" : "text-down"}>{t.side === "CALL" ? "▲ CALL" : t.side === "PUT" ? "▼ PUT" : t.side}</td>
              <td className="text-end">{t.kind === "BINARY" ? money(t.qty) : t.qty}</td>
              <td className="text-end">{t.entry_price}</td>
              <td className="text-end">{t.exit_price ?? "—"}</td>
              <td><span className={`badge ${t.status === "WON" ? "text-bg-success" : t.status === "LOST" ? "text-bg-danger" : t.status === "OPEN" ? "text-bg-info" : "text-bg-secondary"}`}>{t.status}</span></td>
              <td className={`text-end ${(t.pnl ?? 0) > 0 ? "text-up" : (t.pnl ?? 0) < 0 ? "text-down" : ""}`}>{t.pnl != null ? money(t.pnl) : "—"}</td>
              <td className="text-secondary">{t.reason}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={10} className="text-center text-secondary py-4">No trades yet — waiting for the next signal</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const EVENT_STYLE: Record<string, string> = {
  WIN: "text-up", LOSS: "text-down", AUTO_STOP: "text-down fw-bold", ERROR: "text-down", OPEN: "text-info", CLOSE: "text-info",
  RULE_CREATED: "text-warning", RULE_RESUMED: "text-warning", RULE_RESET: "text-warning", RULE_PAUSED: "text-secondary", RULE_DELETED: "text-secondary",
};

export function AuditTable({ rows, showRule }: { rows: any[]; showRule?: boolean }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0 small-table tabular">
        <thead><tr><th>Time</th><th>Actor</th>{showRule && <th>Rule</th>}<th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.ts).toLocaleString()}</td>
              <td><span className={`badge ${a.actor === "admin" ? "text-bg-primary" : a.actor === "bot" ? "text-bg-dark border" : "text-bg-warning"}`}>{a.actor}</span></td>
              {showRule && <td className="text-secondary">{a.rule_name ?? "—"}</td>}
              <td className={EVENT_STYLE[a.event] ?? ""}>{a.event}</td>
              <td className="text-secondary text-wrap" style={{ maxWidth: 520, fontFamily: "ui-monospace, monospace", fontSize: ".75rem" }}>{a.detail}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="text-center text-secondary py-4">No events</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Page ----------------

export function AutoTrade({ code }: { code: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [tpl, setTpl] = useState<Template | null>(null);
  const [libInit, setLibInit] = useState<LibRule | null>(null);
  const [gview, setGview] = useState<"types" | "library">("types");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("ALL");
  const [fMode, setFMode] = useState("ALL");
  const [fGroup, setFGroup] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [view, setViewState] = useState<"list" | "grid">(() => { try { return localStorage.getItem("rt.ruleView") === "grid" ? "grid" : "list"; } catch { return "list"; } });
  const setView = (v: "list" | "grid") => { setViewState(v); try { localStorage.setItem("rt.ruleView", v); } catch { /* ignore */ } };
  const prev = useRef<Record<number, string>>({});

  const load = useCallback(async () => {
    const r = await api<{ data: Rule[] }>("/api/rules");
    for (const x of r.data) {
      if (prev.current[x.id] === "ACTIVE" && x.status === "STOPPED") toast.err(`${x.name} auto-stopped: ${x.stop_reason}`);
      prev.current[x.id] = x.status;
    }
    setRules(r.data); setLoaded(true);
  }, []);
  useEffect(() => { load().catch(() => {}); const t = setInterval(() => load().catch(() => {}), 3000); return () => clearInterval(t); }, [load]);

  const call = (id: number, action: string) =>
    action === "delete" ? api(`/api/rules/${id}`, { method: "DELETE" }) : api(`/api/rules/${id}`, { method: "PATCH", body: { action } });
  const act = async (id: number, action: string) => {
    if (action === "delete" && !confirm("Delete this rule? Its history stays in the audit trail.")) return;
    try { await call(id, action); load(); } catch (e) { toast.err((e as Error).message); }
  };
  const bulk = async (action: string) => {
    const ids = visible.filter((r) => sel.has(r.id)).map((r) => r.id);
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} rules? History stays in the audit trail.`)) return;
    const res = await Promise.allSettled(ids.map((id) => call(id, action)));
    const ok = res.filter((x) => x.status === "fulfilled").length;
    toast.ok(`${action}: ${ok} updated${ok < ids.length ? `, ${ids.length - ok} not applicable` : ""}`);
    if (action === "delete") setSel(new Set());
    load();
  };

  const rate = (r: Rule) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : -1);
  const visible = rules
    .filter((r) => fStatus === "ALL" || r.status === fStatus)
    .filter((r) => fMode === "ALL" || r.mode === fMode)
    .filter((r) => fGroup === "ALL" || groupOf(r.code).id === fGroup)
    .filter((r) => !q || `${r.name} ${r.code} ${TEMPLATE_BY_ID[r.template]?.name} ${BY_CODE[r.code]?.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "rate" ? rate(b) - rate(a) : sort === "pnl" ? b.pnl - a.pnl : sort === "trials" ? (b.wins + b.losses) - (a.wins + a.losses) : b.id - a.id);
  const allSel = visible.length > 0 && visible.every((r) => sel.has(r.id));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selCount = visible.filter((r) => sel.has(r.id)).length;

  const shownTpls = TEMPLATES.filter((t) => cat === "All" || t.category === cat);
  const allPicked = shownTpls.every((t) => picked.has(t.id));
  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totals = rules.reduce((a, r) => ({ w: a.w + r.wins, l: a.l + r.losses, pnl: a.pnl + r.pnl, act: a.act + (r.status === "ACTIVE" ? 1 : 0) }), { w: 0, l: 0, pnl: 0, act: 0 });
  const detailRule = rules.find((r) => r.id === detail);
  const counts = (s: string) => rules.filter((r) => r.status === s).length;

  return (
    <div>
      <AutoSummary rules={rules} />
      <AggressivePanel rules={rules} reload={load} />

      <div className="d-flex align-items-center mb-2 gap-2">
        <h5 className="mb-0">My rules</h5>
        <button className="btn btn-accent btn-sm ms-auto" onClick={() => setGallery((g) => !g)}>{gallery ? "Close" : `+ New rule · ${TEMPLATES.length} types · ${LIBRARY.length.toLocaleString()} presets`}</button>
      </div>

      {(gallery || (loaded && !rules.length)) && (
        <div className="panel p-3 mb-3">
          <div className="seg seg-sm mb-3">
            <button className={gview === "types" ? "active" : ""} onClick={() => setGview("types")}>🧩 Strategy types · {TEMPLATES.length}</button>
            <button className={gview === "library" ? "active" : ""} onClick={() => setGview("library")}>📚 Rule library · {LIBRARY.length.toLocaleString()}</button>
          </div>
          {gview === "library" ? <LibraryPicker cat={cat} setCat={setCat} onPick={(r) => { setLibInit(r); setTpl(TEMPLATE_BY_ID[r.template]!); }} /> : <>
          <div className="d-flex flex-wrap align-items-center gap-1 mb-3">
            <label className="d-flex align-items-center gap-2 me-2 small" style={{ cursor: "pointer" }}>
              <input type="checkbox" className="form-check-input m-0" checked={allPicked} onChange={() => setPicked((s) => { const n = new Set(s); shownTpls.forEach((t) => (allPicked ? n.delete(t.id) : n.add(t.id))); return n; })} />
              Select all
            </label>
            {CATS.map((c) => <button key={c} className={`chip ${c === cat ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
            <div className="ms-auto d-flex gap-2 align-items-center">
              {picked.size > 0 && <button className="btn btn-link btn-sm text-secondary p-0" onClick={() => setPicked(new Set())}>Clear</button>}
              <button className="btn btn-accent btn-sm" disabled={!picked.size} onClick={() => setBulkOpen(true)}>⧉ Bulk create ({picked.size})</button>
            </div>
          </div>
          <div className="small text-secondary mb-2">Click a card to configure one rule, or tick several (or <b>Select all</b>) to start them together — ideal for testing every strategy in Binary mode.</div>
          <div className="row g-2">
            {shownTpls.map((t) => (
              <div className="col-sm-6 col-lg-4 col-xxl-3" key={t.id}>
                <div className={`tpl-card w-100 text-start ${picked.has(t.id) ? "picked" : ""}`} role="button" onClick={() => setTpl(t)}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="tpl-icon">{t.icon}</span>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{t.name}</div>
                      <div className="text-secondary" style={{ fontSize: ".7rem" }}>{t.category} · {t.modes.map((m) => (m === "STOCK" ? "Stocks" : "Binary")).join(" + ")}</div>
                    </div>
                    <input type="checkbox" className="form-check-input tpl-check" checked={picked.has(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => togglePick(t.id)} />
                  </div>
                  <div className="small text-secondary">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
          </>}
        </div>
      )}

      {rules.length > 0 && (
        <div className="panel p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
          <input type="checkbox" className="form-check-input m-0 ms-1" title="Select all visible" checked={allSel}
            onChange={() => setSel(allSel ? new Set() : new Set(visible.map((r) => r.id)))} />
          <input className="form-control form-control-sm" style={{ maxWidth: 220 }} placeholder="🔍 Search rules, assets…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg seg-sm">
            {["ALL", "ACTIVE", "PAUSED", "STOPPED"].map((s) => (
              <button key={s} className={fStatus === s ? "active" : ""} onClick={() => setFStatus(s)}>
                {s === "ALL" ? `All ${rules.length}` : `${s === "ACTIVE" ? "Running" : s[0] + s.slice(1).toLowerCase()} ${counts(s)}`}
              </button>
            ))}
          </div>
          <select className="form-select form-select-sm w-auto" value={fMode} onChange={(e) => setFMode(e.target.value)}>
            <option value="ALL">All modes</option><option value="BINARY">⏱ Binary</option><option value="STOCK">📈 Stocks</option>
          </select>
          <select className="form-select form-select-sm w-auto" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
            <option value="ALL">All markets</option>
            {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.label}</option>)}
          </select>
          <select className="form-select form-select-sm w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option><option value="rate">Best success</option><option value="pnl">Best P/L</option><option value="trials">Most trials</option>
          </select>
          <div className="seg seg-sm" title="Grid: tile size follows profit">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>☰ List</button>
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>▦ Grid</button>
          </div>
          {selCount > 0 && (
            <div className="d-flex gap-1 ms-auto align-items-center">
              <span className="small text-secondary me-1">{selCount} selected</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => bulk("pause")}>Pause</button>
              <button className="btn btn-sm btn-outline-success" onClick={() => bulk("resume")}>Resume</button>
              <button className="btn btn-sm btn-outline-warning" onClick={() => bulk("reset")}>Reset & restart</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => bulk("delete")}>Delete</button>
            </div>
          )}
        </div>
      )}

      {view === "grid" ? <RuleGrid rules={visible} onOpen={setDetail} /> : (
      <div className="row g-2">
        {visible.map((r) => {
          const tplr = TEMPLATE_BY_ID[r.template];
          return (
            <div className="col-md-6 col-xxl-4" key={r.id}>
              <div className={`panel p-3 h-100 rule-card ${r.status.toLowerCase()} ${sel.has(r.id) ? "selected" : ""}`}>
                <div className="d-flex align-items-start gap-2 mb-2">
                  <input type="checkbox" className="form-check-input mt-2" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  <AssetIcon code={r.code} />
                  <div className="flex-grow-1 text-truncate">
                    <div className="fw-semibold text-truncate">{r.aggressive ? <span className="badge text-bg-warning me-1">⚡ AGG</span> : null}{r.name}</div>
                    <div className="small text-secondary text-truncate">{tplr?.icon} {tplr?.name} · {r.mode === "BINARY" ? `Binary ${r.expiry}s · ${money(r.cur_stake ?? r.amount)}` : `Qty ${r.amount}`} · {KLABEL[r.ktype]}</div>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1"><StatusBadge s={r.status} /><ShariahBadge code={r.code} mode={r.mode} mm={r.money_mgmt} /></div>
                </div>
                <SuccessBar wins={r.wins} losses={r.losses} streak={r.loss_streak ?? 0} />
                <div className="d-flex justify-content-between small mt-2">
                  <span className="text-secondary">P/L <b className={r.pnl >= 0 ? "text-up" : "text-down"}>{money(r.pnl)}</b></span>
                  {r.mode === "STOCK" && <span className="text-secondary">{r.pos_qty ? `Holding ${r.pos_qty}` : "Flat"}</span>}
                  {r.mode === "BINARY" && (() => { const be = 1 / (1 + BY_CODE[r.code]!.payout), n = r.wins + r.losses, p = n ? r.wins / n : 0;
                    return <span className={n ? (p >= be ? "text-up" : "text-down") : "text-secondary"} title="Win rate needed to break even (payout < stake)">needs ≥{(be * 100).toFixed(1)}% to profit</span>; })()}
                </div>
                {r.stop_reason && r.status !== "ACTIVE" && <div className={`small mt-2 ${r.status === "STOPPED" ? "text-down" : "text-secondary"}`}>{r.stop_reason}</div>}
                <div className="d-flex gap-1 mt-3">
                  <button className="btn btn-sm btn-outline-light flex-fill" onClick={() => setDetail(r.id)}>History & audit</button>
                  {r.status === "ACTIVE" && <button className="btn btn-sm btn-outline-secondary" onClick={() => act(r.id, "pause")}>Pause</button>}
                  {r.status === "PAUSED" && <button className="btn btn-sm btn-outline-success" onClick={() => act(r.id, "resume")}>Resume</button>}
                  {r.status === "STOPPED" && <button className="btn btn-sm btn-outline-warning" title="Reset trial stats and restart" onClick={() => act(r.id, "reset")}>Reset & restart</button>}
                  <button className="btn btn-sm btn-outline-danger" onClick={() => act(r.id, "delete")}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
        {rules.length > 0 && !visible.length && <div className="text-center text-secondary py-4">No rules match these filters</div>}
      </div>
      )}

      {tpl && <Builder key={libInit?.id ?? tpl.id} tpl={tpl} init={libInit} defaultCode={code} onClose={() => { setTpl(null); setLibInit(null); }} onCreated={() => { setTpl(null); setLibInit(null); setGallery(false); load(); }} />}
      {bulkOpen && <BulkBuilder tpls={TEMPLATES.filter((t) => picked.has(t.id))} defaultCode={code}
        onClose={() => setBulkOpen(false)} onCreated={() => { setBulkOpen(false); setPicked(new Set()); setGallery(false); load(); }} />}
      {detailRule && <RuleDetail rule={detailRule} onClose={() => setDetail(null)} />}
    </div>
  );
}

export { AssetLabel };
