/**
 * Customer money is integer sen (MYR × 100). Provider money is integer micro-USD.
 * Never use floats for stored amounts.
 */
export type Sen = number;
export type MicroUsd = number;

export const CURRENCY = "MYR" as const;

export function sen(amountMyr: number): Sen {
  return Math.round(amountMyr * 100);
}

export function formatMYR(amount: Sen): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}RM${whole.toLocaleString("en-MY")}.${frac.toString().padStart(2, "0")}`;
}

export function usdToSen(microUsd: MicroUsd, fxUsdMyr: number): Sen {
  return Math.ceil((microUsd / 1_000_000) * fxUsdMyr * 100);
}

/** Round up to the nearest multiple of `step` sen (step <= 0 means no rounding). */
export function roundUpSen(amount: Sen, step: Sen): Sen {
  if (step <= 0) return amount;
  return Math.ceil(amount / step) * step;
}
