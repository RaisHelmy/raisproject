import type { Destination, Interest, TravelStyle } from '../types'

// All prices are realistic MYR estimates (historical averages), used by the
// demo providers and budget engine. They are never presented as live prices.

type Partial5 = [number, number, number, number, number]

interface DestSeed {
  id: string
  name: string
  country?: string
  countryCode?: string
  currency?: string
  lat: number
  lng: number
  emoji: string
  gradient: string
  tagline: string
  description: string
  tags: Interest[]
  ratings: Destination['ratings']
  bestMonths: number[]
  nights: [number, number]
  difficulty?: Destination['difficulty']
  family?: boolean
  visa?: boolean
  hotelValue: number            // "value" tier per room/night; other tiers derived
  meals: Partial5
  activities: Destination['activities']
  flightFromKL?: number         // one-way per person, MYR
  island?: boolean
  hub?: boolean
}

function tiers(value: number): Record<TravelStyle, number> {
  return {
    budget: Math.round(value * 0.55),
    value,
    comfort: Math.round(value * 1.6),
    premium: Math.round(value * 2.6),
    luxury: Math.round(value * 4.4),
  }
}

function d(s: DestSeed): Destination {
  return {
    id: s.id,
    slug: s.id,
    name: s.name,
    country: s.country ?? 'Malaysia',
    countryCode: s.countryCode ?? 'MY',
    currency: s.currency ?? 'MYR',
    international: (s.countryCode ?? 'MY') !== 'MY',
    lat: s.lat,
    lng: s.lng,
    emoji: s.emoji,
    gradient: s.gradient,
    tagline: s.tagline,
    description: s.description,
    tags: s.tags,
    ratings: s.ratings,
    bestMonths: s.bestMonths,
    recommendedNights: s.nights,
    difficulty: s.difficulty ?? 'easy',
    familyFriendly: s.family ?? true,
    visaRequiredForMY: s.visa ?? false,
    hotelPerNight: tiers(s.hotelValue),
    meals: s.meals,
    activities: s.activities,
    flightFromKL: s.flightFromKL,
    domesticFlightHub: s.hub,
  }
}

export const ISLANDS: Record<string, { ferryPrice: number; ferryMinutes: number; port: string }> = {
  langkawi: { ferryPrice: 38, ferryMinutes: 105, port: 'Kuala Perlis' },
  redang: { ferryPrice: 55, ferryMinutes: 90, port: 'Merang Jetty' },
  perhentian: { ferryPrice: 70, ferryMinutes: 45, port: 'Kuala Besut' },
}

