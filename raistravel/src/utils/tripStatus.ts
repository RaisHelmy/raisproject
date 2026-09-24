import type { TripStatus } from '../types'

export const STATUS_META: Record<TripStatus, { label: string; class: string }> = {
  planning: { label: 'Planning', class: 'text-bg-secondary' },
  ready: { label: 'Ready to book', class: 'text-bg-info' },
  booked: { label: 'Booked', class: 'text-bg-primary' },
  traveling: { label: 'Traveling', class: 'text-bg-warning' },
  completed: { label: 'Completed', class: 'text-bg-success' },
}
