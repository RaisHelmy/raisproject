import type { Hotel, PriceQuote, TravelStyle } from '../types'
import { getDestination } from '../data/destinations'
import { affiliateUrl, simulateLatency } from './providers'
import { timestamp } from '../utils/format'

export interface HotelSearchRequest {
  destId: string
  style: TravelStyle
  nights: number
  rooms: number
}

export interface AccommodationProvider {
  readonly name: string
  searchHotels(request: HotelSearchRequest): Promise<Hotel[]>
}

// Deterministic pseudo-random so hotel lists are stable per destination.
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1)
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296
  }
}

const HOTEL_NAMES: Record<TravelStyle, string[]> = {
  budget: ['Cozy Stay Guesthouse', 'City Backpackers Lodge', 'Sunrise Budget Inn'],
  value: ['Harbour View Hotel', 'The Palm Boutique', 'Heritage Court Hotel'],
  comfort: ['Grand Riverside Hotel', 'The Verandah Resort', 'Bayview Premier'],
  premium: ['The Meridian Suites', 'Royal Orchid Resort', 'Amara Grand'],
  luxury: ['The Imperial Sanctuary', 'Serene Sky Villas', 'The Ritz Pavilion'],
}

const ROOM_TYPES: Record<TravelStyle, { roomType: string; sleeps: number }[]> = {
  budget: [{ roomType: 'Double Room', sleeps: 2 }, { roomType: 'Family Room', sleeps: 4 }],
  value: [{ roomType: 'Deluxe Double', sleeps: 2 }, { roomType: 'Family Room', sleeps: 4 }, { roomType: 'Twin Room', sleeps: 2 }],
  comfort: [{ roomType: 'Deluxe King', sleeps: 2 }, { roomType: 'Family Suite', sleeps: 4 }, { roomType: 'Apartment (2BR)', sleeps: 5 }],
  premium: [{ roomType: 'Premier Suite', sleeps: 3 }, { roomType: 'Family Suite', sleeps: 4 }],
  luxury: [{ roomType: 'Villa with Pool', sleeps: 4 }, { roomType: 'Executive Suite', sleeps: 2 }],
}

function makeQuote(provider: string, nightly: number, rand: () => number, dest: string): PriceQuote {
  // Providers differ by ±6% with different tax/fee splits.
  const variance = 0.94 + rand() * 0.12
  const base = Math.round(nightly * variance)
  const taxes = Math.round(base * 0.08)
  const fees = provider === 'Expedia' ? Math.round(base * 0.03) : 0
  return {
    provider,
    currency: 'MYR',
    basePrice: base,
    taxes,
    fees,
    totalPrice: base + taxes + fees,
    pricePerPerson: 0, // filled by caller when occupancy is known
    refundable: rand() > 0.35,
    lastUpdated: timestamp(),
    confidence: 'estimated',
    bookingUrl: affiliateUrl(provider, dest),
  }
}

class MockAccommodationProvider implements AccommodationProvider {
  readonly name: string
  constructor(name: string) {
    this.name = name
  }

  async searchHotels(request: HotelSearchRequest): Promise<Hotel[]> {
    const dest = getDestination(request.destId)
    if (!dest) return []
    const rand = seededRandom(`${this.name}-${request.destId}-${request.style}`)
    const nightly = dest.hotelPerNight[request.style]
    const names = HOTEL_NAMES[request.style]
    const rooms = ROOM_TYPES[request.style]
    const hotels: Hotel[] = names.map((baseName, i) => {
      const room = rooms[i % rooms.length]
      const priceScale = 0.85 + i * 0.18
      return {
        id: `${request.destId}-${request.style}-${i}`,
        name: `${baseName}, ${dest.name}`,
        destId: request.destId,
        stars: Math.min(5, { budget: 2, value: 3, comfort: 4, premium: 4, luxury: 5 }[request.style] + (i === 2 ? 1 : 0)),
        rating: Math.round((7 + rand() * 2.4) * 10) / 10,
        reviews: Math.round(200 + rand() * 3800),
        locationScore: Math.round((7.5 + rand() * 2.2) * 10) / 10,
        breakfastIncluded: rand() > 0.45,
        freeCancellation: rand() > 0.3,
        roomType: room.roomType,
        sleeps: room.sleeps,
        style: request.style,
        quotes: [makeQuote(this.name, nightly * priceScale, rand, dest.name)],
      }
    })
    return simulateLatency(hotels)
  }
}

export const BookingProvider = new MockAccommodationProvider('Booking.com')
export const AgodaProvider = new MockAccommodationProvider('Agoda')
export const ExpediaProvider = new MockAccommodationProvider('Expedia')

const ALL_PROVIDERS = [BookingProvider, AgodaProvider, ExpediaProvider]

// Fan out to all providers in parallel and merge quotes per hotel so the
// comparison table can show one row per hotel with a column per provider.
export async function searchAllProviders(request: HotelSearchRequest): Promise<Hotel[]> {
  const results = await Promise.all(ALL_PROVIDERS.map((p) => p.searchHotels(request)))
  const merged = new Map<string, Hotel>()
  for (const list of results) {
    for (const hotel of list) {
      const existing = merged.get(hotel.id)
      if (existing) existing.quotes.push(...hotel.quotes)
      else merged.set(hotel.id, { ...hotel, quotes: [...hotel.quotes] })
    }
  }
  return [...merged.values()]
}

export function bestQuote(hotel: Hotel): PriceQuote {
  return hotel.quotes.reduce((a, b) => (b.totalPrice < a.totalPrice ? b : a))
}
