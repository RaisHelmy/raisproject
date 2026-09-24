import type { ProviderStatus } from '../types'
import { timestamp } from '../utils/format'

// Central provider registry. Real API credentials would be configured on a
// backend/Cloudflare Worker; the frontend only ever sees provider status and
// normalized results. In demo mode every provider is served by a mock.

export const DEMO_MODE = true

export const PROVIDERS: ProviderStatus[] = [
  { id: 'booking', name: 'Booking.com', kind: 'accommodation', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '100/min', status: 'demo' },
  { id: 'agoda', name: 'Agoda', kind: 'accommodation', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '100/min', status: 'demo' },
  { id: 'expedia', name: 'Expedia', kind: 'accommodation', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '60/min', status: 'demo' },
  { id: 'flights', name: 'Flight aggregator', kind: 'flight', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '30/min', status: 'demo' },
  { id: 'klook', name: 'Klook (activities)', kind: 'activity', enabled: false, configured: false, demo: false, lastSync: null, rateLimit: '—', status: 'not-configured' },
  { id: 'currency', name: 'Currency rates', kind: 'currency', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '10/min', status: 'demo' },
  { id: 'weather', name: 'Weather API', kind: 'weather', enabled: false, configured: false, demo: false, lastSync: null, rateLimit: '—', status: 'not-configured' },
  { id: 'maps', name: 'Maps & routing', kind: 'maps', enabled: true, configured: false, demo: true, lastSync: timestamp(), rateLimit: '—', status: 'demo' },
]

export function affiliateUrl(provider: string, query: string): string {
  // Placeholder deep links; a production build would append affiliate IDs
  // through a backend redirect so credentials never ship to the client.
  const q = encodeURIComponent(query)
  switch (provider) {
    case 'Booking.com': return `https://www.booking.com/searchresults.html?ss=${q}`
    case 'Agoda': return `https://www.agoda.com/search?city=${q}`
    case 'Expedia': return `https://www.expedia.com.my/Hotel-Search?destination=${q}`
    default: return `https://www.google.com/travel/search?q=${q}`
  }
}

// Simulated network latency so loading states are visible in demo mode.
export function simulateLatency<T>(value: T, ms = 500 + Math.random() * 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
