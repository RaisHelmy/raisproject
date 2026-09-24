import type { FlightOption, PriceQuote } from '../types'
import { getDestination } from '../data/destinations'
import { haversineKm, flightMinutes } from '../utils/geo'
import { simulateLatency } from './providers'
import { timestamp } from '../utils/format'

export interface FlightSearchRequest {
  fromId: string
  toId: string
  fromName: string
}

export interface FlightProvider {
  readonly name: string
  searchFlights(request: FlightSearchRequest): Promise<FlightOption[]>
}

interface AirlineSeed { name: string; factor: number; baggage: number }

const AIRLINES: AirlineSeed[] = [
  { name: 'AirAsia', factor: 0.72, baggage: 7 },
  { name: 'Batik Air', factor: 0.85, baggage: 20 },
  { name: 'Firefly', factor: 0.9, baggage: 20 },
  { name: 'Malaysia Airlines', factor: 1.0, baggage: 30 },
]

function quote(price: number, refundable: boolean): PriceQuote {
  const base = Math.round(price * 0.82)
  const taxes = Math.round(price * 0.14)
  const fees = price - base - taxes
  return {
    provider: 'Flight aggregator', currency: 'MYR',
    basePrice: base, taxes, fees,
    totalPrice: price, pricePerPerson: price,
    refundable, lastUpdated: timestamp(), confidence: 'estimated',
  }
}

class MockFlightProvider implements FlightProvider {
  readonly name = 'Flight aggregator (demo)'

  async searchFlights(request: FlightSearchRequest): Promise<FlightOption[]> {
    const to = getDestination(request.toId)
    const from = getDestination(request.fromId)
    if (!to) return []
    const fromPt = from ?? { lat: 3.139, lng: 101.687 }
    const km = haversineKm(fromPt, to)
    const duration = flightMinutes(km)
    // Typical one-way per-person estimate: base RM90 + distance component.
    const typical = to.flightFromKL ?? Math.round(90 + km * 0.35)
    const departures = ['07:10', '09:45', '13:20', '17:35', '20:50']
    const options: FlightOption[] = AIRLINES.map((a, i) => {
      const price = Math.round(typical * a.factor)
      const depart = departures[i % departures.length]
      const [h, m] = depart.split(':').map(Number)
      const arriveMin = h * 60 + m + duration
      const arrive = `${String(Math.floor(arriveMin / 60) % 24).padStart(2, '0')}:${String(arriveMin % 60).padStart(2, '0')}`
      return {
        id: `${request.fromId}-${request.toId}-${a.name}`,
        airline: a.name,
        from: request.fromName,
        to: to.name,
        departTime: depart,
        arriveTime: arrive,
        durationMin: duration,
        stops: 0,
        baggageKg: a.baggage,
        quote: quote(price, a.baggage >= 20),
      }
    })
    return simulateLatency(options)
  }
}

export const flightProvider: FlightProvider = new MockFlightProvider()
