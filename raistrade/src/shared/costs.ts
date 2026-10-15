// Trade cost engine: everything that separates gross from net profit, for one stock/futures order.
// Components (kept separate so each can be reconciled against the actual fill):
//   • market costs  — bid–ask spread and slippage (MarketCostEstimator)
//   • broker fees   — commission, platform, exchange/clearing, regulatory (fees.ts, moomoo MY adapter)
//   • taxes         — stamp duty, SST (fees.ts)
//   • FX conversion — moomoo quotes its own conversion rate; unknown here, so it is reported as
//                     "not included" rather than silently treated as zero.
// Binary options use a separate model (stake / payout / break-even win rate) — see binaryEconomics.
// The simulated market only has a mid price; bid/ask come from a per-instrument spread model.

import { BY_CODE, priceAt, round } from "./market";
import { FEE_SCHEDULE, quoteFees, type FeeKind } from "./fees";

/** Typical quoted spread in basis points (full spread, ask − bid, as % of mid × 10,000). */
const SPREAD_BPS: Record<string, number> = {
  "US.AAPL": 2, "US.MSFT": 2, "US.NVDA": 2, "US.AMZN": 2, "US.TSLA": 3, "US.MOO": 8,
  "HK.00700": 5, "HK.09988": 6, "MY.MAYBANK": 19,
  "IDX.SPX": 1, "CM.XAUUSD": 2, "CM.WTI": 3,
  "FX.EURUSD": 1, "FX.GBPUSD": 1.5, "FX.USDJPY": 1.5, "FX.USDMYR": 10,
  "CC.BTCUSD": 4, "CC.ETHUSD": 5,
};
export const spreadBps = (code: string) => SPREAD_BPS[code] ?? 5;

export interface Quote { code: string; bid: number; ask: number; mid: number; spread: number; spreadPct: number; ts: number }

/** Executable quote at time `ts`: buys fill at the ask, sells at the bid. */
export function quoteAt(code: string, ts = Date.now()): Quote {
  const d = BY_CODE[code]!.decimals, mid = priceAt(code, ts), half = (mid * spreadBps(code)) / 2e4;
  const tick = 10 ** -d, bid = round(mid - Math.max(half, tick / 2), d), ask = round(mid + Math.max(half, tick / 2), d);
  return { code, bid, ask, mid, spread: round(ask - bid, d + 2), spreadPct: ((ask - bid) / mid) * 100, ts };
}
export const fillPrice = (code: string, side: "BUY" | "SELL", ts = Date.now()) => (side === "BUY" ? quoteAt(code, ts).ask : quoteAt(code, ts).bid);

/** Slippage allowance (fraction of price): half a spread for latency plus size impact (~1 bp per 100k notional). */
export function slippageAllowance(code: string, notional: number) {
  return (spreadBps(code) / 2 + notional / 100_000) / 1e4;
}

export type CostStatus = "estimated" | "confirmed" | "not_included";
export type CostType = "spread" | "slippage" | FeeKind | "fx";
export interface CostLine { type: CostType; label: string; amount: number | null; status: CostStatus; note?: string }

export interface CostBreakdown {
  code: string; side: "BUY" | "SELL"; qty: number; quote: Quote;
  expectedPx: number;          // where the order should fill (ask for buys, bid for sells)
  notional: number;            // qty × expected price
  lines: CostLine[];           // costs of THIS order
  fees: number;                // broker + exchange + regulatory + tax on this order
  totalDebit: number;          // buy: cash taken out (notional + fees). sell: cash received (notional − fees), negative = credit
  roundTrip: number;           // spread + fees on both legs if the position were closed immediately
  roundTripPct: number;
  breakEvenPx: number;         // price the position must reach to cover the round trip (buy side)
  stopLoss?: { pct: number; price: number; loss: number };
  feeSchedule: string;
  fxNote: string | null;
}

const LABEL: Record<FeeKind, string> = { commission: "Commission", platform: "Platform fee", exchange: "Exchange & clearing", regulatory: "Regulatory fees", tax: "Taxes" };

export function estimateCosts(code: string, side: "BUY" | "SELL", qty: number, opts: { limit?: number | null; stopPct?: number | null; ts?: number } = {}): CostBreakdown {
  const ts = opts.ts ?? Date.now(), q = quoteAt(code, ts);
  const expectedPx = opts.limit ?? (side === "BUY" ? q.ask : q.bid);
  const notional = qty * expectedPx;
  const fee = quoteFees(code, side, qty, expectedPx, ts);
  const lines: CostLine[] = [];
  // Half the spread is paid on each leg (vs. the mid price).
  lines.push({ type: "spread", label: `Spread (½ of ${q.spreadPct.toFixed(3)}%)`, amount: opts.limit ? null : (qty * q.spread) / 2, status: opts.limit ? "not_included" : "estimated",
    note: opts.limit ? "limit order — fills at your price or better" : undefined });
  lines.push({ type: "slippage", label: "Slippage allowance", amount: opts.limit ? 0 : notional * slippageAllowance(code, notional), status: "estimated", note: "price may move between quote and fill" });
  const byKind = new Map<FeeKind, number>();
  for (const l of fee.lines) byKind.set(l.kind, (byKind.get(l.kind) ?? 0) + l.amount);
  for (const k of ["commission", "platform", "exchange", "regulatory", "tax"] as FeeKind[])
    if (byKind.has(k)) lines.push({ type: k, label: LABEL[k], amount: round(byKind.get(k)!, 2), status: "estimated" });
  const foreign = !code.startsWith("MY.");
  const fxNote = foreign ? "MYR → USD/HKD conversion uses moomoo's quoted rate; its markup isn't published, so it is not included." : null;
  if (foreign) lines.push({ type: "fx", label: "Currency conversion", amount: null, status: "not_included", note: "quote required — rate set by moomoo" });

  const fees = fee.total;
  const exitPx = side === "BUY" ? q.bid : q.ask;
  const otherLeg = quoteFees(code, side === "BUY" ? "SELL" : "BUY", qty, exitPx, ts).total;
  const roundTrip = qty * q.spread + fees + otherLeg;
  const breakEvenPx = side === "BUY" ? expectedPx + (fees + otherLeg) / qty + (q.ask - q.bid) : expectedPx - (fees + otherLeg) / qty - (q.ask - q.bid);
  const out: CostBreakdown = {
    code, side, qty, quote: q, expectedPx, notional, lines, fees,
    totalDebit: side === "BUY" ? notional + fees : -(notional - fees),
    roundTrip, roundTripPct: notional ? (roundTrip / notional) * 100 : 0, breakEvenPx, feeSchedule: FEE_SCHEDULE.version, fxNote,
  };
  if (opts.stopPct && side === "BUY") {
    const price = expectedPx * (1 - opts.stopPct / 100);
    const sellFee = quoteFees(code, "SELL", qty, price, ts).total;
    out.stopLoss = { pct: opts.stopPct, price, loss: qty * (expectedPx - price) + fees + sellFee };
  }
  return out;
}

// ---------------- Binary options: a different model ----------------

export interface BinaryEconomics { stake: number; payout: number; winAmount: number; lossAmount: number; breakEvenWin: number; evAt: (p: number) => number }
/** Fixed-payout contract: win stake × payout, lose the whole stake. No fees in this simulator. */
export function binaryEconomics(stake: number, payout: number): BinaryEconomics {
  return {
    stake, payout, winAmount: stake * payout, lossAmount: stake,
    breakEvenWin: 1 / (1 + payout),
    evAt: (p) => p * stake * payout - (1 - p) * stake,
  };
}
