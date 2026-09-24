import type { PlannerInput, SavingSuggestion, TravelStyle } from '../../types'
import { computeBreakdown, TIER_ORDER, totalBudget } from './engine'

// Smart cost optimizer: when the selected plan exceeds budget, propose concrete
// changes and the savings each one unlocks. Each suggestion carries the input
// patch so "Apply" can recalculate the whole trip.

export function suggestSavings(input: PlannerInput, tier: TravelStyle): SavingSuggestion[] {
  const budget = totalBudget(input)
  const current = computeBreakdown(input, tier).breakdown.total
  const over = current - budget
  if (budget <= 0 || over <= 0) return []

  const suggestions: SavingSuggestion[] = []

  // 1. Step down the hotel tier
  const tierIdx = TIER_ORDER.indexOf(tier)
  if (tierIdx > 0) {
    const lower = TIER_ORDER[tierIdx - 1]
    const lowered = computeBreakdown({ ...input, style: lower }, lower).breakdown.total
    const saving = current - lowered
    if (saving > 0) {
      suggestions.push({
        id: 'lower-tier',
        label: `Switch to ${lower === 'budget' ? 'budget' : lower} hotels & dining`,
        detail: `Move the whole plan down one tier — simpler hotels and more local food.`,
        saving: Math.round(saving),
        apply: { style: lower },
      })
    }
  }

  // 2. Change transport mode
  if (input.transportPreference !== 'public') {
    const publicVersion = computeBreakdown({ ...input, transportPreference: 'public' }, tier).breakdown.total
    const saving = current - publicVersion
    if (saving > 30) {
      suggestions.push({
        id: 'go-public',
        label: 'Use buses & trains instead',
        detail: 'Intercity buses and ETS trains are slower but far cheaper than driving or flying.',
        saving: Math.round(saving),
        apply: { transportPreference: 'public' },
      })
    }
  }
  if (input.transportPreference === 'fly') {
    const driveVersion = computeBreakdown({ ...input, transportPreference: 'drive' }, tier).breakdown.total
    const saving = current - driveVersion
    if (saving > 30) {
      suggestions.push({
        id: 'drive-instead',
        label: 'Drive instead of flying',
        detail: 'Share fuel and tolls across the group instead of paying per-person fares.',
        saving: Math.round(saving),
        apply: { transportPreference: 'drive' },
      })
    }
  }

  // 3. Shorten the trip by one day
  if (input.days > 3) {
    const shorter = computeBreakdown({ ...input, days: input.days - 1 }, tier).breakdown.total
    const saving = current - shorter
    if (saving > 0) {
      suggestions.push({
        id: 'one-day-less',
        label: `Shorten the trip to ${input.days - 1} days`,
        detail: 'One fewer night of accommodation, food and activities.',
        saving: Math.round(saving),
        apply: { days: input.days - 1 },
      })
    }
  }

  // 4. Drop the furthest / most expensive stop
  if (input.stops.length > 1) {
    let bestSaving = 0
    let dropId = ''
    for (const stop of input.stops) {
      const without = computeBreakdown({ ...input, stops: input.stops.filter((s) => s !== stop) }, tier).breakdown.total
      const saving = current - without
      if (saving > bestSaving) {
        bestSaving = saving
        dropId = stop
      }
    }
    if (bestSaving > 0 && dropId) {
      suggestions.push({
        id: `drop-${dropId}`,
        label: `Skip one stop this trip`,
        detail: `Removing the most expensive stop shortens travel legs and cuts a hotel change.`,
        saving: Math.round(bestSaving),
        apply: { stops: input.stops.filter((s) => s !== dropId) },
      })
    }
  }

  return suggestions.sort((a, b) => b.saving - a.saving).slice(0, 4)
}
