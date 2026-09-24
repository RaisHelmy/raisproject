import type { TravelRoute, FoodPlace, GroceryStore } from '../types';

// Demo data — illustrative routes and places, not live listings.
export const ROUTES: TravelRoute[] = [
  {
    id: 'kl-penang',
    name: 'KL → Penang (North-South Highway)',
    from: 'Kuala Lumpur', to: 'George Town, Penang',
    distanceKm: 360, driveHours: 4,
    stops: [
      { name: 'Tapah R&R', km: 130, kind: 'meal', suggestion: 'Classic highway stop — nasi campur, mee sup', pricePerPerson: [8, 15] },
      { name: 'Ipoh (exit)', km: 200, kind: 'meal', suggestion: 'Detour for nga choi kai (chicken & beansprouts) or dim sum', pricePerPerson: [10, 20] },
      { name: 'Taiping / Bukit Merah', km: 280, kind: 'snack', suggestion: 'Cendol & snack break', pricePerPerson: [5, 10] },
      { name: 'George Town', km: 360, kind: 'meal', suggestion: 'Char kuey teow, asam laksa, nasi kandar for dinner', pricePerPerson: [10, 25] },
    ],
    specialties: ['Ipoh bean sprout chicken', 'Taiping cendol', 'Penang asam laksa', 'Nasi kandar'],
  },
  {
    id: 'kl-kelantan',
    name: 'KL → Kota Bharu (East Coast run)',
    from: 'Kuala Lumpur', to: 'Kota Bharu, Kelantan',
    distanceKm: 440, driveHours: 6,
    stops: [
      { name: 'Bentong', km: 80, kind: 'snack', suggestion: 'Bentong ginger tea & tau fu fah', pricePerPerson: [4, 8] },
      { name: 'Gua Musang', km: 260, kind: 'meal', suggestion: 'Kedai kopi lunch — nasi berlauk', pricePerPerson: [7, 12] },
      { name: 'Kuala Krai', km: 360, kind: 'snack', suggestion: 'Roadside keropok & fruits', pricePerPerson: [3, 8] },
      { name: 'Kota Bharu', km: 440, kind: 'meal', suggestion: 'Nasi kerabu, ayam percik, nasi dagang at Pasar Siti Khadijah area', pricePerPerson: [8, 18] },
    ],
    specialties: ['Nasi kerabu', 'Ayam percik', 'Nasi dagang', 'Budu', 'Akok'],
  },
  {
    id: 'pj-jb',
    name: 'PJ → Melaka → Johor Bahru',
    from: 'Petaling Jaya', to: 'Johor Bahru',
    distanceKm: 340, driveHours: 4.5,
    stops: [
      { name: 'Seremban (exit)', km: 60, kind: 'snack', suggestion: 'Seremban siew pau to-go', pricePerPerson: [3, 6] },
      { name: 'Melaka', km: 150, kind: 'meal', suggestion: 'Chicken rice balls, asam pedas lunch', pricePerPerson: [10, 20] },
      { name: 'Ayer Keroh R&R', km: 165, kind: 'fuel', suggestion: 'Fuel + coffee', pricePerPerson: [3, 8] },
      { name: 'Johor Bahru', km: 340, kind: 'meal', suggestion: 'Kacang pool, laksa Johor for dinner', pricePerPerson: [8, 20] },
    ],
    specialties: ['Asam pedas Melaka', 'Chicken rice balls', 'Laksa Johor', 'Kacang pool'],
  },
  {
    id: 'kk-kundasang',
    name: 'Kota Kinabalu → Kundasang (Sabah highlands)',
    from: 'Kota Kinabalu', to: 'Kundasang',
    distanceKm: 95, driveHours: 2,
    stops: [
      { name: 'Tamparuli', km: 35, kind: 'meal', suggestion: 'Famous Tamparuli mee goreng', pricePerPerson: [6, 12] },
      { name: 'Nabalu Market', km: 70, kind: 'snack', suggestion: 'Hill bananas, pineapple, local snacks', pricePerPerson: [3, 10] },
      { name: 'Kundasang', km: 95, kind: 'meal', suggestion: 'Highland vegetables hotpot, fresh market produce for cooking', pricePerPerson: [10, 25] },
    ],
    specialties: ['Tuaran mee', 'Hinava', 'Highland vegetables', 'Sabah tea'],
  },
  {
    id: 'kuching-sibu',
    name: 'Kuching → Sibu (Sarawak Pan Borneo)',
    from: 'Kuching', to: 'Sibu',
    distanceKm: 370, driveHours: 5.5,
    stops: [
      { name: 'Serian', km: 65, kind: 'snack', suggestion: 'Serian market — local fruits & kuih', pricePerPerson: [3, 8] },
      { name: 'Sri Aman', km: 190, kind: 'meal', suggestion: 'Kopitiam lunch — kolo mee or laksa', pricePerPerson: [6, 12] },
      { name: 'Sarikei', km: 300, kind: 'snack', suggestion: 'Pineapple town stop', pricePerPerson: [3, 6] },
      { name: 'Sibu', km: 370, kind: 'meal', suggestion: 'Kampua mee & Foochow specialties at Sibu Central Market', pricePerPerson: [6, 15] },
    ],
    specialties: ['Sarawak laksa', 'Kolo mee', 'Kampua mee', 'Manok pansoh'],
  },
];

