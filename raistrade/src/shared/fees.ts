// Moomoo Malaysia fee schedule (published schedule, Oct 2026 — moomoo.com/my/pricing).
// Fees are returned in the instrument's price units, the same units the simulated account uses for
// that instrument. Binary options are not a moomoo product and carry no fees.
//
// Markets: US.* and IDX.* → US stocks/ETFs (fractional schedule for qty < 1); HK.* → Hong Kong;
// MY.* → Bursa Malaysia. FX/crypto/commodity instruments have no moomoo MY stock schedule, so they
// are approximated with the US schedule.

import { priceAt } from "./market";

export type FeeKind = "commission" | "platform" | "exchange" | "regulatory" | "tax";
export interface FeeLine { label: string; amount: number; kind: FeeKind }
export interface FeeQuote { market: "US" | "US_FRAC" | "HK" | "MY" | "OTHER"; lines: FeeLine[]; total: number }

const r2 = (v: number) => Math.round(v * 100) / 100;
const usdMyr = (now: number) => priceAt("FX.USDMYR", now);

/** Malaysian stamp duty: RM1 per RM1,000 or part thereof. */
const myStampRM = (valueRM: number) => Math.ceil(valueRM / 1000);

export function marketOf(code: string): FeeQuote["market"] {
  if (code.startsWith("MY.")) return "MY";
  if (code.startsWith("HK.")) return "HK";
  if (code.startsWith("US.") || code.startsWith("IDX.")) return "US";
  return "OTHER";
}

export function quoteFees(code: string, side: "BUY" | "SELL", qty: number, price: number, now = Date.now()): FeeQuote {
  const value = qty * price;
  const lines: FeeLine[] = [];
  let market = marketOf(code);
  const kindOf = (label: string): FeeKind =>
    /commission/i.test(label) ? "commission" : /platform/i.test(label) ? "platform"
      : /stamp|sst/i.test(label) ? "tax" : /sec|finra|cat/i.test(label) ? "regulatory" : "exchange";
  const add = (label: string, amount: number) => amount > 0 && lines.push({ label, amount: r2(amount), kind: kindOf(label) });

  if (market === "MY") {
    const commission = value * 0.0003, platform = 3, clearing = value * 0.0003;
    add("Commission 0.03%", commission);
    add("Platform fee", platform);
    add("Clearing fee 0.03%", clearing);
    add("Stamp duty (RM1 per RM1,000)", myStampRM(value));
    add("SST 8%", (commission + platform + clearing) * 0.08);
  } else if (market === "HK") {
    add("Commission 0.03% (min 3)", Math.max(3, value * 0.0003));
    add("Platform fee", 15);
  } else {
    if (market === "US" && qty < 1) {
      market = "US_FRAC";
      add("Platform fee 0.99% (min 0.01, max 0.99)", Math.max(0.01, Math.min(0.99, value * 0.0099)));
    } else {
      add("Commission 0.03%", value * 0.0003);
      add("Platform fee", 0.99);
      add("Settlement US$0.003/share (max 1%)", Math.min(qty * 0.003, value * 0.01));
      if (side === "SELL") {
        add("SEC fee", Math.max(0.01, value * 0.0000206));
        add("FINRA TAF", Math.min(9.79, Math.max(0.01, qty * 0.000195)));
      }
      add("CAT fee", qty * 0.000003);
    }
    // Malaysian stamp duty also applies to foreign shares bought through moomoo MY.
    const fx = usdMyr(now);
    add("Malaysian stamp duty", myStampRM(value * fx) / fx);
  }
  return { market, lines, total: r2(lines.reduce((s, l) => s + l.amount, 0)) };
}

export const feeTotal = (code: string, side: "BUY" | "SELL", qty: number, price: number, now?: number) => quoteFees(code, side, qty, price, now).total;

/** Price move (in %) needed for a buy + sell round trip at this size to break even after fees. */
export function breakEvenPct(code: string, qty: number, price: number, now?: number): number {
  const fees = feeTotal(code, "BUY", qty, price, now) + feeTotal(code, "SELL", qty, price, now);
  return (fees / (qty * price)) * 100;
}

/** Fee schedule version, stored on every order so old fills stay explainable when the schedule changes. */
export const FEE_SCHEDULE = {
  version: "moomoo-MY-2026-10",
  effective: "2026-10-01",
  source: "https://www.moomoo.com/my/pricing",
  basis: "standard rates; no 180-day commission-free promotion; fees in the instrument's price currency, rounded to 0.01",
};
export const FEE_SOURCE = "moomoo Malaysia published fee schedule (Oct 2026), standard rates — no 180-day commission-free promo";

/** Smallest order value (whole lots) whose buy + sell fees stay under `maxPct` of the order. */
export function smallestPracticalOrder(code: string, price: number, maxPct = 1, lot = 1): number | null {
  for (let q = lot; q * price < 5_000_000; q = q < 10 * lot ? q + lot : Math.ceil((q * 1.25) / lot) * lot) {
    if (breakEvenPct(code, q, price) <= maxPct) return q * price;
  }
  return null;
}
