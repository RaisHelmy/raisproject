import { useEffect, useState } from "react";
import { priceAt } from "../shared/market";

// Display currency. Accounts are kept in USD on the server; amounts are converted for display at
// the simulated USD/MYR rate (refreshed once a minute so numbers and inputs don't jitter).

export type Currency = "MYR" | "USD";
const KEY = "rt.currency";
let cur: Currency = (() => { try { return localStorage.getItem(KEY) === "USD" ? "USD" : "MYR"; } catch { return "MYR"; } })();
let rateMin = -1, rateVal = 4.31;

/** MYR per 1 USD (or 1 when showing USD). */
export function rate(): number {
  if (cur === "USD") return 1;
  const m = Math.floor(Date.now() / 60_000);
  if (m !== rateMin) { rateMin = m; rateVal = priceAt("FX.USDMYR", m * 60_000); }
  return rateVal;
}
export const currency = () => cur;
export const symbol = () => (cur === "MYR" ? "RM" : "$");
/** USD → display currency. */
export const fromUSD = (v: number) => v * rate();
/** Display currency → USD (rounded to cents). */
export const toUSD = (v: number) => Math.round((v / rate()) * 100) / 100;

export function setCurrency(c: Currency) {
  cur = c;
  try { localStorage.setItem(KEY, c); } catch { /* ignore */ }
  window.dispatchEvent(new Event("rt:currency"));
}

/** Re-renders the caller when the currency is switched. */
export function useCurrency(): Currency {
  const [c, setC] = useState(cur);
  useEffect(() => {
    const on = () => setC(cur);
    window.addEventListener("rt:currency", on);
    return () => window.removeEventListener("rt:currency", on);
  }, []);
  return c;
}

export function CurrencyToggle() {
  const c = useCurrency();
  return (
    <button className="icon-btn px-2 fw-semibold" style={{ width: "auto", fontSize: ".8rem" }}
      title={`Showing ${c}. Switch to ${c === "MYR" ? "USD" : "MYR"}${c === "MYR" ? "" : ` (1 USD ≈ RM ${priceAt("FX.USDMYR", Date.now()).toFixed(2)})`}`}
      onClick={() => setCurrency(c === "MYR" ? "USD" : "MYR")}>
      {c === "MYR" ? "RM" : "US$"}
    </button>
  );
}
