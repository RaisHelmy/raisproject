/**
 * Currency normalization to MYR for consolidated views.
 * Static demo rates — replace with a rates feed when going live; every
 * consumer goes through toMYR() so that swap is one function.
 */
const RATES_TO_MYR: Record<string, number> = {
  MYR: 1,
  USD: 4.3,
  SGD: 3.3,
  EUR: 4.7,
  GBP: 5.5,
};

export function toMYR(amount: number, currency: string): number {
  const rate = RATES_TO_MYR[currency.toUpperCase()] ?? 1;
  return amount * rate;
}
