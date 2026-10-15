import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts/highstock";
import { BY_CODE, KTYPES, candleAt, klines, snapshot } from "../shared/market";
import { api, fmt, money } from "./api";
import { AssetIcon, useNow } from "./Watchlist";
import { toast } from "./toast";
import { feeTotal, quoteFees, smallestPracticalOrder } from "../shared/fees";
import { MoomooBadge } from "./scope";
import { estimateCosts } from "../shared/costs";
import { CostPreview, FillReport } from "./CostPreview";
import { chartColors, useTheme } from "./theme";

const KLABEL: Record<string, string> = { K_5S: "5s", K_1M: "1m", K_5M: "5m", K_15M: "15m", K_60M: "1h", K_DAY: "1D" };

Highcharts.setOptions({ time: { useUTC: false } as Highcharts.TimeOptions });

function StockChart({ code, ktype }: { code: string; ktype: string }) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const C = chartColors();
    const inst = BY_CODE[code]!;
    const sec = KTYPES[ktype]!;
    const data = klines(code, ktype, 300);
    const chart = Highcharts.stockChart(el.current!, {
      chart: { backgroundColor: "transparent", style: { fontFamily: "inherit" }, animation: { duration: 220 } },
      credits: { enabled: false },
      rangeSelector: { enabled: false },
      navigator: { enabled: true, height: 28, maskFill: C.accent + "1f", series: { color: C.accent } },
      scrollbar: { enabled: false },
      tooltip: { split: false, shared: true, valueDecimals: inst.decimals, backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg } },
      xAxis: { gridLineColor: C.grid, lineColor: C.axis, labels: { style: { color: C.label } } },
      yAxis: [
        { height: "78%", gridLineColor: C.grid, labels: { style: { color: C.label }, align: "left", x: 4 }, opposite: true,
          plotLines: [{ id: "last", value: data.at(-1)![4], color: C.accent, width: 1, dashStyle: "Dash", zIndex: 5,
            label: { text: fmt(data.at(-1)![4], inst.decimals), align: "right", style: { color: C.accent } } }] },
        { top: "80%", height: "20%", gridLineColor: C.grid, labels: { enabled: false }, opposite: true },
      ],
      plotOptions: {
        candlestick: { color: C.down, lineColor: C.down, upColor: C.up, upLineColor: C.up },
        series: { animation: { duration: 400 }, dataGrouping: { enabled: false } },
      },
      series: [
        { type: "candlestick", id: "k", name: code, data: data.map((c) => c.slice(0, 5)) as any },
        { type: "column", name: "Volume", yAxis: 1, data: data.map((c) => ({ x: c[0], y: c[5], color: c[4] >= c[1] ? C.up + "80" : C.down + "80" })) as any },
      ],
    });
    // Live tick: rebuild the forming candle from the local engine every second.
    const t = setInterval(() => {
      const now = Date.now();
      const start = Math.floor(now / (sec * 1000)) * sec * 1000;
      const c = candleAt(code, start, sec, now);
      const k = chart.series[0]!, v = chart.series[1]!;
      const last = k.points?.at(-1) ?? (k as any).data.at(-1);
      const pt = { x: c[0], open: c[1], high: c[2], low: c[3], close: c[4] };
      const vol = { x: c[0], y: c[5], color: c[4] >= c[1] ? C.up + "80" : C.down + "80" };
      if (last && last.x === start) {
        (k as any).data.at(-1).update(pt, false, false);
        (v as any).data.at(-1).update(vol, false, false);
      } else {
        k.addPoint(pt, false, true);
        v.addPoint(vol, false, true);
      }
      const ax = chart.yAxis[0]!;
      ax.removePlotLine("last");
      ax.addPlotLine({ id: "last", value: c[4], color: c[4] >= c[1] ? C.up : C.down, width: 1, dashStyle: "Dash", zIndex: 5,
        label: { text: fmt(c[4], inst.decimals), align: "right", style: { color: c[4] >= c[1] ? C.up : C.down } } });
      chart.redraw({ duration: 220, easing: "easeOutQuad" } as any);
    }, 250);
    return () => { clearInterval(t); chart.destroy(); };
  }, [code, ktype, theme]);
  return <div ref={el} className="chart-box" />;
}

interface Acc {
  stock: { cash: number; market_val: number; total_assets: number; initial: number;
    positions: { code: string; stock_name: string; qty: number; cost_price: number; nominal_price: number; market_val: number; pl_val: number; pl_ratio: number }[] };
}

