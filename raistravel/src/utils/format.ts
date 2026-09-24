export function rm(amount: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 0
  return `RM${amount.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d })}`
}

export function formatMoney(amount: number, currency: string): string {
  if (currency === 'MYR') return rm(amount)
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function timestamp(): string {
  return new Date().toISOString()
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  return `${h}h ago`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function monthNames(months: number[]): string {
  if (months.length === 0) return 'Year-round'
  return months.map((m) => MONTHS[m - 1]).join(', ')
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