export const FOOD_PLACES: FoodPlace[] = [
  { id: 'fp1', name: 'Warung Pak Su Nasi Berlauk', city: 'Kota Bharu', kind: 'hawker', cuisine: 'Kelantan', pricePerPerson: [6, 12], rating: 4.6, halalClaimed: true, dishes: ['Nasi berlauk', 'Ayam percik', 'Nasi kerabu'] },
  { id: 'fp2', name: 'Kedai Kopi Swee Kang', city: 'Kuching', kind: 'kopitiam', cuisine: 'Sarawak', pricePerPerson: [6, 14], rating: 4.7, halalClaimed: false, dishes: ['Sarawak laksa', 'Kolo mee'] },
  { id: 'fp3', name: 'Anjung Selera Tanjung Aru', city: 'Kota Kinabalu', kind: 'food-court', cuisine: 'Sabah', pricePerPerson: [8, 20], rating: 4.4, halalClaimed: true, dishes: ['Hinava', 'Ikan bakar', 'Sup ikan'] },
  { id: 'fp4', name: 'Line Clear-style Nasi Kandar Corner', city: 'George Town', kind: 'hawker', cuisine: 'Indian', pricePerPerson: [10, 22], rating: 4.5, halalClaimed: true, dishes: ['Nasi kandar', 'Ayam ros', 'Kari kepala ikan'] },
  { id: 'fp5', name: 'Kedai Makan Asam Pedas Hj Ali', city: 'Melaka', kind: 'restaurant', cuisine: 'Malay', pricePerPerson: [9, 18], rating: 4.5, halalClaimed: true, dishes: ['Asam pedas', 'Ikan pari bakar'] },
  { id: 'fp6', name: 'Restoran Rebung Santai', city: 'Kuala Lumpur', kind: 'restaurant', cuisine: 'Malay', pricePerPerson: [25, 45], rating: 4.3, halalClaimed: true, dishes: ['Buffet kampung', 'Masak lemak', 'Rendang'] },
  { id: 'fp7', name: 'Gerai CKT Siam Road-style', city: 'George Town', kind: 'hawker', cuisine: 'Penang', pricePerPerson: [8, 14], rating: 4.8, halalClaimed: false, dishes: ['Char kuey teow'] },
  { id: 'fp8', name: 'Mamak Bistro 24 Jam', city: 'Petaling Jaya', kind: 'restaurant', cuisine: 'Indian', pricePerPerson: [7, 15], rating: 4.2, halalClaimed: true, dishes: ['Mee goreng mamak', 'Roti canai', 'Teh tarik'] },
  { id: 'fp9', name: 'Ipoh Nga Choi Kai House', city: 'Ipoh', kind: 'restaurant', cuisine: 'Chinese', pricePerPerson: [12, 22], rating: 4.6, halalClaimed: false, dishes: ['Bean sprout chicken', 'Hor fun'] },
  { id: 'fp10', name: 'Medan Selera Tapah R&R', city: 'Tapah', kind: 'food-court', cuisine: 'Mixed', pricePerPerson: [8, 15], rating: 4.0, halalClaimed: true, dishes: ['Nasi campur', 'Mee sup', 'Ayam goreng'] },
  { id: 'fp11', name: 'Sibu Kampua Corner', city: 'Sibu', kind: 'kopitiam', cuisine: 'Chinese', pricePerPerson: [5, 10], rating: 4.5, halalClaimed: false, dishes: ['Kampua mee', 'Kompia'] },
  { id: 'fp12', name: 'Tamparuli Mee Legend', city: 'Tamparuli', kind: 'kopitiam', cuisine: 'Sabah', pricePerPerson: [6, 12], rating: 4.6, halalClaimed: false, dishes: ['Tuaran mee', 'Mee goreng basah'] },
  { id: 'fp13', name: 'Warong Nasi Dagang Atas Tol', city: 'Kuala Terengganu', kind: 'hawker', cuisine: 'Terengganu', pricePerPerson: [5, 10], rating: 4.7, halalClaimed: true, dishes: ['Nasi dagang', 'Keropok lekor'] },
  { id: 'fp14', name: 'Kacang Pool Haji Corner', city: 'Johor Bahru', kind: 'hawker', cuisine: 'Johor', pricePerPerson: [7, 13], rating: 4.4, halalClaimed: true, dishes: ['Kacang pool', 'Laksa Johor'] },
  { id: 'fp15', name: 'Cendol Bandar Taiping', city: 'Taiping', kind: 'hawker', cuisine: 'Malay', pricePerPerson: [3, 8], rating: 4.5, halalClaimed: true, dishes: ['Cendol', 'Rojak buah'] },
];

export const GROCERY_STORES: GroceryStore[] = [
  { id: 'gs1', name: 'Pasar Besar (wet market)', kind: 'wet-market', city: 'Your area', priceLevel: 1 },
  { id: 'gs2', name: 'Econsave', kind: 'supermarket', city: 'Nationwide', priceLevel: 1 },
  { id: 'gs3', name: 'Mydin', kind: 'supermarket', city: 'Nationwide', priceLevel: 1 },
  { id: 'gs4', name: 'NSK Trade City', kind: 'supermarket', city: 'Klang Valley', priceLevel: 1 },
  { id: 'gs5', name: 'Lotus\'s', kind: 'supermarket', city: 'Nationwide', priceLevel: 2 },
  { id: 'gs6', name: 'Giant', kind: 'supermarket', city: 'Nationwide', priceLevel: 2 },
  { id: 'gs7', name: 'AEON', kind: 'supermarket', city: 'Major cities', priceLevel: 2 },
  { id: 'gs8', name: 'Jaya Grocer', kind: 'supermarket', city: 'Klang Valley', priceLevel: 3 },
  { id: 'gs9', name: 'Village Grocer', kind: 'supermarket', city: 'Major cities', priceLevel: 3 },
  { id: 'gs10', name: 'Online grocery (delivery)', kind: 'online', city: 'Coverage areas', priceLevel: 2 },
];
