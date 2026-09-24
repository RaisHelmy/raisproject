import type { Expense, PlannerInput, PriceAlert, SavedTrip, TravelStyle, TripStatus } from '../types'
import type { CostBreakdown } from '../types'
import { uid, timestamp } from '../utils/format'
import { createStore } from './store'

interface TripsState {
  trips: SavedTrip[]
  alerts: PriceAlert[]
}

const store = createStore<TripsState>({ trips: [], alerts: [] }, 'raistravel.trips')

export function useTrips(): TripsState {
  return store.useStore()
}

const DEFAULT_CHECKLIST: { label: string; group: string }[] = [
  { label: 'Passport / MyKad', group: 'Documents' },
  { label: 'Hotel bookings confirmed', group: 'Documents' },
  { label: 'Transport tickets', group: 'Documents' },
  { label: 'Travel insurance', group: 'Documents' },
  { label: 'Cash & cards', group: 'Money' },
  { label: 'Phone chargers & power bank', group: 'Electronics' },
  { label: 'Personal medication', group: 'Medicine' },
  { label: 'Weather-appropriate clothes', group: 'Packing' },
]

export function saveTrip(
  name: string,
  input: PlannerInput,
  tier: TravelStyle,
  breakdown: CostBreakdown,
  companions: string[] = [],
): SavedTrip {
  const trip: SavedTrip = {
    id: uid(),
    name,
    createdAt: timestamp(),
    status: 'planning',
    input,
    chosenTier: tier,
    estimatedTotal: breakdown.total,
    estimatedBreakdown: {
      transport: breakdown.transport,
      accommodation: breakdown.accommodation,
      food: breakdown.food,
      activities: breakdown.activities,
      other: breakdown.other,
      contingency: breakdown.contingency,
      total: breakdown.total,
    },
    companions: companions.length > 0 ? companions : ['Me'],
    expenses: [],
    checklist: DEFAULT_CHECKLIST.map((c) => ({ id: uid(), label: c.label, done: false, group: c.group })),
  }
  store.set((prev) => ({ ...prev, trips: [trip, ...prev.trips] }))
  return trip
}

export function updateTrip(id: string, patch: Partial<SavedTrip>) {
  store.set((prev) => ({
    ...prev,
    trips: prev.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }))
}

export function deleteTrip(id: string) {
  store.set((prev) => ({ ...prev, trips: prev.trips.filter((t) => t.id !== id) }))
}

export function getTrip(id: string): SavedTrip | undefined {
  return store.get().trips.find((t) => t.id === id)
}

export function setTripStatus(id: string, status: TripStatus) {
  updateTrip(id, { status })
}

export function addExpense(tripId: string, expense: Omit<Expense, 'id'>) {
  const trip = getTrip(tripId)
  if (!trip) return
  updateTrip(tripId, { expenses: [...trip.expenses, { ...expense, id: uid() }] })
}

export function removeExpense(tripId: string, expenseId: string) {
  const trip = getTrip(tripId)
  if (!trip) return
  updateTrip(tripId, { expenses: trip.expenses.filter((e) => e.id !== expenseId) })
}

export function toggleChecklistItem(tripId: string, itemId: string) {
  const trip = getTrip(tripId)
  if (!trip) return
  updateTrip(tripId, {
    checklist: trip.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
  })
}

export function addChecklistItem(tripId: string, label: string, group: string) {
  const trip = getTrip(tripId)
  if (!trip) return
  updateTrip(tripId, { checklist: [...trip.checklist, { id: uid(), label, done: false, group }] })
}

// ---------- Price alerts ----------

export function addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt' | 'active'>) {
  store.set((prev) => ({
    ...prev,
    alerts: [{ ...alert, id: uid(), createdAt: timestamp(), active: true }, ...prev.alerts],
  }))
}

export function toggleAlert(id: string) {
  store.set((prev) => ({
    ...prev,
    alerts: prev.alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
  }))
}

export function removeAlert(id: string) {
  store.set((prev) => ({ ...prev, alerts: prev.alerts.filter((a) => a.id !== id) }))
}

// ---------- Group expense settlement ----------

export interface Settlement { from: string; to: string; amount: number }

export function computeSettlement(companions: string[], expenses: Expense[]): Settlement[] {
  if (companions.length < 2) return []
  const paid: Record<string, number> = Object.fromEntries(companions.map((c) => [c, 0]))
  let total = 0
  for (const e of expenses) {
    if (paid[e.paidBy] === undefined) continue
    paid[e.paidBy] += e.amount
    total += e.amount
  }
  const share = total / companions.length
  const balances = companions.map((c) => ({ name: c, balance: paid[c] - share }))
  const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance)
  const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance)
  const out: Settlement[] = []
  let di = 0, ci = 0
  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(-debtors[di].balance, creditors[ci].balance)
    out.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(amount * 100) / 100 })
    debtors[di].balance += amount
    creditors[ci].balance -= amount
    if (debtors[di].balance > -0.01) di++
    if (creditors[ci].balance < 0.01) ci++
  }
  return out
}
