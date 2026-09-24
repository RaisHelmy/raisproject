import type { PriceConfidence } from '../types'
import { timeAgo } from '../utils/format'

const CONFIDENCE_LABEL: Record<PriceConfidence, string> = {
  live: 'Live price',
  estimated: 'Estimated',
  historical: 'Historical average',
}

const CONFIDENCE_TITLE: Record<PriceConfidence, string> = {
  live: 'Fetched from the provider just now. Prices may still change at booking.',
  estimated: 'Estimated based on typical prices for this destination. Not a live quote.',
  historical: 'Based on historical averages. Actual prices vary.',
}

export function ConfidenceBadge({ confidence, updatedAt }: { confidence: PriceConfidence; updatedAt?: string }) {
  return (
    <span
      className="rt-muted small"
      title={CONFIDENCE_TITLE[confidence]}
      role="note"
      aria-label={CONFIDENCE_LABEL[confidence]}
    >
      <span className={`rt-dot ${confidence}`} aria-hidden="true" />
      {CONFIDENCE_LABEL[confidence]}
      {confidence === 'live' && updatedAt ? ` · ${timeAgo(updatedAt)}` : ''}
    </span>
  )
}

export function ProviderBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    'Booking.com': '#003b95',
    Agoda: '#c8326b',
    Expedia: '#191e3b',
    AirAsia: '#e30613',
    'Malaysia Airlines': '#003876',
    'Batik Air': '#d3202f',
    Firefly: '#f36f21',
  }
  const color = colors[name] ?? '#5c6f6b'
  return (
    <span
      className="badge"
      style={{ background: `${color}14`, color, fontWeight: 700, border: `1px solid ${color}30` }}
    >
      {name}
    </span>
  )
}

export function DemoPill() {
  return <span className="rt-demo-pill" title="This screen uses realistic demo data — no live provider is connected.">Demo data</span>
}

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="text-warning" aria-label={`${value} out of ${max} stars`} style={{ letterSpacing: 1 }}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={`bi ${i < Math.round(value) ? 'bi-star-fill' : 'bi-star'}`} aria-hidden="true" />
      ))}
    </span>
  )
}
