import { useCallback, useEffect, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import { BY_CODE, priceAt } from "../shared/market";
import { api, fmt, money } from "./api";
import { currency, symbol, toUSD, useCurrency } from "./currency";
import { binaryEconomics } from "../shared/costs";
import { AssetIcon, useNow } from "./Watchlist";
import { chartColors, useTheme } from "./theme";

const EXPIRIES: [number, string][] = [[30, "30s"], [60, "1m"], [120, "2m"], [300, "5m"], [900, "15m"]];
const WINDOW_SEC = 240;

interface Trade {
  id: number; code: string; direction: "CALL" | "PUT"; amount: number; strike: number; payout: number;
  open_time: number; expire_time: number; status: string; close_price: number | null; profit: number | null;
}

function BinaryChart({ code, open }: { code: string; open: Trade[] }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const C = chartColors();
    const inst = BY_CODE[code]!;
    const now = Math.floor(Date.now() / 1000) * 1000;
    const data: [number, number][] = [];
    for (let i = WINDOW_SEC * 4; i >= 0; i--) data.push([now - i * 250, priceAt(code, now - i * 250)]);
    const chart = Highcharts.chart(el.current!, {
      chart: { backgroundColor: "transparent", animation: { duration: 180, easing: "linear" } as any, style: { fontFamily: "inherit" } },
      credits: { enabled: false }, title: { text: undefined }, legend: { enabled: false },
      time: { useUTC: false } as Highcharts.TimeOptions,
      tooltip: { valueDecimals: inst.decimals, backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg }, xDateFormat: "%H:%M:%S" },
      xAxis: { type: "datetime", gridLineColor: C.grid, lineColor: C.axis, labels: { style: { color: C.label } }, maxPadding: 0.12 },
      yAxis: { title: { text: undefined }, opposite: true, gridLineColor: C.grid, labels: { style: { color: C.label } } },
      plotOptions: { series: { animation: { duration: 500 }, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 } } } },
      series: [{
        type: "areaspline", name: inst.name, data, color: C.accent, lineWidth: 2.5, threshold: null,
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, C.accent + "59"], [1, C.accent + "00"]] },
      }],
    });
    chartRef.current = chart;
    let dot: any = null;
    const t = setInterval(() => {
      const ms = Date.now();
      const s = chart.series[0]!;
      s.addPoint([ms, priceAt(code, ms)], false, (s as any).data.length > WINDOW_SEC * 5);
      const last = priceAt(code, ms);
      const ax = chart.yAxis[0]!;
      dot?.update({ marker: { enabled: false } }, false, false);
      dot = (s as any).data.at(-1);
      dot?.update({ marker: { enabled: true, radius: 4, fillColor: C.fg, lineColor: C.accent, lineWidth: 3 } }, false, false);
      ax.removePlotLine("live");
      ax.addPlotLine({ id: "live", value: last, color: C.accent, width: 1, zIndex: 4,
        label: { text: fmt(last, inst.decimals), align: "right", x: -4, style: { color: C.fg, fontWeight: "bold" } } });
      chart.redraw({ duration: 180, easing: "linear" } as any);
    }, 200);
    return () => { clearInterval(t); chart.destroy(); chartRef.current = null; };
  }, [code, theme]);

  // Strike lines and expiry markers for open trades on this asset.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const C = chartColors();
    const inst = BY_CODE[code]!;
    const ya = chart.yAxis[0]!, xa = chart.xAxis[0]!;
    for (const id of ((ya as any).plotLinesAndBands ?? []).map((p: any) => p.id).filter((i: string) => i?.startsWith("t"))) ya.removePlotLine(id);
    for (const id of ((xa as any).plotLinesAndBands ?? []).map((p: any) => p.id).filter((i: string) => i?.startsWith("x"))) xa.removePlotLine(id);
    for (const t of open.filter((t) => t.code === code)) {
      const c = t.direction === "CALL" ? C.up : C.down;
      ya.addPlotLine({ id: `t${t.id}`, value: t.strike, color: c, width: 2, dashStyle: "ShortDash", zIndex: 5,
        label: { text: `${t.direction === "CALL" ? "▲" : "▼"} ${money(t.amount)} @ ${fmt(t.strike, inst.decimals)}`, style: { color: c } } });
      xa.addPlotLine({ id: `x${t.id}`, value: t.expire_time, color: c, width: 1, dashStyle: "Dot", zIndex: 5,
        label: { text: "expiry", rotation: 0, style: { color: c, fontSize: "10px" } } });
    }
    // keep the next expiry in view
    const maxExp = Math.max(0, ...open.filter((t) => t.code === code).map((t) => t.expire_time));
    xa.setExtremes(undefined, maxExp ? maxExp + 5000 : undefined, true, false);
  }, [open, code, theme]);

  return <div ref={el} className="chart-box" />;
}

