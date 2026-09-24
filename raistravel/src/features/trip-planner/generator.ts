import type {
  ItineraryDay, ItineraryItem, PlannerInput, TravelStyle, TripPlan,
} from '../../types'
import { DEST_MAP } from '../../data/destinations'
import {
  allocateNights, computeBreakdown, computeLeg, TIER_FACTORS, totalBudget,
} from '../budget/engine'
import { computeFatigue, computeScore } from './scoring'
import { formatDuration } from '../../utils/format'

// ---------- Itinerary generation ----------

const MODE_ICON: Record<string, string> = {
  car: 'bi-car-front', ev: 'bi-ev-front', bus: 'bi-bus-front', train: 'bi-train-front',
  flight: 'bi-airplane', ferry: 'bi-water', mixed: 'bi-signpost',
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60 / 15) * 15 % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateItinerary(input: PlannerInput, tier: TravelStyle): ItineraryDay[] {
  const stops = allocateNights(input.stops, input.days)
  const factors = TIER_FACTORS[tier]
  const relaxed = input.groupType === 'family' || input.travellers.children + input.travellers.infants > 0
  const days: ItineraryDay[] = []
  let dayNum = 1
  let prev = input.origin

  for (const stop of stops) {
    const dest = DEST_MAP[stop.destId]
    if (!dest) continue
    const leg = computeLeg(prev, stop.destId, input, tier)
    const acts = dest.activities
      .filter((a) => a.category !== 'optional' || tier === 'premium' || tier === 'luxury')
      .slice(0, stop.nights * 2 + 2)
    let actIdx = 0

    for (let n = 0; n <= stop.nights - 1; n++) {
      const isArrival = n === 0
      const items: ItineraryItem[] = []
      let clock = relaxed ? 9 * 60 : 8 * 60

      if (isArrival && prev !== stop.destId) {
        items.push({
          time: minutesToTime(clock),
          title: `Depart ${leg.fromName} ${leg.mode === 'flight' ? '(flight)' : leg.mode === 'ferry' ? '(drive + ferry)' : ''}`.trim(),
          icon: MODE_ICON[leg.mode] ?? 'bi-signpost',
          kind: 'travel',
          durationH: Math.round(leg.durationMin / 6) / 10,
          note: `${leg.km} km · ${formatDuration(leg.durationMin)}`,
        })
        clock += leg.durationMin + 30
        items.push({ time: minutesToTime(clock), title: `Arrive in ${dest.name}`, icon: 'bi-geo-alt', kind: 'travel' })
        clock += 30
        items.push({ time: minutesToTime(Math.max(clock, 13 * 60)), title: `Lunch — local ${dest.name} favourites`, icon: 'bi-cup-hot', kind: 'meal', costPerPerson: Math.round(dest.meals[1] * factors.food) })
        clock = Math.max(clock + 60, 14 * 60)
        items.push({ time: minutesToTime(clock), title: 'Hotel check-in & refresh', icon: 'bi-building', kind: 'hotel' })
        clock += 90
      } else {
        items.push({ time: minutesToTime(clock), title: 'Breakfast', icon: 'bi-egg-fried', kind: 'meal', costPerPerson: Math.round(dest.meals[0] * factors.food) })
        clock += 60
      }

      // Fill the day with activities
      const perDay = relaxed ? (isArrival ? 1 : 2) : isArrival ? 1 : 3
      for (let a = 0; a < perDay && actIdx < acts.length; a++) {
        const act = acts[actIdx++]
        items.push({
          time: minutesToTime(clock),
          title: act.name,
          icon: 'bi-star',
          kind: 'activity',
          durationH: act.durationH,
          costPerPerson: act.price,
          note: act.price === 0 ? 'Free' : undefined,
        })
        clock += act.durationH * 60 + 30
        if (clock > 12 * 60 + 30 && clock < 14 * 60 && !isArrival) {
          items.push({ time: minutesToTime(clock), title: 'Lunch', icon: 'bi-cup-hot', kind: 'meal', costPerPerson: Math.round(dest.meals[1] * factors.food) })
          clock += 75
        }
      }

      items.push({
        time: minutesToTime(Math.max(clock, 19 * 60)),
        title: `Dinner${dest.tags.includes('food') ? ` — ${dest.name} is famous for it` : ''}`,
        icon: 'bi-moon-stars',
        kind: 'meal',
        costPerPerson: Math.round(dest.meals[2] * factors.food),
      })
      if (relaxed) items.push({ time: minutesToTime(21 * 60), title: 'Early night — rest up', icon: 'bi-stars', kind: 'rest' })

      days.push({
        day: dayNum++,
        destId: stop.destId,
        heading: isArrival && prev !== stop.destId ? `${leg.fromName} → ${dest.name}` : dest.name,
        items,
      })
    }
    prev = stop.destId
  }

  // Final day: travel home
  const last = stops[stops.length - 1]
  if (last) {
    const home = computeLeg(last.destId, input.origin, input, tier)
    days.push({
      day: dayNum,
      destId: last.destId,
      heading: `${home.fromName} → ${home.toName} (home)`,
      items: [
        { time: '09:00', title: 'Breakfast & hotel check-out', icon: 'bi-box-arrow-right', kind: 'hotel' },
        { time: '10:30', title: 'Last-minute shopping / souvenirs', icon: 'bi-bag', kind: 'activity' },
        {
          time: '12:30', title: `Head home to ${home.toName}`, icon: MODE_ICON[home.mode] ?? 'bi-signpost',
          kind: 'travel', durationH: Math.round(home.durationMin / 6) / 10,
          note: `${home.km} km · ${formatDuration(home.durationMin)}`,
        },
      ],
    })
  }
  return days
}

