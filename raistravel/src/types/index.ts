// ---------- Core domain types ----------

export type TravelStyle = 'budget' | 'value' | 'comfort' | 'premium' | 'luxury'

export type Interest =
  | 'food' | 'nature' | 'beach' | 'shopping' | 'history' | 'culture'
  | 'adventure' | 'family' | 'photography' | 'nightlife' | 'themeparks'
  | 'museums' | 'heritage' | 'roadtrip' | 'luxury' | 'relaxation'

export type TransportMode = 'car' | 'ev' | 'bus' | 'train' | 'flight' | 'ferry' | 'mixed'

export interface Travellers {
  adults: number
  children: number
  infants: number
}

export interface StyleWeights {
  food: number       // 0–100 slider
  hotel: number
  activities: number
  transport: number
}

export interface Destination {
  id: string
  slug: string
  name: string
  country: string
  countryCode: string
  currency: string
  international: boolean
  lat: number
  lng: number
  emoji: string
  gradient: string          // CSS gradient for card art
  tagline: string
  description: string
  tags: Interest[]
  ratings: Partial<Record<'beach' | 'food' | 'family' | 'nature' | 'culture' | 'shopping' | 'adventure', number>>
  bestMonths: number[]      // 1–12
  recommendedNights: [number, number]
  difficulty: 'easy' | 'moderate' | 'challenging'
  familyFriendly: boolean
  visaRequiredForMY: boolean
  // Nightly hotel price per room in MYR, by style tier
  hotelPerNight: Record<TravelStyle, number>
  // Per-person daily meal costs in MYR at "value" tier: [breakfast, lunch, dinner, drinks, snacks]
  meals: [number, number, number, number, number]
  activities: ActivityTemplate[]
  // Return flight per person from KL in MYR (undefined = no direct/typical flight)
  flightFromKL?: number
  domesticFlightHub?: boolean
}

export interface ActivityTemplate {
  name: string
  price: number             // MYR per person
  category: 'mandatory' | 'recommended' | 'optional'
  durationH: number
  interest: Interest
}

// ---------- Routes ----------

export interface RouteLeg {
  from: string              // destination id or 'kl' etc.
  to: string
  mode: TransportMode
  note?: string
}

export interface RouteTemplate {
  slug: string
  name: string
  stops: { destId: string; nights: number }[]
  origin: string            // origin city id
  days: number
  popularity: 1 | 2 | 3 | 4 | 5
  bestFor: Interest[]
  season: string
  difficulty: 'easy' | 'moderate' | 'challenging'
  familySuitability: 'great' | 'good' | 'fair'
  summary: string
  estPerPerson: number      // MYR, value tier, 2 pax baseline
  recommendedTransport: string
}

// ---------- Pricing ----------

export type PriceConfidence = 'live' | 'estimated' | 'historical'

export interface PriceQuote {
  provider: string
  currency: string
  basePrice: number
  taxes: number
  fees: number
  totalPrice: number
  pricePerPerson: number
  refundable: boolean
  lastUpdated: string
  confidence: PriceConfidence
  bookingUrl?: string
}

export interface Hotel {
  id: string
  name: string
  destId: string
  stars: number
  rating: number            // guest score /10
  reviews: number
  locationScore: number
  breakfastIncluded: boolean
  freeCancellation: boolean
  roomType: string
  sleeps: number
  style: TravelStyle
  quotes: PriceQuote[]      // per night, per room
}

export interface FlightOption {
  id: string
  airline: string
  from: string
  to: string
  departTime: string
  arriveTime: string
  durationMin: number
  stops: number
  baggageKg: number
  quote: PriceQuote         // per person
}

// ---------- Trip planning ----------

export type PlanMode = 'destination' | 'budget' | 'inspire'