export const DESTINATIONS: Destination[] = [
  d({
    id: 'kuala-lumpur', name: 'Kuala Lumpur', lat: 3.139, lng: 101.687, emoji: '🏙️',
    gradient: 'linear-gradient(135deg,#134e5e,#71b280)',
    tagline: 'Skyline, street food and shopping', hub: true,
    description: 'Malaysia’s capital blends towering skylines with hawker food, mega malls and easy public transport.',
    tags: ['food', 'shopping', 'nightlife', 'culture', 'museums'],
    ratings: { food: 5, shopping: 5, culture: 4, family: 4 },
    bestMonths: [1, 2, 5, 6, 7], nights: [2, 3], hotelValue: 200,
    meals: [10, 15, 25, 8, 8],
    activities: [
      { name: 'Petronas Twin Towers Skybridge', price: 98, category: 'recommended', durationH: 2, interest: 'photography' },
      { name: 'Batu Caves', price: 0, category: 'recommended', durationH: 3, interest: 'heritage' },
      { name: 'Jalan Alor food night walk', price: 40, category: 'recommended', durationH: 2, interest: 'food' },
      { name: 'Aquaria KLCC', price: 69, category: 'optional', durationH: 2, interest: 'family' },
      { name: 'Merdeka 118 View', price: 89, category: 'optional', durationH: 2, interest: 'photography' },
    ],
  }),
  d({
    id: 'penang', name: 'Penang', lat: 5.414, lng: 100.329, emoji: '🍜',
    gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', hub: true,
    tagline: 'Street food capital of Malaysia',
    description: 'George Town’s UNESCO streets, legendary hawker food, street art and hill views make Penang the classic Malaysian getaway.',
    tags: ['food', 'culture', 'heritage', 'photography', 'family'],
    ratings: { food: 5, culture: 5, family: 5, beach: 3 },
    bestMonths: [12, 1, 2, 6, 7], nights: [2, 4], hotelValue: 180,
    meals: [10, 18, 25, 8, 10],
    activities: [
      { name: 'Penang Hill funicular', price: 30, category: 'recommended', durationH: 3, interest: 'nature' },
      { name: 'George Town heritage walk', price: 0, category: 'mandatory', durationH: 3, interest: 'heritage' },
      { name: 'Entopia butterfly farm', price: 65, category: 'optional', durationH: 3, interest: 'family' },
      { name: 'Street food tour', price: 80, category: 'recommended', durationH: 3, interest: 'food' },
      { name: 'Kek Lok Si Temple', price: 5, category: 'recommended', durationH: 2, interest: 'culture' },
      { name: 'ESCAPE theme park', price: 155, category: 'optional', durationH: 5, interest: 'themeparks' },
    ],
  }),
  d({
    id: 'langkawi', name: 'Langkawi', lat: 6.35, lng: 99.8, emoji: '🏝️',
    gradient: 'linear-gradient(135deg,#00b4db,#0083b0)', island: true, hub: true,
    tagline: 'Duty-free island paradise',
    description: '99 islands of beaches, mangroves and the famous SkyBridge — plus duty-free shopping and sunset cruises.',
    tags: ['beach', 'nature', 'family', 'relaxation', 'photography'],
    ratings: { beach: 5, family: 5, nature: 4, food: 3 },
    bestMonths: [12, 1, 2, 3], nights: [3, 4], hotelValue: 220, flightFromKL: 160,
    meals: [12, 18, 28, 10, 10],
    activities: [
      { name: 'Langkawi SkyCab + SkyBridge', price: 85, category: 'recommended', durationH: 4, interest: 'nature' },
      { name: 'Island hopping boat tour', price: 45, category: 'recommended', durationH: 4, interest: 'beach' },
      { name: 'Mangrove kayaking', price: 120, category: 'optional', durationH: 4, interest: 'adventure' },
      { name: 'Cenang Beach sunset', price: 0, category: 'mandatory', durationH: 2, interest: 'relaxation' },
      { name: 'Underwater World', price: 50, category: 'optional', durationH: 2, interest: 'family' },
    ],
  }),
  d({
    id: 'ipoh', name: 'Ipoh', lat: 4.598, lng: 101.09, emoji: '☕',
    gradient: 'linear-gradient(135deg,#8e9eab,#eef2f3)',
    tagline: 'White coffee and limestone caves',
    description: 'Colonial old town, cave temples, famous white coffee and some of the best value food in Malaysia.',
    tags: ['food', 'heritage', 'nature', 'photography'],
    ratings: { food: 5, culture: 4, nature: 4, family: 4 },
    bestMonths: [1, 2, 5, 6, 7], nights: [1, 2], hotelValue: 140,
    meals: [8, 14, 20, 6, 8],
    activities: [
      { name: 'Concubine Lane old town walk', price: 0, category: 'mandatory', durationH: 2, interest: 'heritage' },
      { name: 'Kek Lok Tong cave temple', price: 0, category: 'recommended', durationH: 2, interest: 'nature' },
      { name: 'Lost World of Tambun', price: 128, category: 'optional', durationH: 6, interest: 'themeparks' },
      { name: 'White coffee tasting', price: 15, category: 'recommended', durationH: 1, interest: 'food' },
    ],
  }),
  d({
    id: 'melaka', name: 'Melaka', lat: 2.19, lng: 102.25, emoji: '🏛️',
    gradient: 'linear-gradient(135deg,#c94b4b,#4b134f)',
    tagline: 'History on every street corner',
    description: 'A UNESCO World Heritage city of Dutch squares, Peranakan food, river cruises and weekend night markets.',
    tags: ['history', 'heritage', 'food', 'culture', 'photography'],
    ratings: { culture: 5, food: 4, family: 4, shopping: 3 },
    bestMonths: [1, 2, 3, 6, 7], nights: [1, 2], hotelValue: 160,
    meals: [9, 15, 22, 7, 10],
    activities: [
      { name: 'Jonker Street night market', price: 0, category: 'mandatory', durationH: 3, interest: 'food' },
      { name: 'Melaka River cruise', price: 30, category: 'recommended', durationH: 1, interest: 'photography' },
      { name: 'A Famosa & Stadthuys', price: 10, category: 'recommended', durationH: 2, interest: 'history' },
      { name: 'Baba Nyonya Heritage Museum', price: 20, category: 'optional', durationH: 2, interest: 'museums' },
    ],
  }),
  d({
    id: 'cameron-highlands', name: 'Cameron Highlands', lat: 4.47, lng: 101.38, emoji: '🍵',
    gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',
    tagline: 'Tea plantations in the clouds', difficulty: 'moderate',
    description: 'Cool mountain air, rolling tea estates, strawberry farms and mossy forest trails, 1,500m above sea level.',
    tags: ['nature', 'relaxation', 'family', 'photography'],
    ratings: { nature: 5, family: 4, food: 3 },
    bestMonths: [2, 3, 4, 5, 6], nights: [1, 2], hotelValue: 170,
    meals: [10, 16, 22, 8, 10],
    activities: [
      { name: 'BOH Tea Plantation tour', price: 5, category: 'mandatory', durationH: 3, interest: 'nature' },
      { name: 'Mossy Forest boardwalk', price: 30, category: 'recommended', durationH: 3, interest: 'adventure' },
      { name: 'Strawberry farm picking', price: 25, category: 'optional', durationH: 1, interest: 'family' },
      { name: 'Cameron Lavender Garden', price: 10, category: 'optional', durationH: 1, interest: 'photography' },
    ],
  }),
  d({
    id: 'johor-bahru', name: 'Johor Bahru', lat: 1.4927, lng: 103.7414, emoji: '🎢',
    gradient: 'linear-gradient(135deg,#7f00ff,#e100ff)',
    tagline: 'Theme parks and border-town buzz',
    description: 'Gateway to Legoland and Singapore, with great local food and family attractions.',
    tags: ['themeparks', 'family', 'food', 'shopping'],
    ratings: { family: 5, shopping: 4, food: 4 },
    bestMonths: [1, 2, 3, 6, 7], nights: [1, 2], hotelValue: 170,
    meals: [9, 15, 22, 7, 9],
    activities: [
      { name: 'LEGOLAND Malaysia', price: 249, category: 'recommended', durationH: 7, interest: 'themeparks' },
      { name: 'Johor Bahru old town food trail', price: 0, category: 'recommended', durationH: 3, interest: 'food' },
      { name: 'Desaru Coast day trip', price: 60, category: 'optional', durationH: 6, interest: 'beach' },
    ],
  }),
  d({
    id: 'port-dickson', name: 'Port Dickson', lat: 2.522, lng: 101.796, emoji: '🌅',
    gradient: 'linear-gradient(135deg,#fc4a1a,#f7b733)',
    tagline: 'The closest beach to KL',
    description: 'Weekend beach escape with water chalets, an army museum and easy driving distance from the Klang Valley.',
    tags: ['beach', 'family', 'relaxation'],
    ratings: { beach: 3, family: 4 },
    bestMonths: [1, 2, 3, 4, 5, 6], nights: [1, 2], hotelValue: 180,
    meals: [9, 15, 22, 7, 8],
    activities: [
      { name: 'Blue Lagoon beach day', price: 0, category: 'mandatory', durationH: 4, interest: 'beach' },
      { name: 'Cape Rachado lighthouse hike', price: 0, category: 'recommended', durationH: 2, interest: 'nature' },
      { name: 'Army Museum', price: 0, category: 'optional', durationH: 2, interest: 'museums' },
    ],
  }),
  d({
    id: 'kuala-selangor', name: 'Kuala Selangor', lat: 3.339, lng: 101.25, emoji: '✨',
    gradient: 'linear-gradient(135deg,#1a2980,#26d0ce)',
    tagline: 'Fireflies and fresh seafood',
    description: 'Famous for firefly river cruises, Sky Mirror tours and seafood villages at the mouth of the Selangor river.',
    tags: ['nature', 'food', 'photography', 'family'],
    ratings: { nature: 4, food: 4, family: 4 },
    bestMonths: [3, 4, 5, 6, 7, 8], nights: [1, 1], hotelValue: 130,
    meals: [8, 14, 25, 6, 8],
    activities: [
      { name: 'Firefly river cruise', price: 27, category: 'mandatory', durationH: 1, interest: 'nature' },
      { name: 'Sky Mirror tour', price: 60, category: 'recommended', durationH: 4, interest: 'photography' },
      { name: 'Bukit Melawati & silverleaf monkeys', price: 5, category: 'recommended', durationH: 2, interest: 'family' },
    ],
  }),
  d({
    id: 'sekinchan', name: 'Sekinchan', lat: 3.505, lng: 101.103, emoji: '🌾',
    gradient: 'linear-gradient(135deg,#56ab2f,#a8e063)',
    tagline: 'Paddy fields and fishing villages',
    description: 'Endless green paddy fields, a working fishing village and famous fresh seafood — a photogenic half-day stop.',
    tags: ['nature', 'food', 'photography'],
    ratings: { nature: 4, food: 4 },
    bestMonths: [3, 4, 9, 10], nights: [1, 1], hotelValue: 120,
    meals: [8, 14, 24, 6, 8],
    activities: [
      { name: 'Paddy field viewpoints', price: 0, category: 'mandatory', durationH: 2, interest: 'photography' },
      { name: 'Paddy Gallery', price: 5, category: 'optional', durationH: 1, interest: 'culture' },
      { name: 'Redang Beach (Sekinchan)', price: 0, category: 'recommended', durationH: 1, interest: 'relaxation' },
    ],
  }),
  d({
    id: 'kuantan', name: 'Kuantan', lat: 3.808, lng: 103.326, emoji: '🌊',
    gradient: 'linear-gradient(135deg,#2b5876,#4e4376)',
    tagline: 'East coast gateway',
    description: 'Riverfront city with Teluk Cempedak beach, a giant sitting on the riverbank, and access to the east coast.',
    tags: ['beach', 'food', 'family'],
    ratings: { beach: 3, food: 4, family: 4 },
    bestMonths: [3, 4, 5, 6, 7, 8], nights: [1, 2], hotelValue: 150,
    meals: [8, 14, 20, 6, 8],
    activities: [
      { name: 'Teluk Cempedak beach', price: 0, category: 'mandatory', durationH: 3, interest: 'beach' },
      { name: 'Kuantan River cruise', price: 30, category: 'optional', durationH: 2, interest: 'nature' },
      { name: 'Natural Batik Village', price: 0, category: 'optional', durationH: 1, interest: 'culture' },
    ],
  }),
  d({
    id: 'cherating', name: 'Cherating', lat: 4.121, lng: 103.393, emoji: '🐢',
    gradient: 'linear-gradient(135deg,#43cea2,#185a9d)',
    tagline: 'Laid-back surf and turtles',
    description: 'A sleepy beach village known for turtle sanctuaries, firefly cruises and monsoon-season surfing.',
    tags: ['beach', 'nature', 'relaxation', 'adventure'],
    ratings: { beach: 4, nature: 4, family: 4 },
    bestMonths: [4, 5, 6, 7, 8], nights: [1, 2], hotelValue: 160,
    meals: [9, 15, 22, 7, 8],
    activities: [
      { name: 'Turtle sanctuary visit', price: 5, category: 'recommended', durationH: 2, interest: 'nature' },
      { name: 'Cherating river firefly cruise', price: 40, category: 'recommended', durationH: 1, interest: 'nature' },
      { name: 'Surf lesson (seasonal)', price: 120, category: 'optional', durationH: 2, interest: 'adventure' },
    ],
  }),
  d({
    id: 'kuala-terengganu', name: 'Kuala Terengganu', lat: 5.33, lng: 103.14, emoji: '🕌',
    gradient: 'linear-gradient(135deg,#2193b0,#6dd5ed)',
    tagline: 'Culture on the east coast',
    description: 'Drawbridge views, the Crystal Mosque, keropok lekor and jetties to Redang and other islands.',
    tags: ['culture', 'heritage', 'food', 'beach'],
    ratings: { culture: 4, food: 4, beach: 3 },
    bestMonths: [3, 4, 5, 6, 7, 8], nights: [1, 2], hotelValue: 150,
    meals: [8, 13, 20, 6, 8],
    activities: [
      { name: 'Crystal Mosque & Islamic park', price: 10, category: 'recommended', durationH: 2, interest: 'heritage' },
      { name: 'Pasar Payang central market', price: 0, category: 'recommended', durationH: 2, interest: 'food' },
      { name: 'Drawbridge sunset walk', price: 5, category: 'optional', durationH: 1, interest: 'photography' },
    ],
  }),
  d({
    id: 'redang', name: 'Redang Island', lat: 5.78, lng: 103.01, emoji: '🤿',
    gradient: 'linear-gradient(135deg,#00c6ff,#0072ff)', island: true, difficulty: 'moderate',
    tagline: 'Crystal water snorkelling',
    description: 'One of Malaysia’s clearest waters — white sand, coral reefs and resort packages. Closed during monsoon (Nov–Feb).',
    tags: ['beach', 'nature', 'relaxation', 'adventure'],
    ratings: { beach: 5, nature: 5, family: 4 },
    bestMonths: [3, 4, 5, 6, 7, 8, 9], nights: [2, 3], hotelValue: 320,
    meals: [15, 25, 35, 10, 10],
    activities: [
      { name: 'Snorkelling trip (3 stops)', price: 60, category: 'recommended', durationH: 4, interest: 'beach' },
      { name: 'Marine park fee', price: 5, category: 'mandatory', durationH: 1, interest: 'nature' },
      { name: 'Discover scuba dive', price: 280, category: 'optional', durationH: 3, interest: 'adventure' },
    ],
  }),
  d({
    id: 'kota-bharu', name: 'Kota Bharu', lat: 6.125, lng: 102.238, emoji: '🎨',
    gradient: 'linear-gradient(135deg,#ff9966,#ff5e62)',
    tagline: 'Kelantan’s cultural heart',
    description: 'Batik workshops, wau kites, night markets and nasi kerabu — plus the jetty to the Perhentians.',
    tags: ['culture', 'food', 'heritage'],
    ratings: { culture: 5, food: 4 },
    bestMonths: [3, 4, 5, 6, 7, 8], nights: [1, 2], hotelValue: 130,
    meals: [7, 12, 18, 6, 8],
    activities: [
      { name: 'Siti Khadijah market', price: 0, category: 'mandatory', durationH: 2, interest: 'food' },
      { name: 'Batik workshop', price: 40, category: 'recommended', durationH: 2, interest: 'culture' },
      { name: 'Istana Jahar museum', price: 5, category: 'optional', durationH: 2, interest: 'museums' },
    ],
  }),
  d({
    id: 'perhentian', name: 'Perhentian Islands', lat: 5.915, lng: 102.72, emoji: '🐠',
    gradient: 'linear-gradient(135deg,#36d1dc,#5b86e5)', island: true, difficulty: 'moderate',
    tagline: 'Backpacker island magic',
    description: 'Turquoise bays, cheap dive schools and barefoot beach bars. Closed during monsoon (Nov–Feb).',
    tags: ['beach', 'adventure', 'nature', 'relaxation'],
    ratings: { beach: 5, adventure: 5, nature: 5 },
    bestMonths: [3, 4, 5, 6, 7, 8, 9], nights: [2, 3], hotelValue: 250,
    meals: [12, 20, 30, 10, 8],
    activities: [
      { name: 'Snorkelling day trip', price: 50, category: 'recommended', durationH: 5, interest: 'beach' },
      { name: 'Marine park fee', price: 5, category: 'mandatory', durationH: 1, interest: 'nature' },
      { name: 'Open water dive course', price: 1100, category: 'optional', durationH: 8, interest: 'adventure' },
    ],
  }),
  d({
    id: 'kota-kinabalu', name: 'Kota Kinabalu', lat: 5.98, lng: 116.073, emoji: '⛰️',
    gradient: 'linear-gradient(135deg,#ee9ca7,#ffdde1)', hub: true,
    tagline: 'Sunsets and Borneo adventures',
    description: 'Borneo’s friendly capital — famous sunsets, island hopping, seafood markets and the gateway to Mt Kinabalu.',
    tags: ['beach', 'nature', 'food', 'adventure', 'family'],
    ratings: { beach: 4, nature: 5, food: 4, family: 4 },
    bestMonths: [2, 3, 4, 5, 8, 9], nights: [3, 4], hotelValue: 200, flightFromKL: 250,
    meals: [10, 16, 28, 8, 10],
    activities: [
      { name: 'Tunku Abdul Rahman island hopping', price: 90, category: 'recommended', durationH: 6, interest: 'beach' },
      { name: 'KK sunset at Tanjung Aru', price: 0, category: 'mandatory', durationH: 2, interest: 'photography' },
      { name: 'Filipino market seafood dinner', price: 40, category: 'recommended', durationH: 2, interest: 'food' },
      { name: 'Mari Mari Cultural Village', price: 100, category: 'optional', durationH: 4, interest: 'culture' },
    ],
  }),
  d({
    id: 'kundasang', name: 'Kundasang', lat: 5.98, lng: 116.58, emoji: '🐄',
    gradient: 'linear-gradient(135deg,#5a3f37,#2c7744)', difficulty: 'moderate',
    tagline: 'Malaysia’s Little New Zealand',
    description: 'Mountain views of Kinabalu, the Desa Dairy Farm, war memorial gardens and cool highland air.',
    tags: ['nature', 'relaxation', 'photography', 'family'],
    ratings: { nature: 5, family: 4 },
    bestMonths: [2, 3, 4, 5, 8, 9], nights: [1, 2], hotelValue: 180,
    meals: [10, 15, 22, 8, 8],
    activities: [
      { name: 'Desa Dairy Farm', price: 10, category: 'recommended', durationH: 2, interest: 'family' },
      { name: 'Kinabalu Park trails', price: 25, category: 'recommended', durationH: 3, interest: 'nature' },
      { name: 'Sosodikon Hill sunrise', price: 10, category: 'optional', durationH: 2, interest: 'photography' },
    ],
  }),
  d({
    id: 'semporna', name: 'Semporna & Mabul', lat: 4.485, lng: 118.611, emoji: '🌊',
    gradient: 'linear-gradient(135deg,#4568dc,#b06ab3)', difficulty: 'challenging', island: true,
    tagline: 'World-class diving waters',
    description: 'Launchpad to Mabul, Kapalai and Sipadan — some of the best diving and snorkelling on the planet.',
    tags: ['adventure', 'beach', 'nature'],
    ratings: { beach: 5, adventure: 5, nature: 5 },
    bestMonths: [3, 4, 5, 6, 7, 8], nights: [2, 3], hotelValue: 280, flightFromKL: 330,
    meals: [10, 16, 25, 8, 8],
    activities: [
      { name: 'Mabul + Kapalai snorkel trip', price: 180, category: 'recommended', durationH: 8, interest: 'beach' },
      { name: 'Bohey Dulang hike', price: 130, category: 'recommended', durationH: 6, interest: 'adventure' },
      { name: 'Sipadan dive (permit required)', price: 450, category: 'optional', durationH: 8, interest: 'adventure' },
    ],
  }),
  d({
    id: 'kuching', name: 'Kuching', lat: 1.553, lng: 110.359, emoji: '🐱',
    gradient: 'linear-gradient(135deg,#603813,#b29f94)', hub: true,
    tagline: 'Cat city on the Sarawak river',
    description: 'Laid-back waterfront, Sarawak laksa, orangutans at Semenggoh and easy trips to Bako National Park.',
    tags: ['nature', 'food', 'culture', 'family'],
    ratings: { nature: 5, food: 4, culture: 4, family: 4 },
    bestMonths: [4, 5, 6, 7, 8, 9], nights: [3, 4], hotelValue: 170, flightFromKL: 220,
    meals: [8, 14, 22, 7, 8],
    activities: [
      { name: 'Semenggoh orangutan centre', price: 10, category: 'recommended', durationH: 3, interest: 'nature' },
      { name: 'Waterfront & Sarawak laksa crawl', price: 25, category: 'mandatory', durationH: 3, interest: 'food' },
      { name: 'Bako National Park day trip', price: 60, category: 'recommended', durationH: 8, interest: 'adventure' },
      { name: 'Sarawak Cultural Village (Damai)', price: 95, category: 'optional', durationH: 5, interest: 'culture' },
    ],
  }),
  // ---------- International ----------
  d({
    id: 'singapore', name: 'Singapore', country: 'Singapore', countryCode: 'SG', currency: 'SGD',
    lat: 1.3521, lng: 103.8198, emoji: '🦁',
    gradient: 'linear-gradient(135deg,#e53935,#e35d5b)',
    tagline: 'The garden city next door',
    description: 'Gardens by the Bay, hawker centres, Sentosa and world-class attractions — all a bus ride from JB.',
    tags: ['family', 'food', 'shopping', 'themeparks', 'museums'],
    ratings: { family: 5, food: 5, shopping: 5, culture: 4 },
    bestMonths: [2, 3, 4, 6, 7], nights: [3, 4], hotelValue: 550, flightFromKL: 260,
    meals: [18, 28, 45, 15, 12],
    activities: [
      { name: 'Gardens by the Bay (domes)', price: 120, category: 'recommended', durationH: 4, interest: 'nature' },
      { name: 'Universal Studios Singapore', price: 290, category: 'optional', durationH: 8, interest: 'themeparks' },
      { name: 'Hawker centre food crawl', price: 40, category: 'mandatory', durationH: 2, interest: 'food' },
      { name: 'Marina Bay night walk', price: 0, category: 'recommended', durationH: 2, interest: 'photography' },
    ],
  }),
  d({
    id: 'bangkok', name: 'Bangkok', country: 'Thailand', countryCode: 'TH', currency: 'THB',
    lat: 13.7563, lng: 100.5018, emoji: '🛺',
    gradient: 'linear-gradient(135deg,#f5af19,#f12711)',
    tagline: 'Temples, tuk-tuks and street food',
    description: 'Grand palaces, floating markets, rooftop bars and some of the best street food in Asia.',
    tags: ['food', 'shopping', 'culture', 'nightlife', 'photography'],
    ratings: { food: 5, shopping: 5, culture: 5, family: 3 },
    bestMonths: [11, 12, 1, 2], nights: [3, 4], hotelValue: 280, flightFromKL: 300,
    meals: [12, 18, 30, 10, 12],
    activities: [
      { name: 'Grand Palace & Wat Phra Kaew', price: 65, category: 'recommended', durationH: 3, interest: 'culture' },
      { name: 'Chatuchak weekend market', price: 0, category: 'recommended', durationH: 4, interest: 'shopping' },
      { name: 'Chao Phraya river boat', price: 5, category: 'recommended', durationH: 1, interest: 'photography' },
      { name: 'Damnoen Saduak floating market', price: 120, category: 'optional', durationH: 6, interest: 'culture' },
    ],
  }),
  d({
    id: 'phuket', name: 'Phuket', country: 'Thailand', countryCode: 'TH', currency: 'THB',
    lat: 7.8804, lng: 98.3923, emoji: '🛶',
    gradient: 'linear-gradient(135deg,#00cdac,#02aab0)', island: true,
    tagline: 'Andaman beaches and boat trips',
    description: 'Thailand’s biggest island — Phi Phi boat trips, old town charm and long white beaches.',
    tags: ['beach', 'nightlife', 'relaxation', 'adventure'],
    ratings: { beach: 5, nature: 4, food: 4 },
    bestMonths: [11, 12, 1, 2, 3], nights: [3, 5], hotelValue: 300, flightFromKL: 330,
    meals: [14, 22, 35, 12, 12],
    activities: [
      { name: 'Phi Phi islands speedboat tour', price: 220, category: 'recommended', durationH: 8, interest: 'beach' },
      { name: 'Old Phuket Town walk', price: 0, category: 'recommended', durationH: 3, interest: 'photography' },
      { name: 'Big Buddha viewpoint', price: 0, category: 'optional', durationH: 2, interest: 'culture' },
    ],
  }),
  d({
    id: 'bali', name: 'Bali', country: 'Indonesia', countryCode: 'ID', currency: 'IDR',
    lat: -8.4095, lng: 115.1889, emoji: '🌺',
    gradient: 'linear-gradient(135deg,#1d976c,#93f9b9)', island: true,
    tagline: 'Island of the gods',
    description: 'Rice terraces, cliff temples, surf beaches and café culture from Ubud to Uluwatu.',
    tags: ['beach', 'nature', 'culture', 'relaxation', 'photography'],
    ratings: { beach: 5, nature: 5, culture: 5, food: 4 },
    bestMonths: [4, 5, 6, 7, 8, 9], nights: [4, 6], hotelValue: 260, flightFromKL: 350,
    meals: [12, 20, 32, 12, 10],
    activities: [
      { name: 'Tegalalang rice terraces', price: 15, category: 'recommended', durationH: 3, interest: 'nature' },
      { name: 'Uluwatu temple & kecak dance', price: 45, category: 'recommended', durationH: 4, interest: 'culture' },
      { name: 'Nusa Penida day trip', price: 250, category: 'optional', durationH: 10, interest: 'adventure' },
      { name: 'Ubud market & palace', price: 0, category: 'recommended', durationH: 3, interest: 'shopping' },
    ],
  }),
  d({
    id: 'jakarta', name: 'Jakarta', country: 'Indonesia', countryCode: 'ID', currency: 'IDR',
    lat: -6.2088, lng: 106.8456, emoji: '🌇',
    gradient: 'linear-gradient(135deg,#556270,#ff6b6b)',
    tagline: 'Indonesia’s mega-city',
    description: 'Colonial Kota Tua, giant malls, street food and a fast-moving capital energy.',
    tags: ['food', 'shopping', 'nightlife', 'museums'],
    ratings: { shopping: 4, food: 4, culture: 3 },
    bestMonths: [5, 6, 7, 8, 9], nights: [2, 3], hotelValue: 220, flightFromKL: 320,
    meals: [10, 16, 28, 10, 10],
    activities: [
      { name: 'Kota Tua old town', price: 0, category: 'recommended', durationH: 3, interest: 'history' },
      { name: 'National Monument (Monas)', price: 10, category: 'optional', durationH: 2, interest: 'museums' },
      { name: 'Grand Indonesia mall crawl', price: 0, category: 'optional', durationH: 3, interest: 'shopping' },
    ],
  }),
  d({
    id: 'hanoi', name: 'Hanoi', country: 'Vietnam', countryCode: 'VN', currency: 'VND',
    lat: 21.0278, lng: 105.8342, emoji: '🍜',
    gradient: 'linear-gradient(135deg,#134e5e,#71b280)',
    tagline: 'Old quarter charm and pho',
    description: 'Lakeside old quarter, egg coffee, water puppets and day trips to Ha Long Bay.',
    tags: ['food', 'culture', 'history', 'photography'],
    ratings: { food: 5, culture: 5, nature: 4 },
    bestMonths: [10, 11, 3, 4], nights: [3, 4], hotelValue: 200, flightFromKL: 350,
    meals: [10, 15, 25, 8, 10],
    activities: [
      { name: 'Old Quarter walking tour', price: 0, category: 'mandatory', durationH: 3, interest: 'culture' },
      { name: 'Ha Long Bay day cruise', price: 250, category: 'recommended', durationH: 12, interest: 'nature' },
      { name: 'Train Street café', price: 10, category: 'optional', durationH: 1, interest: 'photography' },
    ],
  }),
  d({
    id: 'ho-chi-minh', name: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', currency: 'VND',
    lat: 10.8231, lng: 106.6297, emoji: '🏍️',
    gradient: 'linear-gradient(135deg,#c33764,#1d2671)',
    tagline: 'Saigon’s non-stop energy',
    description: 'War history, French colonial landmarks, rooftop bars and banh mi on every corner.',
    tags: ['food', 'history', 'nightlife', 'shopping'],
    ratings: { food: 5, culture: 4, shopping: 4 },
    bestMonths: [12, 1, 2, 3], nights: [3, 4], hotelValue: 210, flightFromKL: 330,
    meals: [10, 15, 25, 8, 10],
    activities: [
      { name: 'War Remnants Museum', price: 8, category: 'recommended', durationH: 2, interest: 'history' },
      { name: 'Cu Chi tunnels half-day', price: 90, category: 'recommended', durationH: 5, interest: 'history' },
      { name: 'Ben Thanh street food night', price: 30, category: 'mandatory', durationH: 2, interest: 'food' },
    ],
  }),
  d({
    id: 'tokyo', name: 'Tokyo', country: 'Japan', countryCode: 'JP', currency: 'JPY',
    lat: 35.6762, lng: 139.6503, emoji: '🗼',
    gradient: 'linear-gradient(135deg,#ff512f,#dd2476)',
    tagline: 'The city of everything',
    description: 'Shibuya crossings, sushi counters, temples and pop culture — endlessly explorable.',
    tags: ['food', 'shopping', 'culture', 'themeparks', 'photography'],
    ratings: { food: 5, shopping: 5, culture: 5, family: 4 },
    bestMonths: [3, 4, 10, 11], nights: [4, 6], hotelValue: 550, flightFromKL: 900,
    meals: [25, 45, 70, 15, 15],
    activities: [
      { name: 'Senso-ji & Asakusa', price: 0, category: 'recommended', durationH: 3, interest: 'culture' },
      { name: 'Shibuya & Harajuku walk', price: 0, category: 'mandatory', durationH: 4, interest: 'shopping' },
      { name: 'teamLab Planets', price: 115, category: 'optional', durationH: 3, interest: 'photography' },
      { name: 'Tokyo DisneySea', price: 260, category: 'optional', durationH: 10, interest: 'themeparks' },
    ],
  }),
  d({
    id: 'osaka', name: 'Osaka', country: 'Japan', countryCode: 'JP', currency: 'JPY',
    lat: 34.6937, lng: 135.5023, emoji: '🐙',
    gradient: 'linear-gradient(135deg,#fc466b,#3f5efb)',
    tagline: 'Japan’s kitchen',
    description: 'Dotonbori neon, takoyaki, Osaka Castle and easy day trips to Nara and Kyoto.',
    tags: ['food', 'shopping', 'nightlife', 'themeparks'],
    ratings: { food: 5, shopping: 4, family: 4 },
    bestMonths: [3, 4, 10, 11], nights: [3, 4], hotelValue: 480, flightFromKL: 850,
    meals: [22, 40, 65, 15, 15],
    activities: [
      { name: 'Dotonbori food crawl', price: 60, category: 'mandatory', durationH: 3, interest: 'food' },
      { name: 'Osaka Castle', price: 20, category: 'recommended', durationH: 2, interest: 'history' },
      { name: 'Universal Studios Japan', price: 270, category: 'optional', durationH: 10, interest: 'themeparks' },
    ],
  }),
  d({
    id: 'kyoto', name: 'Kyoto', country: 'Japan', countryCode: 'JP', currency: 'JPY',
    lat: 35.0116, lng: 135.7681, emoji: '⛩️',
    gradient: 'linear-gradient(135deg,#d31027,#ea384d)',
    tagline: 'A thousand temples',
    description: 'Fushimi Inari gates, bamboo groves, geisha districts and tea houses.',
    tags: ['culture', 'heritage', 'nature', 'photography'],
    ratings: { culture: 5, nature: 4, food: 4 },
    bestMonths: [3, 4, 10, 11], nights: [2, 3], hotelValue: 500,
    meals: [22, 40, 65, 15, 15],
    activities: [
      { name: 'Fushimi Inari shrine', price: 0, category: 'mandatory', durationH: 3, interest: 'culture' },
      { name: 'Arashiyama bamboo grove', price: 0, category: 'recommended', durationH: 3, interest: 'nature' },
      { name: 'Kiyomizu-dera & Gion walk', price: 12, category: 'recommended', durationH: 4, interest: 'heritage' },
    ],
  }),
  d({
    id: 'seoul', name: 'Seoul', country: 'South Korea', countryCode: 'KR', currency: 'KRW',
    lat: 37.5665, lng: 126.978, emoji: '🏮',
    gradient: 'linear-gradient(135deg,#5f2c82,#49a09d)',
    tagline: 'K-culture capital',
    description: 'Palaces and hanbok, Myeongdong shopping, Korean BBQ and mountain-top city views.',
    tags: ['shopping', 'food', 'culture', 'nightlife'],
    ratings: { shopping: 5, food: 5, culture: 4 },
    bestMonths: [4, 5, 9, 10], nights: [4, 5], hotelValue: 450, flightFromKL: 800,
    meals: [20, 35, 55, 15, 15],
    activities: [
      { name: 'Gyeongbokgung Palace', price: 10, category: 'recommended', durationH: 3, interest: 'culture' },
      { name: 'Myeongdong street food & shopping', price: 50, category: 'mandatory', durationH: 3, interest: 'shopping' },
      { name: 'N Seoul Tower', price: 50, category: 'optional', durationH: 3, interest: 'photography' },
    ],
  }),
  d({
    id: 'taipei', name: 'Taipei', country: 'Taiwan', countryCode: 'TW', currency: 'TWD',
    lat: 25.033, lng: 121.5654, emoji: '🧋',
    gradient: 'linear-gradient(135deg,#16bffd,#cb3066)',
    tagline: 'Night markets and hot springs',
    description: 'Shilin night market, Taipei 101, Jiufen day trips and the home of bubble tea.',
    tags: ['food', 'shopping', 'nature', 'nightlife'],
    ratings: { food: 5, shopping: 4, nature: 4 },
    bestMonths: [10, 11, 12, 3, 4], nights: [4, 5], hotelValue: 400, flightFromKL: 750,
    meals: [15, 28, 45, 12, 15],
    activities: [
      { name: 'Shilin night market', price: 40, category: 'mandatory', durationH: 3, interest: 'food' },
      { name: 'Taipei 101 observatory', price: 85, category: 'optional', durationH: 2, interest: 'photography' },
      { name: 'Jiufen & Shifen day trip', price: 130, category: 'recommended', durationH: 8, interest: 'nature' },
    ],
  }),
  d({
    id: 'hong-kong', name: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', currency: 'HKD',
    lat: 22.3193, lng: 114.1694, emoji: '🌉',
    gradient: 'linear-gradient(135deg,#141e30,#243b55)',
    tagline: 'Skyline meets dim sum',
    description: 'Victoria Peak, star ferries, dim sum institutions and Disneyland.',
    tags: ['food', 'shopping', 'themeparks', 'photography'],
    ratings: { food: 5, shopping: 5, family: 4 },
    bestMonths: [10, 11, 12, 3], nights: [3, 4], hotelValue: 600, flightFromKL: 700,
    meals: [22, 38, 60, 15, 15],
    activities: [
      { name: 'Victoria Peak tram', price: 45, category: 'recommended', durationH: 3, interest: 'photography' },
      { name: 'Star Ferry & TST promenade', price: 3, category: 'mandatory', durationH: 2, interest: 'culture' },
      { name: 'Hong Kong Disneyland', price: 380, category: 'optional', durationH: 9, interest: 'themeparks' },
    ],
  }),
]