export function StockTerminal({ code }: { code: string }) {
  const inst = BY_CODE[code]!;
  const now = useNow(250);
  const snap = snapshot(code, now);
  const [ktype, setKtype] = useState("K_1M");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [otype, setOtype] = useState<"MARKET" | "NORMAL">("MARKET");
  const [qty, setQty] = useState(String(inst.lot * (inst.lot < 1 ? 10 : inst.lot >= 100 ? 1 : 10)));
  const [limit, setLimit] = useState("");
  const [acc, setAcc] = useState<Acc | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"pos" | "ord">("pos");

  const refresh = useCallback(async () => {
    const [a, o] = await Promise.all([api<Acc>("/api/trd/accinfo"), api("/api/trd/orders")]);
    setAcc(a); setOrders(o.data);
  }, []);
  useEffect(() => { refresh().catch(() => {}); const t = setInterval(() => refresh().catch(() => {}), 3000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { setLimit(String(snapshot(code).last_price)); setQty(String(inst.lot >= 100 ? inst.lot : inst.lot < 1 ? inst.lot * 10 : 10)); }, [code]);

  const holding = acc?.stock.positions.find((p) => p.code === code);
  const px = otype === "NORMAL" ? Number(limit) || 0 : snap.last_price;
  const est = px * (Number(qty) || 0);
  const qn = Number(qty) || 0;
  const fee = quoteFees(code, side, qn, px);
  const roundTrip = qn ? feeTotal(code, "BUY", qn, px) + feeTotal(code, "SELL", qn, px) : 0;
  const bePct = est ? (roundTrip / est) * 100 : 0;
  const [stopPct, setStopPct] = useState(2);
  const [openOrder, setOpenOrder] = useState<number | null>(null);
  const [maxCostPct, setMaxCostState] = useState(() => { try { return Number(localStorage.getItem("rt.maxCost")) || 2; } catch { return 2; } });
  const setMaxCost = (v: number) => { setMaxCostState(v); try { localStorage.setItem("rt.maxCost", String(v)); } catch { /* ignore */ } };
  const quoteTs = now;
  const costs = estimateCosts(code, side, qn, { limit: otype === "NORMAL" ? Number(limit) || null : null, stopPct: side === "BUY" ? stopPct : null, ts: quoteTs });
  const minPractical = useMemo(() => smallestPracticalOrder(code, px, 1, inst.lot), [code, Math.round(px)]);
  const total = acc?.stock.total_assets ?? 0;

  async function submit() {
    setMsg(null);
    try {
      const body = { code, trd_side: side, order_type: otype, qty: Number(qty), price: otype === "NORMAL" ? Number(limit) : undefined,
        expected_px: costs.expectedPx, quote_ts: quoteTs, max_cost_pct: maxCostPct };
      let r;
      try { r = await api("/api/trd/orders", { body }); }
      catch (e) {
        const x = e as Error & { code?: string };
        if (x.code !== "COST_LIMIT" || !confirm(`${x.message}\n\nPlace the order anyway?`)) throw e;
        r = await api("/api/trd/orders", { body: { ...body, accept_costs: true } });
      }
      toast.ok(`Order #${r.order_id} ${r.status === "FILLED_ALL" ? "filled" : "submitted"}`);
    } catch (e) { toast.err((e as Error).message); }
    refresh();
  }

  const totalPl = acc ? acc.stock.total_assets - acc.stock.initial : 0;
  const filled = orders.filter((o: any) => o.status === "FILLED_ALL");
  const realizedNet = filled.reduce((t: number, o: any) => t + (o.realized_net ?? 0), 0);
  const costsPaid = filled.reduce((t: number, o: any) => t + (o.fee ?? 0) + (o.spread_cost ?? 0) + Math.max(0, o.slippage ?? 0), 0);

  return (
    <div className="row g-2">
      <div className="col-xl-9">
        <div className="panel p-2">
          <div className="d-flex flex-wrap align-items-baseline gap-3 px-2 pt-1">
            <div>
              <AssetIcon code={code} size={28} /> <span className="h5 mb-0 fw-bold align-middle">{code}</span> <span className="text-secondary small">{inst.name}</span> <MoomooBadge code={code} />
            </div>
            <span className={`h4 mb-0 tabular ${snap.change_rate >= 0 ? "text-up" : "text-down"}`}>{fmt(snap.last_price, inst.decimals)}</span>
            <span className={`tabular ${snap.change_rate >= 0 ? "text-up" : "text-down"}`}>
              {snap.change_rate >= 0 ? "+" : ""}{fmt(snap.last_price - snap.prev_close_price, inst.decimals)} ({snap.change_rate.toFixed(2)}%)
            </span>
            <div className="btn-group btn-group-sm ms-auto">
              {Object.keys(KTYPES).map((k) => (
                <button key={k} className={`btn ${k === ktype ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setKtype(k)}>{KLABEL[k]}</button>
              ))}
            </div>
          </div>
          <StockChart code={code} ktype={ktype} />
        </div>
        <div className="panel mt-2">
          <ul className="nav nav-tabs px-2 pt-2">
            <li className="nav-item"><button className={`nav-link ${tab === "pos" ? "active" : ""}`} onClick={() => setTab("pos")}>Positions ({acc?.stock.positions.length ?? 0})</button></li>
            <li className="nav-item"><button className={`nav-link ${tab === "ord" ? "active" : ""}`} onClick={() => setTab("ord")}>Orders</button></li>
          </ul>
          <div className="table-responsive">
            {tab === "pos" ? (
              <table className="table table-sm table-hover mb-0 small-table tabular">
                <thead><tr><th>Code</th><th>Name</th><th className="text-end">Qty</th><th className="text-end">Avg cost</th><th className="text-end">Price</th><th className="text-end">Mkt value</th><th className="text-end">P/L</th></tr></thead>
                <tbody>
                  {acc?.stock.positions.map((p) => (
                    <tr key={p.code}>
                      <td>{p.code}</td><td className="text-secondary">{p.stock_name}</td><td className="text-end">{p.qty}</td>
                      <td className="text-end">{fmt(p.cost_price, BY_CODE[p.code]!.decimals)}</td><td className="text-end">{fmt(p.nominal_price, BY_CODE[p.code]!.decimals)}</td>
                      <td className="text-end">{money(p.market_val)}</td>
                      <td className={`text-end ${p.pl_val >= 0 ? "text-up" : "text-down"}`}>{money(p.pl_val)} ({p.pl_ratio.toFixed(2)}%)</td>
                    </tr>
                  ))}
                  {!acc?.stock.positions.length && <tr><td colSpan={7} className="text-center text-secondary py-3">No positions</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="table table-sm table-hover mb-0 small-table tabular">
                <thead><tr><th>#</th><th>Time</th><th>Code</th><th>Side</th><th>Type</th><th className="text-end">Qty</th><th className="text-end">Price</th><th className="text-end">Filled @</th><th className="text-end">Fee</th><th className="text-end">Net P/L</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <Fragment key={o.id}>
                    <tr role="button" onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)}>
                      <td>{o.id}</td><td>{new Date(o.create_time).toLocaleTimeString()}</td><td>{o.code}</td>
                      <td className={o.trd_side === "BUY" ? "text-up" : "text-down"}>{o.trd_side}</td>
                      <td>{o.order_type === "NORMAL" ? "LIMIT" : "MARKET"}</td><td className="text-end">{o.qty}</td>
                      <td className="text-end">{o.price ?? "—"}</td><td className="text-end">{o.dealt_avg_price ?? "—"}</td><td className="text-end">{o.fee ? money(o.fee) : "—"}</td>
                      <td className={`text-end ${o.realized_net == null ? "" : o.realized_net >= 0 ? "text-up" : "text-down"}`}>{o.realized_net == null ? "—" : money(o.realized_net)}</td>
                      <td><span className={`badge ${o.status === "FILLED_ALL" ? "text-bg-success" : o.status === "SUBMITTED" ? "text-bg-info" : "text-bg-secondary"}`} title={o.remark ?? ""}>{o.status}</span></td>
                      <td>{o.status === "SUBMITTED" && <button className="btn btn-link btn-sm p-0" onClick={() => api(`/api/trd/orders/${o.id}`, { method: "DELETE" }).then(refresh)}>Cancel</button>}</td>
                    </tr>
                    {openOrder === o.id && o.status === "FILLED_ALL" && <tr><td colSpan={12} className="bg-transparent"><FillReport o={o} /></td></tr>}
                    </Fragment>
                  ))}
                  {!orders.length && <tr><td colSpan={12} className="text-center text-secondary py-3">No orders</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="col-xl-3">
        <div className="panel p-3 mb-2">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold">Paper account</span>
            <button className="btn btn-link btn-sm p-0 text-secondary" onClick={() => confirm(`Reset stock demo account to ${money(1_000_000)}?`) && api("/api/reset", { body: { account: "STOCK" } }).then(refresh)}>Reset</button>
          </div>
          <div className="h4 tabular mb-0">{acc ? money(acc.stock.total_assets) : "—"}</div>
          <div className={`small tabular ${totalPl >= 0 ? "text-up" : "text-down"}`}>{acc ? `${totalPl >= 0 ? "+" : ""}${money(totalPl)} all-time` : ""}</div>
          <div className="d-flex justify-content-between small mt-2 text-secondary"><span>Cash</span><span className="tabular">{acc ? money(acc.stock.cash) : "—"}</span></div>
          <div className="d-flex justify-content-between small text-secondary"><span>Market value</span><span className="tabular">{acc ? money(acc.stock.market_val) : "—"}</span></div>
          <div className="d-flex justify-content-between small text-secondary mt-2 pt-2 border-top"><span>Realized net profit</span><span className={`tabular ${realizedNet >= 0 ? "text-up" : "text-down"}`}>{money(realizedNet)}</span></div>
          <div className="d-flex justify-content-between small text-secondary" title="Fees & taxes + spread + slippage on filled orders"><span>Total trading costs paid</span><span className="tabular text-down">−{money(costsPaid)}</span></div>
        </div>

        <div className="panel p-3">
          <div className="btn-group w-100 mb-3">
            <button className={`btn ${side === "BUY" ? "btn-up" : "btn-outline-secondary"}`} onClick={() => setSide("BUY")}>Buy</button>
            <button className={`btn ${side === "SELL" ? "btn-down" : "btn-outline-secondary"}`} onClick={() => setSide("SELL")}>Sell</button>
          </div>
          <label className="form-label small text-secondary mb-1">Order type</label>
          <select className="form-select form-select-sm mb-2" value={otype} onChange={(e) => setOtype(e.target.value as any)}>
            <option value="MARKET">Market</option>
            <option value="NORMAL">Limit</option>
          </select>
          {otype === "NORMAL" && (
            <>
              <label className="form-label small text-secondary mb-1">Limit price</label>
              <input className="form-control form-control-sm mb-2 tabular" type="number" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </>
          )}
          <label className="form-label small text-secondary mb-1">Quantity <span className="opacity-75">(lot {inst.lot})</span></label>
          <div className="input-group input-group-sm mb-2">
            <button className="btn btn-outline-secondary" onClick={() => setQty(String(Math.max(inst.lot, +(Number(qty) - inst.lot).toFixed(6))))}>−</button>
            <input className="form-control tabular text-center" type="number" step={inst.lot} value={qty} onChange={(e) => setQty(e.target.value)} />
            <button className="btn btn-outline-secondary" onClick={() => setQty(String(+(Number(qty) + inst.lot).toFixed(6)))}>+</button>
          </div>
          {holding && side === "SELL" && (
            <button className="btn btn-link btn-sm p-0 mb-2" onClick={() => setQty(String(holding.qty))}>Sell all ({holding.qty})</button>
          )}
          <label className="small text-secondary d-flex align-items-center justify-content-between mb-2">
            <span>Stop-loss % <span className="opacity-75">(for loss preview)</span></span>
            <input className="form-control form-control-sm tabular text-end" style={{ width: 70 }} type="number" step={0.5} min={0} value={stopPct} onChange={(e) => setStopPct(Number(e.target.value))} />
          </label>
          {qn > 0 && <CostPreview c={costs} quoteAge={Date.now() - quoteTs} maxCostPct={maxCostPct} />}
          {qn > 0 && bePct > 2 && <div className="fee-check bad mb-2"><b>⚠ Not practical at this size.</b> {minPractical ? <>Orders of about <b>{money(minPractical)}</b>+ keep round-trip fees under 1%.</> : null}</div>}
          <label className="small text-secondary d-flex align-items-center justify-content-between mb-3">
            <span>My max cost per trade</span>
            <span className="d-flex align-items-center gap-1"><input className="form-control form-control-sm tabular text-end" style={{ width: 60 }} type="number" step={0.5} min={0.1} value={maxCostPct} onChange={(e) => setMaxCost(Number(e.target.value))} />%</span>
          </label>
          {total > 0 && minPractical && total < minPractical * 2 && (
            <div className="fee-check bad mb-3">
              <b>Small budget.</b> Your whole account is {money(total)}. Every order pays a fixed minimum ({fee.market === "MY" ? "RM3 platform fee + RM1 stamp duty" : fee.market === "HK" ? "HKD 15 platform + HKD 3 commission" : "US$0.99 platform fee + RM1 stamp duty"}), so with this budget fees will eat most of any gain. Practice here first; real trading needs roughly {money(minPractical)} per order.
            </div>
          )}
          <button className={`btn w-100 ${side === "BUY" ? "btn-up" : "btn-down"}`} onClick={submit}>
            {side === "BUY" ? "Buy" : "Sell"} {code.split(".")[1]}
          </button>
          {msg && <div className={`small mt-2 ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</div>}
          <div className="text-secondary mt-3" style={{ fontSize: ".7rem" }}>
            moomoo OpenAPI demo · trd_env=SIMULATE · prices from the local simulated market
          </div>
        </div>
      </div>
    </div>
  );
}
