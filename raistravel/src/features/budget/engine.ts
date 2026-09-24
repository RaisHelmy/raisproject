import type {
  CostBreakdown, CostLine, ComputedLeg, Destination, PlannerInput,
  TransportPlan, TravelStyle, Travellers,
} from '../../types'
import { DEST_MAP, ISLANDS, originPoint } from '../../data/destinations'
import { getVehicle, fuelCostForKm } from '../../data/vehicles'
import { roadKm, driveMinutes, estimateToll, haversineKm, flightMinutes } from '../../utils/geo'

// ---------- Occupancy ----------

export function payingTravellers(t: Travellers): number {
  // Infants are assumed free for food/activities; children count at 70%.
  return t.adults + t.children * 0.7
}

export function headCount(t: Travellers): number {
  return t.adults + t.children + t.infants
}

export function roomsNeeded(t: Travellers): number {
  // 2 adults per room; children share (2 children ≈ 1 adult slot); infants co-sleep.
  return Math.max(1, Math.ceil((t.adults + t.children / 2) / 2))
}

export interface RoomOption { label: string; rooms: number; note: string }

export function roomOptions(t: Travellers): RoomOption[] {
  const opts: RoomOption[] = []
  const n = roomsNeeded(t)
  opts.push({ label: `${n} × Double Room${n > 1 ? 's' : ''}`, rooms: n, note: 'Standard occupancy (2 per room)' })
  if (headCount(t) >= 3 && headCount(t) <= 5) {
    opts.push({ label: '1 × Family Room', rooms: 1, note: 'Sleeps up to 4–5, usually 1.6× a double' })
  }
  if (headCount(t) >= 4) {
    opts.push({ label: '1 × Apartment', rooms: 1, note: 'More space and a kitchen; ~1.8× a double' })
  }
  return opts
}

// ---------- Tier factors ----------

export const TIER_FACTORS: Record<TravelStyle, { food: number; activities: number; label: string }> = {
  budget: { food: 0.7, activities: 0.75, label: 'Cheapest' },
  value: { food: 1, activities: 1, label: 'Best Value' },
  comfort: { food: 1.3, activities: 1.25, label: 'Comfort' },
  premium: { food: 1.8, activities: 1.6, label: 'Premium' },
  luxury: { food: 2.6, activities: 2.1, label: 'Luxury' },
}

export const TIER_ORDER: TravelStyle[] = ['budget', 'value', 'comfort', 'premium', 'luxury']

// ---------- Nights allocation ----------