export const DEST_MAP: Record<string, Destination> = Object.fromEntries(DESTINATIONS.map((x) => [x.id, x]))

export function getDestination(id: string): Destination | undefined {
  return DEST_MAP[id]
}

// Origin cities users can start from (Klang Valley cities share KL coordinates for costing)
export const ORIGINS: { id: string; name: string; lat: number; lng: number }[] = [
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', lat: 3.139, lng: 101.687 },
  { id: 'petaling-jaya', name: 'Petaling Jaya', lat: 3.107, lng: 101.606 },
  { id: 'shah-alam', name: 'Shah Alam', lat: 3.073, lng: 101.518 },
  { id: 'johor-bahru', name: 'Johor Bahru', lat: 1.4927, lng: 103.7414 },
  { id: 'penang', name: 'Penang', lat: 5.414, lng: 100.329 },
  { id: 'kota-kinabalu', name: 'Kota Kinabalu', lat: 5.98, lng: 116.073 },
  { id: 'kuching', name: 'Kuching', lat: 1.553, lng: 110.359 },
]

export function originPoint(id: string): { lat: number; lng: number; name: string } {
  const o = ORIGINS.find((x) => x.id === id) ?? ORIGINS[0]
  return o
}

export const INTEREST_LABELS: Record<Interest, { label: string; icon: string }> = {
  food: { label: 'Food', icon: 'bi-cup-hot' },
  nature: { label: 'Nature', icon: 'bi-tree' },
  beach: { label: 'Beach', icon: 'bi-water' },
  shopping: { label: 'Shopping', icon: 'bi-bag' },
  history: { label: 'History', icon: 'bi-hourglass-split' },
  culture: { label: 'Culture', icon: 'bi-globe-asia-australia' },
  adventure: { label: 'Adventure', icon: 'bi-compass' },
  family: { label: 'Family', icon: 'bi-people' },
  photography: { label: 'Photography', icon: 'bi-camera' },
  nightlife: { label: 'Nightlife', icon: 'bi-moon-stars' },
  themeparks: { label: 'Theme parks', icon: 'bi-stars' },
  museums: { label: 'Museums', icon: 'bi-bank' },
  heritage: { label: 'Heritage', icon: 'bi-building' },
  roadtrip: { label: 'Road trip', icon: 'bi-signpost-split' },
  luxury: { label: 'Luxury', icon: 'bi-gem' },
  relaxation: { label: 'Relaxation', icon: 'bi-flower1' },
}
