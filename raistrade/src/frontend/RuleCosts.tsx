import { BY_CODE, priceAt } from "../shared/market";
import { binaryEconomics, estimateCosts } from "../shared/costs";
import { smallestPracticalOrder } from "../shared/fees";
import { MAX_LOSS_STREAK } from "../shared/strategies";
import { money } from "./api";
import type { Rule } from "./AutoTrade";

// "Cost & break-even" panel for a rule: what the rule must achieve just to not lose money, how its
// live record compares, and the minimum size at which trading costs stop eating the profit.

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

/** 95% Wilson interval for a win rate. */
function wilson(w: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const p = w / n, z = 1.96, den = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / den), Math.min(1, (c + m) / den)];
}

function Stat({ label, value, sub, cls }: { label: string; value: React.ReactNode; sub?: React.ReactNode; cls?: string }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="kpi h-100">
        <div className="kpi-l">{label}</div>
        <div className={`kpi-v ${cls ?? ""}`} style={{ fontSize: "1.1rem" }}>{value}</div>
        {sub && <div className="text-secondary" style={{ fontSize: ".7rem" }}>{sub}</div>}
      </div>
    </div>
  );
}

/** Win-rate bar with the break-even line and the 95% range of the true win rate. */
function WinVsBreakEven({ p, be, lo, hi, n }: { p: number; be: number; lo: number; hi: number; n: number }) {
  return (
    <div className="be-bar my-2" title={`Your win rate ${pct(p)} (true rate likely ${pct(lo, 0)}–${pct(hi, 0)}) vs break-even ${pct(be)}`}>
      <div className="be-range" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
      {n > 0 && <div className={`be-you ${p >= be ? "up" : "down"}`} style={{ left: `${p * 100}%` }} />}
      <div className="be-line" style={{ left: `${be * 100}%` }}><span>break-even {pct(be)}</span></div>
    </div>
  );
}