export function BinaryTerminal({ code }: { code: string }) {
  const inst = BY_CODE[code]!;
  const now = useNow(250);
  const price = priceAt(code, now);
  // Stake as typed, in the display currency; converted to USD when the trade is sent.
  const cur = useCurrency();
  const [amount, setAmount] = useState(() => (currency() === "MYR" ? 500 : 100));
  useEffect(() => setAmount(cur === "MYR" ? 500 : 100), [cur]);
  const chips = cur === "MYR" ? [50, 100, 500, 1000, 5000] : [10, 50, 100, 500, 1000];
  const [expiry, setExpiry] = useState(60);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const seen = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    const [t, a] = await Promise.all([api<{ data: Trade[] }>("/api/binary/trades"), api("/api/trd/accinfo")]);
    // announce trades that settled since the last poll
    for (const x of t.data) {
      if (x.status !== "OPEN" && seen.current.has(x.id)) {
        seen.current.delete(x.id);
        setToast({ ok: (x.profit ?? 0) >= 0, text: x.status === "WON" ? `Won ${money(x.profit!)} on ${x.code}` : x.status === "TIE" ? `Tie on ${x.code} — refunded` : `Lost ${money(x.amount)} on ${x.code}` });
      }
      if (x.status === "OPEN") seen.current.add(x.id);
    }
    setTrades(t.data); setBalance(a.binary.balance);
  }, []);
  useEffect(() => { refresh().catch(() => {}); const t = setInterval(() => refresh().catch(() => {}), 2000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const open = trades.filter((t) => t.status === "OPEN");
  const closed = trades.filter((t) => t.status !== "OPEN");

  async function place(direction: "CALL" | "PUT") {
    try {
      const r = await api<{ data: Trade }>("/api/binary/trades", { body: { code, direction, amount: toUSD(amount), expiry } });
      seen.current.add(r.data.id);
      setTrades((ts) => [r.data, ...ts]);
      setBalance((b) => (b ?? 0) - toUSD(amount));
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); }
  }

  return (
    <div className="row g-2">
      <div className="col-xl-9">
        <div className="panel p-2 position-relative">
          <div className="d-flex flex-wrap align-items-baseline gap-3 px-2 pt-1">
            <AssetIcon code={code} size={28} /> <span className="h5 mb-0 fw-bold">{inst.name}</span>
            <span className="text-secondary small">{code}</span>
            <span className="h4 mb-0 tabular">{fmt(price, inst.decimals)}</span>
            <span className="badge text-bg-success ms-auto">Profit {Math.round(inst.payout * 100)}%</span>
          </div>
          <BinaryChart code={code} open={open} />
          {toast && (
            <div className={`position-absolute top-0 start-50 translate-middle-x mt-5 px-3 py-2 rounded fw-semibold ${toast.ok ? "btn-up" : "btn-down"}`} style={{ zIndex: 10 }}>{toast.text}</div>
          )}
        </div>
        <div className="panel mt-2 table-responsive">
          <table className="table table-sm table-hover mb-0 small-table tabular">
            <thead><tr><th>Asset</th><th>Dir</th><th className="text-end">Amount</th><th className="text-end">Strike</th><th className="text-end">Close</th><th>Time</th><th className="text-end">Result</th></tr></thead>
            <tbody>
              {open.map((t) => {
                const cur = priceAt(t.code, Math.min(now, t.expire_time));
                const winning = t.direction === "CALL" ? cur > t.strike : cur < t.strike;
                const left = Math.max(0, Math.ceil((t.expire_time - now) / 1000));
                return (
                  <tr key={t.id}>
                    <td>{t.code}</td>
                    <td className={t.direction === "CALL" ? "text-up" : "text-down"}>{t.direction === "CALL" ? "▲ Higher" : "▼ Lower"}</td>
                    <td className="text-end">{money(t.amount)}</td><td className="text-end">{fmt(t.strike, BY_CODE[t.code]!.decimals)}</td>
                    <td className="text-end">{fmt(cur, BY_CODE[t.code]!.decimals)}</td>
                    <td><span className="badge text-bg-info">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "settling…"}</span></td>
                    <td className={`text-end ${winning ? "text-up" : "text-down"}`}>{winning ? `+${money(t.amount * t.payout)}` : `-${money(t.amount)}`}</td>
                  </tr>
                );
              })}
              {closed.slice(0, 30).map((t) => (
                <tr key={t.id} className="opacity-75">
                  <td>{t.code}</td>
                  <td className={t.direction === "CALL" ? "text-up" : "text-down"}>{t.direction === "CALL" ? "▲ Higher" : "▼ Lower"}</td>
                  <td className="text-end">{money(t.amount)}</td><td className="text-end">{fmt(t.strike, BY_CODE[t.code]!.decimals)}</td>
                  <td className="text-end">{t.close_price != null ? fmt(t.close_price, BY_CODE[t.code]!.decimals) : "—"}</td>
                  <td>{new Date(t.expire_time).toLocaleTimeString()}</td>
                  <td className={`text-end ${(t.profit ?? 0) > 0 ? "text-up" : (t.profit ?? 0) < 0 ? "text-down" : ""}`}>{t.status} {money(t.profit ?? 0)}</td>
                </tr>
              ))}
              {!trades.length && <tr><td colSpan={7} className="text-center text-secondary py-3">No trades yet — pick Higher or Lower</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="col-xl-3">
        <div className="panel p-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="small text-secondary">Practice account</span>
            <button className="btn btn-link btn-sm p-0 text-secondary" onClick={() => confirm(`Reset practice balance to ${money(10_000)}?`) && api("/api/reset", { body: { account: "BINARY" } }).then(() => { seen.current.clear(); refresh(); })}>Refill</button>
          </div>
          <div className="h3 tabular text-warning mb-3">{balance != null ? money(balance) : "—"}</div>

          <label className="form-label small text-secondary mb-1">Amount</label>
          <div className="input-group mb-2">
            <button className="btn btn-outline-secondary" onClick={() => setAmount((a) => Math.max(1, a - (a > 100 ? 50 : 10)))}>−</button>
            <span className="input-group-text">{symbol()}</span>
            <input className="form-control text-center tabular" type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} />
            <button className="btn btn-outline-secondary" onClick={() => setAmount((a) => a + (a >= 100 ? 50 : 10))}>+</button>
          </div>
          <div className="d-flex gap-1 mb-3 flex-wrap">
            {chips.map((v) => <button key={v} className="btn btn-sm btn-outline-secondary flex-fill py-0" onClick={() => setAmount(v)}>{symbol()}{v}</button>)}
          </div>

          <label className="form-label small text-secondary mb-1">Expiration</label>
          <div className="btn-group w-100 mb-3">
            {EXPIRIES.map(([s, l]) => <button key={s} className={`btn btn-sm ${expiry === s ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setExpiry(s)}>{l}</button>)}
          </div>

          <div className="d-flex justify-content-between small mb-3">
            <span className="text-secondary">Profit if correct</span>
            <span className="text-up tabular fw-semibold">+{money(toUSD(amount) * inst.payout)}</span>
          </div>
          {(() => {
            const e = binaryEconomics(toUSD(amount), inst.payout);
            return (
              <div className="cost-preview small mb-3">
                <div className="d-flex justify-content-between"><span className="text-secondary">Loss if wrong</span><span className="tabular text-down">−{money(e.lossAmount)}</span></div>
                <div className="d-flex justify-content-between"><span className="text-secondary">Break-even win rate</span><span className="tabular fw-semibold">{(e.breakEvenWin * 100).toFixed(1)}%</span></div>
                <div className="d-flex justify-content-between" title="Expected result per trade if you win half the time"><span className="text-secondary">Expected value at 50% wins</span><span className="tabular text-down">{money(e.evAt(0.5))}</span></div>
                <div className="text-secondary mt-1" style={{ fontSize: ".68rem" }}>Fixed-payout contract: win {Math.round(inst.payout * 100)}% of the stake or lose all of it. You must win more than {(e.breakEvenWin * 100).toFixed(1)}% of trades just to break even. Not a moomoo product.</div>
              </div>
            );
          })()}

          <button className="btn btn-up w-100 bigbtn mb-2" onClick={() => place("CALL")}>▲ Higher</button>
          <button className="btn btn-down w-100 bigbtn" onClick={() => place("PUT")}>▼ Lower</button>
          <div className="text-secondary mt-3" style={{ fontSize: ".7rem" }}>
            Practice mode · virtual funds. Settles at the simulated price at expiry; equal price refunds.
          </div>
        </div>
      </div>
    </div>
  );
}