// ---------- Multi-plan generation ----------

const PLAN_TIERS: TravelStyle[] = ['budget', 'value', 'comfort', 'premium']

export function generatePlans(input: PlannerInput): TripPlan[] {
  const budget = totalBudget(input)
  const plans = PLAN_TIERS.map((tier) => {
    const { breakdown, transport, hotelSummary } = computeBreakdown(input, tier)
    const hotelChanges = new Set(input.stops).size
    const fatigue = computeFatigue(input, transport, hotelChanges)
    const score = computeScore(input, breakdown, transport, fatigue)
    const explanations: string[] = []
    if (budget > 0) {
      const pct = Math.round((breakdown.total / budget) * 100)
      explanations.push(pct <= 100 ? `Uses ${pct}% of your RM${budget.toLocaleString()} budget` : `${pct - 100}% over your budget`)
    }
    explanations.push(`${TIER_FACTORS[tier].label} hotels (${hotelSummary.map((h) => `RM${h.perNight}/night`).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`)
    explanations.push(`${Math.round(transport.totalDriveMin / 60)}h total travel time by ${transport.mode === 'drive' ? 'road' : transport.mode === 'fly' ? 'air' : transport.mode === 'public' ? 'public transport' : 'mixed transport'}`)
    if (fatigue.level === 'low') explanations.push('Low travel fatigue')
    return {
      tier,
      label: TIER_FACTORS[tier].label,
      recommended: false,
      breakdown,
      transport,
      hotelSummary,
      itinerary: generateItinerary(input, tier),
      score,
      fatigue,
      explanations,
    }
  })

  // Recommend: the best-scoring plan that fits the budget and is closest to the
  // user's chosen style; fall back to the cheapest if nothing fits.
  const within = plans.filter((p) => budget === 0 || p.breakdown.total <= budget)
  const pool = within.length > 0 ? within : [plans[0]]
  const styleIdx = PLAN_TIERS.indexOf(input.style === 'luxury' ? 'premium' : input.style)
  const rec = pool.reduce((a, b) => {
    const da = Math.abs(PLAN_TIERS.indexOf(a.tier) - styleIdx)
    const db = Math.abs(PLAN_TIERS.indexOf(b.tier) - styleIdx)
    if (da !== db) return da < db ? a : b
    return b.score.total > a.score.total ? b : a
  })
  rec.recommended = true
  return plans
}

// ---------- Budget-first destination matching (Modes B & C) ----------

export interface DestinationMatch {
  destId: string
  estimated: number
  perPerson: number
  utilization: number       // 0–1+
  matchedInterests: string[]
}

export function matchDestinations(input: PlannerInput): DestinationMatch[] {
  const budget = totalBudget(input)
  const candidates = Object.values(DEST_MAP).filter((d) => d.id !== input.origin)
  const matches: DestinationMatch[] = []
  for (const d of candidates) {
    if (input.mode === 'inspire' && input.interests.length > 0) {
      const overlap = input.interests.filter((i) => d.tags.includes(i))
      if (overlap.length === 0) continue
    }
    const single: PlannerInput = { ...input, stops: [d.id] }
    const { breakdown } = computeBreakdown(single, 'value')
    matches.push({
      destId: d.id,
      estimated: breakdown.total,
      perPerson: breakdown.perPerson,
      utilization: budget > 0 ? breakdown.total / budget : 1,
      matchedInterests: input.interests.filter((i) => d.tags.includes(i)),
    })
  }
  return matches
    .filter((m) => budget === 0 || m.utilization <= 1.05)
    .sort((a, b) => {
      // Prefer high budget utilization (better trip) and interest matches
      const ia = a.matchedInterests.length
      const ib = b.matchedInterests.length
      if (ia !== ib) return ib - ia
      return Math.abs(0.85 - a.utilization) - Math.abs(0.85 - b.utilization)
    })
    .slice(0, 9)
}