export function RuleCosts({ rule, trades }: { rule: Rule; trades: any[] }) {
  const inst = BY_CODE[rule.code]!;
  const closed = trades.filter((t) => t.status === "WON" || t.status === "LOST");
  const wins = closed.filter((t) => t.status === "WON").length, n = closed.length;
  const p = n ? wins / n : 0;
  const [lo, hi] = wilson(wins, n);
  const winsPnl = closed.filter((t) => t.pnl > 0).map((t) => t.pnl), lossPnl = closed.filter((t) => t.pnl <= 0).map((t) => -t.pnl);
  const avgWin = winsPnl.length ? winsPnl.reduce((a, b) => a + b, 0) / winsPnl.length : 0;
  const avgLoss = lossPnl.length ? lossPnl.reduce((a, b) => a + b, 0) / lossPnl.length : 0;

  let be: number, perTrade: (q: number) => number, items: React.ReactNode, notes: string[] = [];
  if (rule.mode === "BINARY") {
    const stake = rule.amount, e = binaryEconomics(stake, inst.payout);
    be = e.breakEvenWin;
    perTrade = e.evAt;
    const kelly = Math.max(0, lo - (1 - lo) / inst.payout) / 2;
    const streak = rule.money_mgmt === "MARTINGALE" ? stake * (1 + 2 + 4 + 8) : stake * MAX_LOSS_STREAK;
    items = <>
      <Stat label="Break-even win rate" value={pct(be)} sub={`payout ${Math.round(inst.payout * 100)}% · win +${money(e.winAmount)} / lose −${money(stake)}`} />
      <Stat label="Your win rate" value={n ? pct(p) : "—"} cls={!n ? "" : p >= be ? "text-up" : "text-down"} sub={n ? `${wins}W / ${n - wins}L · ${p >= be ? "+" : ""}${((p - be) * 100).toFixed(1)} pts vs break-even` : "no closed trades yet"} />
      <Stat label="Expected per trade" value={n ? money(perTrade(p)) : "—"} cls={n ? (perTrade(p) >= 0 ? "text-up" : "text-down") : ""} sub={n ? `≈ ${money(perTrade(p) * 100)} per 100 trades` : `at 50% wins: ${money(perTrade(0.5))}`} />
      <Stat label={`Cost of ${MAX_LOSS_STREAK} losses in a row`} value={`−${money(streak)}`} cls="text-down" sub={rule.money_mgmt === "MARTINGALE" ? "martingale doubles each loss" : "then the robot auto-stops"} />
    </>;
    notes = [
      "No broker fees on these practice binaries — the cost is built into the payout: you win less than you risk.",
      `Minimum stake is ${money(1)}. Stake size doesn't change the break-even rate; only the win rate does.`,
      n >= 20 && lo > 0 ? `Sensible maximum stake for this record: about ${pct(kelly)} of the balance per trade (half-Kelly at the cautious win rate).` : "",
    ].filter(Boolean);
  } else {
    const px = rule.entry_price ?? priceAt(rule.code, Date.now());
    const c = estimateCosts(rule.code, "BUY", rule.amount, { ts: Date.now() });
    const costPct = c.roundTripPct / 100;
    const minOrder = smallestPracticalOrder(rule.code, px, 1, inst.lot);
    if (rule.take_profit_pct && rule.stop_loss_pct) {
      const w = rule.take_profit_pct / 100 - costPct, l = rule.stop_loss_pct / 100 + costPct;
      be = w > 0 ? l / (w + l) : 1;
    } else be = avgWin + avgLoss > 0 ? avgLoss / (avgWin + avgLoss) : 0.5;
    perTrade = (q) => q * avgWin - (1 - q) * avgLoss;
    items = <>
      <Stat label="Cost per round trip" value={money(c.roundTrip)} sub={`${c.roundTripPct.toFixed(2)}% of ${money(c.notional)} · spread + fees & taxes both ways`} />
      <Stat label="Move needed to break even" value={`+${c.roundTripPct.toFixed(2)}%`} sub={rule.take_profit_pct ? `target ${rule.take_profit_pct}% → ${(rule.take_profit_pct - c.roundTripPct).toFixed(2)}% left after costs` : "before any profit"} cls={rule.take_profit_pct && rule.take_profit_pct <= c.roundTripPct ? "text-down" : ""} />
      <Stat label="Break-even win rate" value={be >= 1 ? "impossible" : pct(be)} cls={be >= 1 ? "text-down" : ""} sub={rule.take_profit_pct && rule.stop_loss_pct ? `with ${rule.stop_loss_pct}% stop / ${rule.take_profit_pct}% target after costs` : "from this rule's average win vs loss"} />
      <Stat label="Minimum order to benefit" value={minOrder ? money(minOrder) : "—"} cls={minOrder && c.notional < minOrder ? "text-down" : "text-up"} sub={minOrder ? (c.notional < minOrder ? `yours is ${money(c.notional)} — costs above 1%` : "your size keeps costs under 1%") : ""} />
    </>;
    notes = [
      `Your win rate: ${n ? `${pct(p)} (${wins}W / ${n - wins}L)` : "no closed trades yet"} · average win ${money(avgWin)}, average loss ${money(avgLoss)} (both after costs).`,
      c.fxNote ?? "",
      `Estimated trading costs paid so far: about ${money(c.roundTrip * n)} over ${n} round trips.`,
    ].filter(Boolean);
  }

  const verdict = !n ? { cls: "mid", text: "No closed trades yet — the record below will fill in as the robot trades." }
    : lo > be ? { cls: "good", text: `Proven profitable: even the cautious win rate (${pct(lo)}) is above break-even (${pct(be)}).` }
    : hi < be ? { cls: "bad", text: `Losing after costs: even the optimistic win rate (${pct(hi)}) is below break-even (${pct(be)}). Consider stopping it.` }
    : (() => {
        const gap = Math.max(0.01, Math.abs(p - be)), need = Math.ceil((1.96 * 1.96 * Math.max(p * (1 - p), 0.05)) / (gap * gap));
        return { cls: "mid", text: `Not proven yet: ${n} trades isn't enough to tell ${pct(p)} from the ${pct(be)} break-even — roughly ${need} trades needed at this gap.` };
      })();

  return (
    <div className="panel p-3 mb-3 rule-costs">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="step-title mb-0">💰 Cost & break-even</div>
        <span className="small text-secondary">{rule.mode === "BINARY" ? "fixed-payout binary" : "stock · moomoo MY fees + spread"}</span>
      </div>
      <div className="row g-2">{items}</div>
      <WinVsBreakEven p={p} be={Math.min(be, 1)} lo={lo} hi={hi} n={n} />
      <div className={`fee-check ${verdict.cls === "good" ? "good" : verdict.cls === "bad" ? "bad" : "mid"} mb-2`}>{verdict.text}</div>
      <ul className="small text-secondary mb-0 ps-3">{notes.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}
