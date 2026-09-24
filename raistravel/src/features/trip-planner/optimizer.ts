import { DEST_MAP, originPoint } from '../../data/destinations'
import { roadKm, driveMinutes, estimateToll } from '../../utils/geo'
import { fuelCostForKm, getVehicle } from '../../data/vehicles'

function pt(id: string): { id: string; lat: number; lng: number } {
  const d = DEST_MAP[id]
  if (d) return { id, lat: d.lat, lng: d.lng }
  const o = originPoint(id)
  return { id, lat: o.lat, lng: o.lng }
}

export function routeDistance(origin: string, stops: string[]): number {
  const seq = [origin, ...stops, origin]
  let km = 0
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i] === seq[i + 1]) continue
    km += roadKm(seq[i], seq[i + 1], pt(seq[i]), pt(seq[i + 1]))
  }
  return km
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}

export interface OptimizationResult {
  optimized: string[]
  originalKm: number
  optimizedKm: number
  savedKm: number
  savedMinutes: number
  savedFuelToll: number
  reason: string
}

// Exhaustive search for ≤7 stops (5,040 permutations max — instant).
export function optimizeRoute(origin: string, stops: string[], vehicleId: string): OptimizationResult {
  const originalKm = routeDistance(origin, stops)
  let best = stops
  let bestKm = originalKm
  if (stops.length >= 2 && stops.length <= 7) {
    for (const p of permutations(stops)) {
      const km = routeDistance(origin, p)
      if (km < bestKm - 0.5) {
        bestKm = km
        best = p
      }
    }
  }
  const savedKm = Math.max(0, originalKm - bestKm)
  const vehicle = getVehicle(vehicleId)
  const savedFuel = fuelCostForKm(vehicle, savedKm)
  const savedToll = estimateToll(savedKm * 0.85)
  const names = (ids: string[]) => ids.map((i) => DEST_MAP[i]?.name ?? i).join(' → ')
  return {
    optimized: best,
    originalKm,
    optimizedKm: bestKm,
    savedKm: Math.round(savedKm),
    savedMinutes: driveMinutes(savedKm),
    savedFuelToll: Math.round(savedFuel + savedToll),
    reason: savedKm > 5
      ? `Visiting stops in the order ${names(best)} avoids backtracking along the same highways, so you cover less distance for the same trip.`
      : 'Your current order is already the shortest loop — no changes needed.',
  }
}
