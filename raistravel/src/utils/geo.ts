// Distance and travel-time estimation between destinations.
// Road distances use haversine × road factor with curated overrides for
// common Malaysian legs so numbers match what drivers actually see.

export interface Point { lat: number; lng: number }

export function haversineKm(a: Point, b: Point): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const ROAD_FACTOR = 1.32

// Curated real-world driving distances (km) keyed by sorted "a|b" pair of destination ids.
const ROAD_OVERRIDES: Record<string, number> = {
  'ipoh|kuala-lumpur': 205,
  'kuala-lumpur|penang': 355,
  'ipoh|penang': 160,
  'kuala-lumpur|melaka': 145,
  'johor-bahru|melaka': 220,
  'johor-bahru|kuala-lumpur': 350,
  'cameron-highlands|kuala-lumpur': 200,
  'cameron-highlands|ipoh': 90,
  'kuala-lumpur|kuala-selangor': 70,
  'kuala-selangor|sekinchan': 30,
  'kuala-lumpur|kuantan': 250,
  'cherating|kuantan': 47,
  'kuala-lumpur|kuala-terengganu': 435,
  'kota-bharu|kuala-lumpur': 440,
  'kuala-lumpur|port-dickson': 90,
  'melaka|port-dickson': 90,
  'alor-setar|kuala-lumpur': 430,
  'kota-kinabalu|kundasang': 95,
  'kota-kinabalu|semporna': 555,
  'bako|kuching': 37,
  'damai|kuching': 35,
  'johor-bahru|singapore': 25,
  'kuala-lumpur|singapore': 360,
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

export function roadKm(aId: string, bId: string, aPt: Point, bPt: Point): number {
  const override = ROAD_OVERRIDES[pairKey(aId, bId)]
  if (override !== undefined) return override
  return Math.round(haversineKm(aPt, bPt) * ROAD_FACTOR)
}

// Average speeds (km/h) by context
export function driveMinutes(km: number): number {
  const speed = km > 150 ? 88 : km > 60 ? 75 : 50
  return Math.round((km / speed) * 60)
}

// Malaysian highway tolls ≈ RM0.09–0.11/km on tolled expressways.
export function estimateToll(km: number): number {
  return Math.round(km * 0.1)
}

export function flightMinutes(km: number): number {
  // Cruise ~750 km/h + 50 min taxi/climb overhead
  return Math.round((km / 750) * 60 + 50)
}