export function allocateNights(stops: string[], days: number): { destId: string; nights: number }[] {
  const totalNights = Math.max(stops.length, days - 1)
  const weights = stops.map((id) => {
    const d = DEST_MAP[id]
    return d ? (d.recommendedNights[0] + d.recommendedNights[1]) / 2 : 2
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  const nights = weights.map((w) => Math.max(1, Math.floor((totalNights * w) / sum)))
  let assigned = nights.reduce((a, b) => a + b, 0)
  // Distribute the remainder to the highest-weight stops.
  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w)
  let k = 0
  while (assigned < totalNights) {
    nights[order[k % order.length].i] += 1
    assigned += 1
    k += 1
  }
  while (assigned > totalNights) {
    const idx = nights.findIndex((n) => n > 1)
    if (idx === -1) break
    nights[idx] -= 1
    assigned -= 1
  }
  return stops.map((destId, i) => ({ destId, nights: nights[i] }))
}

// ---------- Transport ----------

function isBorneo(lng: number): boolean {
  return lng > 108
}

interface Place { id: string; name: string; lat: number; lng: number; dest?: Destination }

function placeOf(id: string): Place {
  const d = DEST_MAP[id]
  if (d) return { id, name: d.name, lat: d.lat, lng: d.lng, dest: d }
  const o = originPoint(id)
  return { id, name: o.name, lat: o.lat, lng: o.lng }
}

function needsFlight(a: Place, b: Place): boolean {
  // Crossing between Peninsular Malaysia/Borneo, or any international leg that
  // isn't the Singapore land crossing, requires a flight.
  if (isBorneo(a.lng) !== isBorneo(b.lng)) return true
  const intl = (p: Place) => p.dest?.international && p.dest.countryCode !== 'SG'
  if (intl(a) || intl(b)) return haversineKm(a, b) > 400
  return false
}

function flightPrice(a: Place, b: Place): number {
  const to = b.dest ?? a.dest
  const km = haversineKm(a, b)
  if (to?.flightFromKL && (a.id === 'kuala-lumpur' || b.id === 'kuala-lumpur')) return to.flightFromKL
  return Math.round(90 + km * 0.35)
}

export function computeLeg(
  fromId: string, toId: string, input: PlannerInput, tier: TravelStyle,
): ComputedLeg {
  const a = placeOf(fromId)
  const b = placeOf(toId)
  const pax = headCount(input.travellers) - input.travellers.infants * 0.9 // infants ~10% of fares
  const vehicle = getVehicle(input.vehicleId)
  const island = ISLANDS[toId] ?? ISLANDS[fromId]
  const wantFly = input.transportPreference === 'fly' || tier === 'premium' || tier === 'luxury' ||
    (input.transportPreference === 'best' && tier === 'comfort')
  const wantPublic = input.transportPreference === 'public' || (tier === 'budget' && input.transportPreference !== 'drive')

  // Between two cities inside a foreign country (e.g. Osaka → Kyoto), assume
  // local rail rather than driving your own car there.
  if (a.dest?.international && b.dest?.international && a.dest.countryCode === b.dest.countryCode && !needsFlight(a, b)) {
    const km = Math.round(haversineKm(a, b) * 1.15)
    const perPerson = Math.max(10, Math.round(km * 0.4))
    return {
      fromName: a.name, toName: b.name, mode: 'train', km,
      durationMin: Math.round((km / 90) * 60 + 30),
      cost: Math.round(perPerson * pax),
      note: `Local train ≈ RM${perPerson}/person`,
    }
  }

  if (needsFlight(a, b)) {
    const km = haversineKm(a, b)
    return {
      fromName: a.name, toName: b.name, mode: 'flight', km: Math.round(km),
      durationMin: flightMinutes(km),
      cost: Math.round(flightPrice(a, b) * pax),
      note: 'One-way flight, estimated per person fare',
    }
  }

  if (island) {
    const islandEnd = ISLANDS[toId] ? b : a
    const mainlandEnd = ISLANDS[toId] ? a : b
    // Fly instead of ferry when the island has an airport and the user prefers flying.
    if (wantFly && islandEnd.dest?.flightFromKL) {
      const km = haversineKm(a, b)
      return {
        fromName: a.name, toName: b.name, mode: 'flight', km: Math.round(km),
        durationMin: flightMinutes(km),
        cost: Math.round(flightPrice(a, b) * pax),
        note: 'One-way flight, estimated per person fare',
      }
    }
    const driveKm = Math.max(0, roadKm(mainlandEnd.id, islandEnd.id, mainlandEnd, islandEnd) - 30)
    const driveCost = wantPublic
      ? Math.round(Math.max(15, driveKm * 0.13) * pax)
      : Math.round(fuelCostForKm(vehicle, driveKm) + estimateToll(driveKm * 0.7))
    return {
      fromName: a.name, toName: b.name, mode: 'ferry',
      km: Math.round(driveKm + 30),
      durationMin: driveMinutes(driveKm) + island.ferryMinutes + 40,
      cost: driveCost + Math.round(island.ferryPrice * pax),
      note: `${wantPublic ? 'Bus' : 'Drive'} to ${island.port}, then ferry (RM${island.ferryPrice}/person)`,
    }
  }

  const km = roadKm(a.id, b.id, a, b)
  if (wantFly && km > 300 && (a.dest?.domesticFlightHub || b.dest?.domesticFlightHub || a.id === 'kuala-lumpur' || b.id === 'kuala-lumpur')) {
    const airKm = haversineKm(a, b)
    return {
      fromName: a.name, toName: b.name, mode: 'flight', km: Math.round(airKm),
      durationMin: flightMinutes(airKm),
      cost: Math.round(flightPrice(a, b) * pax),
      note: 'One-way flight, estimated per person fare',
    }
  }
  if (wantPublic) {
    const perPerson = Math.max(15, Math.round(km * 0.13))
    return {
      fromName: a.name, toName: b.name, mode: 'bus', km,
      durationMin: Math.round(driveMinutes(km) * 1.25),
      cost: Math.round(perPerson * pax),
      note: `Intercity bus/train ≈ RM${perPerson}/person`,
    }
  }
  const fuel = fuelCostForKm(vehicle, km)
  const toll = estimateToll(km * 0.85)
  return {
    fromName: a.name, toName: b.name, mode: input.vehicleId.startsWith('ev') ? 'ev' : 'car',
    km, durationMin: driveMinutes(km),
    cost: Math.round(fuel + toll),
    note: `Fuel RM${Math.round(fuel)} + tolls RM${toll}`,
  }
}

export function computeTransportPlan(input: PlannerInput, tier: TravelStyle): TransportPlan {
  const points = [input.origin, ...input.stops, input.origin]
  const legs: ComputedLeg[] = []
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i] === points[i + 1]) continue
    legs.push(computeLeg(points[i], points[i + 1], input, tier))
  }
  const driveLegs = legs.filter((l) => l.mode === 'car' || l.mode === 'ev' || l.mode === 'ferry')
  const vehicleUsed = driveLegs.length > 0
  const parkingCost = vehicleUsed ? input.days * 10 : 0
  const fuelToll = driveLegs.reduce((a, l) => a + l.cost, 0)
  const tickets = legs.filter((l) => l.mode === 'flight' || l.mode === 'bus' || l.mode === 'train').reduce((a, l) => a + l.cost, 0)
  const modes = new Set(legs.map((l) => l.mode))
  return {
    legs,
    totalKm: legs.reduce((a, l) => a + l.km, 0),
    totalDriveMin: legs.reduce((a, l) => a + l.durationMin, 0),
    fuelCost: Math.round(fuelToll * 0.55),
    tollCost: Math.round(fuelToll * 0.45),
    parkingCost,
    ticketCost: tickets,
    totalCost: fuelToll + tickets + parkingCost,
    mode: modes.size > 1 ? 'mixed' : modes.has('flight') ? 'fly' : modes.has('bus') ? 'public' : 'drive',
  }
}