export interface PlannerInput {
  mode: PlanMode
  origin: string
  stops: string[]           // destination ids, ordered
  days: number
  flexibleDates: boolean
  startDate?: string
  travellers: Travellers
  groupType: 'solo' | 'couple' | 'family' | 'friends' | 'group'
  style: TravelStyle
  weights: StyleWeights
  budget: number            // MYR total
  budgetMode: 'total' | 'perPerson' | 'daily'
  interests: Interest[]
  transportPreference: 'drive' | 'public' | 'fly' | 'best'
  vehicleId: string
  muslimFriendly: boolean
}

export interface CostBreakdown {
  transport: number
  accommodation: number
  food: number
  activities: number
  other: number             // insurance, misc
  contingency: number
  total: number
  perPerson: number
  perDayGroup: number
  perDayPerson: number
  detail: CostLine[]
}

export interface CostLine {
  category: 'transport' | 'accommodation' | 'food' | 'activities' | 'other' | 'contingency'
  label: string
  amount: number
  confidence: PriceConfidence
  perPerson?: boolean
}

export interface TransportPlan {
  legs: ComputedLeg[]
  totalKm: number
  totalDriveMin: number
  fuelCost: number
  tollCost: number
  parkingCost: number
  ticketCost: number        // flights/ferries/buses
  totalCost: number
  mode: 'drive' | 'public' | 'fly' | 'mixed'
}

export interface ComputedLeg {
  fromName: string
  toName: string
  mode: TransportMode
  km: number
  durationMin: number
  cost: number              // group cost for this leg
  note?: string
}

export interface ItineraryItem {
  time: string
  title: string
  icon: string
  durationH?: number
  costPerPerson?: number
  kind: 'travel' | 'meal' | 'activity' | 'hotel' | 'rest'
  note?: string
}

export interface ItineraryDay {
  day: number
  destId: string
  heading: string
  items: ItineraryItem[]
}

export interface TripPlan {
  tier: TravelStyle
  label: string
  recommended: boolean
  breakdown: CostBreakdown
  transport: TransportPlan
  hotelSummary: { destId: string; nights: number; rooms: number; style: TravelStyle; perNight: number }[]
  itinerary: ItineraryDay[]
  score: TripScore
  fatigue: FatigueReport
  explanations: string[]
}

export interface TripScore {
  total: number
  budget: number
  convenience: number
  experience: number
  travelTime: number
}

export interface FatigueReport {
  level: 'low' | 'moderate' | 'high'
  transportHours: number
  hotelChanges: number
  advice?: string
}

export interface SavingSuggestion {
  id: string
  label: string
  detail: string
  saving: number
  apply: Partial<PlannerInput>
}

// ---------- Saved trips & expenses ----------

export type TripStatus = 'planning' | 'ready' | 'booked' | 'traveling' | 'completed'

export interface Expense {
  id: string
  category: CostLine['category'] | 'shopping'
  label: string
  amount: number
  paidBy: string
  date: string
}

export interface SavedTrip {
  id: string
  name: string
  createdAt: string
  status: TripStatus
  input: PlannerInput
  chosenTier: TravelStyle
  estimatedTotal: number
  estimatedBreakdown: Pick<CostBreakdown, 'transport' | 'accommodation' | 'food' | 'activities' | 'other' | 'contingency' | 'total'>
  companions: string[]
  expenses: Expense[]
  checklist: { id: string; label: string; done: boolean; group: string }[]
}

export interface PriceAlert {
  id: string
  kind: 'hotel' | 'flight' | 'trip'
  label: string
  threshold: number
  createdAt: string
  active: boolean
}

// ---------- Providers ----------

export interface ProviderStatus {
  id: string
  name: string
  kind: 'accommodation' | 'flight' | 'transport' | 'activity' | 'currency' | 'weather' | 'maps'
  enabled: boolean
  configured: boolean
  demo: boolean
  lastSync: string | null
  rateLimit: string
  status: 'connected' | 'demo' | 'not-configured' | 'error'
}

export interface Vehicle {
  id: string
  name: string
  kind: 'petrol' | 'ev' | 'motorcycle'
  consumption: number       // km/L for petrol, kWh/100km for EV
  fuelPrice: number         // RM/L or RM/kWh
  seats: number
}
