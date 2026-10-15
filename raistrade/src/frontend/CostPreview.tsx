import type { CostBreakdown, CostLine } from "../shared/costs";
import { BY_CODE } from "../shared/market";
import { fmt, money } from "./api";

const STATUS: Record<CostLine["status"], { label: string; cls: string }> = {
  estimated: { label: "estimate", cls: "text-bg-secondary" },
  confirmed: { label: "confirmed", cls: "text-bg-success" },
  not_included: { label: "not included", cls: "text-bg-warning" },
};

function Row({ label, value, strong, cls, sub }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; cls?: string; sub?: string }) {
  return (
    <div className={`d-flex justify-content-between align-items-baseline gap-2 ${strong ? "fw-semibold" : ""}`}>
      <span className="text-secondary">{label}{sub && <span className="d-block" style={{ fontSize: ".68rem" }}>{sub}</span>}</span>
      <span className={`tabular text-end ${cls ?? ""}`}>{value}</span>
    </div>
  );
}

/** Trade preview: quote, every cost line (with estimate / not-included labels), totals and break-even. */
export function CostPreview({ c, quoteAge, maxCostPct }: { c: CostBreakdown; quoteAge: number; maxCostPct: number }) {
  const d = BY_CODE[c.code]!.decimals;
  const stale = quoteAge > 15_000;
  const over = c.side === "BUY" && c.roundTripPct > maxCostPct;
  return (
    <div className="cost-preview small mb-2">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="step-title mb-0">Trade preview</span>
        <span className={stale ? "text-down" : "text-secondary"} style={{ fontSize: ".7rem" }}>
          {stale ? "⚠ quote stale — refresh" : <><span className="live-dot" style={{ width: 6, height: 6 }} /> quote live</>}
        </span>
      </div>
      <div className="cost-quote mb-2">
        <div><span>Bid</span><b>{fmt(c.quote.bid, d)}</b></div>
        <div><span>Ask</span><b>{fmt(c.quote.ask, d)}</b></div>
        <div><span>Spread</span><b>{fmt(c.quote.spread, d)} <span className="text-secondary fw-normal">({c.quote.spreadPct.toFixed(3)}%)</span></b></div>
      </div>
      <Row label={`Expected ${c.side === "BUY" ? "entry" : "exit"} price`} value={fmt(c.expectedPx, d)} sub={c.side === "BUY" ? "buys fill at the ask" : "sells fill at the bid"} />
      <Row label="Order value" value={money(c.notional)} />
      <div className="cost-lines my-1">
        {c.lines.map((l) => (
          <div key={l.type} className="d-flex justify-content-between align-items-center gap-2" title={l.note}>
            <span className="text-secondary">{l.label} <span className={`badge ${STATUS[l.status].cls}`} style={{ fontSize: ".58rem" }}>{STATUS[l.status].label}</span></span>
            <span className="tabular">{l.amount == null ? "—" : money(l.amount)}</span>
          </div>
        ))}
      </div>
      <Row strong label={c.side === "BUY" ? "Total debit" : "Net proceeds"} value={money(Math.abs(c.totalDebit))} sub={c.side === "BUY" ? "order value + fees & taxes" : "order value − fees & taxes"} />
      <hr className="my-2" />
      <Row label="Cost to close immediately" value={`${money(c.roundTrip)} · ${c.roundTripPct.toFixed(2)}%`} cls={c.roundTripPct > maxCostPct ? "text-down" : ""} sub="spread + fees on both legs" />
      <Row label="Break-even price" value={`${fmt(c.breakEvenPx, d)} (${c.side === "BUY" ? "+" : "−"}${(Math.abs(c.breakEvenPx - c.expectedPx) / c.expectedPx * 100).toFixed(2)}%)`} />
      {c.stopLoss && <Row label={`Loss if stop hit (−${c.stopLoss.pct}%)`} value={`−${money(c.stopLoss.loss)}`} cls="text-down" sub={`stop at ${fmt(c.stopLoss.price, d)}, incl. fees`} />}
      {c.fxNote && <div className="text-secondary mt-1" style={{ fontSize: ".68rem" }}>💱 {c.fxNote}</div>}
      {over && <div className="fee-check bad mt-2">Costs {c.roundTripPct.toFixed(2)}% exceed your {maxCostPct}% limit — you'll be asked to confirm.</div>}
      <div className="text-secondary mt-1" style={{ fontSize: ".66rem" }}>Estimates, not guaranteed execution prices · fee schedule {c.feeSchedule}</div>
    </div>
  );
}

/** After execution: estimated vs. actual for one filled order. */
export function FillReport({ o }: { o: any }) {
  const d = BY_CODE[o.code]?.decimals ?? 2;
  const lines: { label: string; amount: number; kind: string }[] = o.costs ? JSON.parse(o.costs) : [];
  return (
    <div className="fill-report small">
      <div className="row g-3">
        <div className="col-md-4">
          <div className="step-title">Execution</div>
          <Row label="Expected price" value={o.expected_px != null ? fmt(o.expected_px, d) : "—"} />
          <Row label="Actual fill" value={o.dealt_avg_price != null ? fmt(o.dealt_avg_price, d) : "—"} />
          <Row label="Slippage" value={o.slippage != null ? `${o.slippage > 0 ? "−" : o.slippage < 0 ? "+" : ""}${money(Math.abs(o.slippage))}` : "—"} cls={o.slippage > 0 ? "text-down" : o.slippage < 0 ? "text-up" : ""} sub="vs. the price you saw" />
          <Row label="Spread paid" value={o.spread_cost != null ? money(o.spread_cost) : "—"} sub="half the bid–ask spread" />
        </div>
        <div className="col-md-4">
          <div className="step-title">Fees & taxes (confirmed)</div>
          {lines.length ? lines.map((l) => <Row key={l.label} label={l.label} value={money(l.amount)} />) : <span className="text-secondary">—</span>}
          <Row strong label="Total" value={money(o.fee ?? 0)} />
        </div>
        <div className="col-md-4">
          <div className="step-title">Result</div>
          {o.realized_gross != null ? <>
            <Row label="Gross profit" value={money(o.realized_gross)} cls={o.realized_gross >= 0 ? "text-up" : "text-down"} sub="price change only" />
            <Row label="All costs" value={`−${money(o.realized_gross - o.realized_net)}`} sub="buy + sell fees and taxes" />
            <Row strong label="Net profit" value={money(o.realized_net)} cls={o.realized_net >= 0 ? "text-up" : "text-down"} sub="real profit — spread already in the prices" />
          </> : <span className="text-secondary">{o.trd_side === "BUY" ? "Opening trade — profit is realized when you sell." : "—"}</span>}
          <div className="text-secondary mt-2" style={{ fontSize: ".68rem" }}>Fee schedule {o.fee_version ?? "—"} · quoted {o.quote_ts ? new Date(o.quote_ts).toLocaleTimeString() : "—"} · filled {new Date(o.updated_time).toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}
