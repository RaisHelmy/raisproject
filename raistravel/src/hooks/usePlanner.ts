import type { PlannerInput } from '../types'
import { createStore } from './store'

export const DEFAULT_INPUT: PlannerInput = {
  mode: 'destination',
  origin: 'kuala-lumpur',
  stops: [],
  days: 5,
  flexibleDates: true,
  startDate: undefined,
  travellers: { adults: 2, children: 0, infants: 0 },
  groupType: 'couple',
  style: 'value',
  weights: { food: 60, hotel: 50, activities: 50, transport: 50 },
  budget: 3000,
  budgetMode: 'total',
  interests: [],
  transportPreference: 'best',
  vehicleId: 'sedan',
  muslimFriendly: false,
}

interface PlannerState {
  input: PlannerInput
  displayCurrency: string
}

const store = createStore<PlannerState>(
  { input: DEFAULT_INPUT, displayCurrency: 'MYR' },
  'raistravel.planner',
)

export function usePlanner(): PlannerState {
  return store.useStore()
}

export function updateInput(patch: Partial<PlannerInput>) {
  store.set((prev) => ({ ...prev, input: { ...prev.input, ...patch } }))
}

export function resetInput(input: PlannerInput = DEFAULT_INPUT) {
  store.set((prev) => ({ ...prev, input }))
}

export function setDisplayCurrency(currency: string) {
  store.set({ displayCurrency: currency })
}

export function getInput(): PlannerInput {
  return store.get().input
}

// ---------- Share links ----------

export function encodeInput(input: PlannerInput): string {
  return btoa(encodeURIComponent(JSON.stringify(input)))
}

export function decodeInput(encoded: string): PlannerInput | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(encoded)))
    return { ...DEFAULT_INPUT, ...parsed }
  } catch {
    return null
  }
}