// ---------- Full cost breakdown ----------

export function computeBreakdown(input: PlannerInput, tier: TravelStyle): {
  breakdown: CostBreakdown
  transport: TransportPlan
  hotelSummary: { destId: string; nights: number; rooms: number; style: TravelStyle; perNight: number }[]
} {
  const transport = computeTransportPlan(input, tier)
  const stops = allocateNights(input.stops, input.days)
  const rooms = roomsNeeded(input.travellers)
  const pax = payingTravellers(input.travellers)
  const factors = TIER_FACTORS[tier]
  const heads = headCount(input.travellers)

  const detail: CostLine[] = []

  // Transport lines
  if (transport.ticketCost > 0) {
    const hasFlight = transport.legs.some((l) => l.mode === 'flight')
    detail.push({
      category: 'transport',
      label: hasFlight ? 'Flights / tickets' : 'Bus, train & ferry tickets',
      amount: transport.ticketCost,
      confidence: 'estimated',
    })
  }
  if (transport.fuelCost + transport.tollCost > 0) {
    detail.push({ category: 'transport', label: 'Fuel & tolls', amount: transport.fuelCost + transport.tollCost, confidence: 'estimated' })
  }
  if (transport.parkingCost > 0) {
    detail.push({ category: 'transport', label: 'Parking', amount: transport.parkingCost, confidence: 'estimated' })
  }

  // Accommodation
  const hotelSummary = stops.map((s) => {
    const d = DEST_MAP[s.destId]
    const perNight = d ? d.hotelPerNight[tier] : 180
    detail.push({
      category: 'accommodation',
      label: `${d?.name ?? s.destId} — ${s.nights} night${s.nights > 1 ? 's' : ''} × ${rooms} room${rooms > 1 ? 's' : ''}`,
      amount: perNight * s.nights * rooms,
      confidence: 'estimated',
    })
    return { destId: s.destId, nights: s.nights, rooms, style: tier, perNight }
  })
  const accommodation = hotelSummary.reduce((a, h) => a + h.perNight * h.nights * h.rooms, 0)

  // Food: per-destination daily meal totals × tier factor × paying travellers
  let food = 0
  for (const s of stops) {
    const d = DEST_MAP[s.destId]
    if (!d) continue
    const daily = d.meals.reduce((a, b) => a + b, 0) * factors.food
    const amount = Math.round(daily * (s.nights + 0.5) * pax)
    food += amount
    detail.push({ category: 'food', label: `${d.name} — ~RM${Math.round(daily)}/person/day`, amount, confidence: 'estimated' })
  }

  // Activities: mandatory + recommended; comfort and above add optional picks
  let activities = 0
  for (const s of stops) {
    const d = DEST_MAP[s.destId]
    if (!d) continue
    const include = d.activities.filter((a) =>
      a.category === 'mandatory' || a.category === 'recommended' ||
      (a.category === 'optional' && (tier === 'premium' || tier === 'luxury') && a.price < 300),
    )
    const capped = include.slice(0, Math.min(include.length, s.nights + 2))
    const amount = Math.round(capped.reduce((a, x) => a + x.price, 0) * pax * factors.activities)
    activities += amount
    detail.push({ category: 'activities', label: `${d.name} — ${capped.length} activities`, amount, confidence: 'estimated' })
  }

  // Other: travel insurance + misc
  const intl = input.stops.some((s) => DEST_MAP[s]?.international)
  const insurance = Math.round((intl ? 12 : 4) * input.days * heads)
  const misc = Math.round((accommodation + food) * 0.04)
  detail.push({ category: 'other', label: 'Travel insurance (estimate)', amount: insurance, confidence: 'historical' })
  detail.push({ category: 'other', label: 'Miscellaneous', amount: misc, confidence: 'historical' })
  const other = insurance + misc

  const subtotal = transport.totalCost + accommodation + food + activities + other
  const contingency = Math.round(subtotal * (tier === 'budget' ? 0.05 : 0.08))
  detail.push({ category: 'contingency', label: 'Emergency buffer', amount: contingency, confidence: 'historical' })

  const total = subtotal + contingency
  const breakdown: CostBreakdown = {
    transport: transport.totalCost,
    accommodation, food, activities, other, contingency, total,
    perPerson: Math.round(total / Math.max(1, heads - input.travellers.infants)),
    perDayGroup: Math.round(total / input.days),
    perDayPerson: Math.round(total / input.days / Math.max(1, heads - input.travellers.infants)),
    detail,
  }
  return { breakdown, transport, hotelSummary }
}

// ---------- Budget helpers ----------

export function totalBudget(input: PlannerInput): number {
  const heads = headCount(input.travellers) - input.travellers.infants
  if (input.budgetMode === 'perPerson') return input.budget * Math.max(1, heads)
  if (input.budgetMode === 'daily') return input.budget * input.days
  return input.budget
}
