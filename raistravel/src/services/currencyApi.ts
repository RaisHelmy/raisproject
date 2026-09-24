import { timestamp } from '../utils/format'

// Demo exchange rates (1 MYR = X). A production build would fetch these from
// a currency API via the backend and cache them.
const RATES: Record<string, { rate: number; symbol: string }> = {
  MYR: { rate: 1, symbol: 'RM' },
  USD: { rate: 0.24, symbol: '$' },
  SGD: { rate: 0.31, symbol: 'S$' },
  THB: { rate: 7.7, symbol: '฿' },
  IDR: { rate: 3650, symbol: 'Rp' },
  JPY: { rate: 33.5, symbol: '¥' },
  KRW: { rate: 310, symbol: '₩' },
  TWD: { rate: 7.1, symbol: 'NT$' },
  EUR: { rate: 0.2, symbol: '€' },
  GBP: { rate: 0.17, symbol: '£' },
  HKD: { rate: 1.84, symbol: 'HK$' },
  VND: { rate: 5900, symbol: '₫' },
}

export const RATES_UPDATED_AT = timestamp()

export const SUPPORTED_CURRENCIES = Object.keys(RATES)

export function convertFromMYR(amountMYR: number, currency: string): number {
  const r = RATES[currency]
  if (!r) return amountMYR
  return amountMYR * r.rate
}

export function formatInCurrency(amountMYR: number, currency: string): string {
  const r = RATES[currency] ?? RATES.MYR
  const v = amountMYR * r.rate
  const decimals = v >= 1000 ? 0 : v >= 100 ? 0 : 2
  return `${r.symbol}${v.toLocaleString('en-MY', { maximumFractionDigits: decimals })}`
}
