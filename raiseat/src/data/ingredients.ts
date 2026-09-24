import type { Ingredient } from '../types';

// Demo data — estimated local Malaysian prices (MYR), not live prices.
export const INGREDIENTS: Ingredient[] = [
  // Proteins
  { id: 'chicken-whole', name: 'Chicken (whole)', nameMs: 'Ayam', category: 'protein', unit: 'kg', pricePerUnit: 11.5, pack: { qty: 1.6, unit: 'kg', price: 18.4, label: '1 whole bird ~1.6kg' }, shelfLifeDays: 3, emoji: '🍗' },
  { id: 'chicken-breast', name: 'Chicken breast', nameMs: 'Dada ayam', category: 'protein', unit: 'kg', pricePerUnit: 17, shelfLifeDays: 3, emoji: '🍗' },
  { id: 'chicken-thigh', name: 'Chicken thigh', nameMs: 'Peha ayam', category: 'protein', unit: 'kg', pricePerUnit: 15, shelfLifeDays: 3, emoji: '🍗' },
  { id: 'beef', name: 'Beef (local)', nameMs: 'Daging lembu', category: 'protein', unit: 'kg', pricePerUnit: 38, shelfLifeDays: 3, emoji: '🥩' },
  { id: 'fish-mackerel', name: 'Mackerel (ikan kembung)', nameMs: 'Ikan kembung', category: 'seafood', unit: 'kg', pricePerUnit: 16, shelfLifeDays: 2, emoji: '🐟' },
  { id: 'fish-tenggiri', name: 'Spanish mackerel (tenggiri)', nameMs: 'Ikan tenggiri', category: 'seafood', unit: 'kg', pricePerUnit: 32, shelfLifeDays: 2, emoji: '🐟' },
  { id: 'prawn', name: 'Prawns', nameMs: 'Udang', category: 'seafood', unit: 'kg', pricePerUnit: 34, shelfLifeDays: 2, emoji: '🦐' },
  { id: 'anchovies', name: 'Dried anchovies (ikan bilis)', nameMs: 'Ikan bilis', category: 'dry-goods', unit: 'g', pricePerUnit: 0.045, pack: { qty: 200, unit: 'g', price: 9, label: '200g packet' }, shelfLifeDays: 180, emoji: '🐟' },
  { id: 'egg', name: 'Eggs', nameMs: 'Telur', category: 'egg', unit: 'biji', pricePerUnit: 0.45, pack: { qty: 10, unit: 'biji', price: 4.5, label: 'tray of 10' }, shelfLifeDays: 21, emoji: '🥚' },
  { id: 'tofu', name: 'Tofu', nameMs: 'Tauhu', category: 'protein', unit: 'pcs', pricePerUnit: 1.2, shelfLifeDays: 5, emoji: '🧈' },
  { id: 'tempeh', name: 'Tempeh', nameMs: 'Tempe', category: 'protein', unit: 'packet', pricePerUnit: 2.5, shelfLifeDays: 5, emoji: '🟫' },

  // Grains / noodles
  { id: 'rice', name: 'White rice', nameMs: 'Beras', category: 'grain', unit: 'kg', pricePerUnit: 3.5, pack: { qty: 5, unit: 'kg', price: 17.5, label: '5kg bag' }, shelfLifeDays: 365, emoji: '🍚' },
  { id: 'glutinous-rice', name: 'Glutinous rice', nameMs: 'Pulut', category: 'grain', unit: 'kg', pricePerUnit: 6.5, shelfLifeDays: 365, emoji: '🍚' },
  { id: 'rice-vermicelli', name: 'Rice vermicelli (bihun)', nameMs: 'Bihun', category: 'noodle', unit: 'packet', pricePerUnit: 3.2, shelfLifeDays: 180, emoji: '🍜' },
  { id: 'yellow-noodles', name: 'Yellow noodles', nameMs: 'Mee kuning', category: 'noodle', unit: 'kg', pricePerUnit: 5.5, shelfLifeDays: 4, emoji: '🍜' },
  { id: 'laksa-noodles', name: 'Thick laksa noodles', nameMs: 'Laksa', category: 'noodle', unit: 'kg', pricePerUnit: 6, shelfLifeDays: 3, emoji: '🍜' },
  { id: 'kuey-teow', name: 'Flat rice noodles (kuey teow)', nameMs: 'Kuey teow', category: 'noodle', unit: 'kg', pricePerUnit: 5.5, shelfLifeDays: 3, emoji: '🍜' },
  { id: 'bread', name: 'Bread', nameMs: 'Roti', category: 'grain', unit: 'packet', pricePerUnit: 3.5, shelfLifeDays: 5, emoji: '🍞' },

  // Vegetables & herbs
  { id: 'onion', name: 'Onion', nameMs: 'Bawang besar', category: 'vegetable', unit: 'kg', pricePerUnit: 4.5, shelfLifeDays: 30, emoji: '🧅' },
  { id: 'shallot', name: 'Shallots', nameMs: 'Bawang merah', category: 'vegetable', unit: 'kg', pricePerUnit: 9, shelfLifeDays: 30, emoji: '🧅' },
  { id: 'garlic', name: 'Garlic', nameMs: 'Bawang putih', category: 'vegetable', unit: 'kg', pricePerUnit: 9, shelfLifeDays: 60, emoji: '🧄' },
  { id: 'ginger', name: 'Ginger', nameMs: 'Halia', category: 'vegetable', unit: 'g', pricePerUnit: 0.012, shelfLifeDays: 30, emoji: '🫚' },
  { id: 'galangal', name: 'Galangal (lengkuas)', nameMs: 'Lengkuas', category: 'vegetable', unit: 'g', pricePerUnit: 0.014, shelfLifeDays: 21, emoji: '🫚' },
  { id: 'lemongrass', name: 'Lemongrass', nameMs: 'Serai', category: 'herb', unit: 'pcs', pricePerUnit: 0.4, shelfLifeDays: 14, emoji: '🌿' },
  { id: 'turmeric-fresh', name: 'Fresh turmeric', nameMs: 'Kunyit hidup', category: 'spice', unit: 'g', pricePerUnit: 0.015, shelfLifeDays: 21, emoji: '🟠' },
  { id: 'chili-red', name: 'Red chillies', nameMs: 'Cili merah', category: 'vegetable', unit: 'kg', pricePerUnit: 12, shelfLifeDays: 7, emoji: '🌶️' },
  { id: 'chili-padi', name: 'Bird\'s eye chilli (cili padi)', nameMs: 'Cili padi', category: 'vegetable', unit: 'g', pricePerUnit: 0.02, shelfLifeDays: 7, emoji: '🌶️' },
  { id: 'dried-chili', name: 'Dried chillies', nameMs: 'Cili kering', category: 'dry-goods', unit: 'g', pricePerUnit: 0.022, shelfLifeDays: 180, emoji: '🌶️' },
  { id: 'tomato', name: 'Tomatoes', nameMs: 'Tomato', category: 'vegetable', unit: 'kg', pricePerUnit: 6, shelfLifeDays: 6, emoji: '🍅' },
  { id: 'carrot', name: 'Carrot', nameMs: 'Lobak merah', category: 'vegetable', unit: 'kg', pricePerUnit: 4.5, shelfLifeDays: 21, emoji: '🥕' },
  { id: 'potato', name: 'Potatoes', nameMs: 'Ubi kentang', category: 'vegetable', unit: 'kg', pricePerUnit: 4.5, shelfLifeDays: 30, emoji: '🥔' },
  { id: 'spinach', name: 'Spinach (bayam)', nameMs: 'Bayam', category: 'vegetable', unit: 'ikat', pricePerUnit: 2, shelfLifeDays: 2, emoji: '🥬' },
  { id: 'kangkung', name: 'Water spinach (kangkung)', nameMs: 'Kangkung', category: 'vegetable', unit: 'ikat', pricePerUnit: 1.8, shelfLifeDays: 2, emoji: '🥬' },
  { id: 'cabbage', name: 'Cabbage', nameMs: 'Kubis', category: 'vegetable', unit: 'kg', pricePerUnit: 3.8, shelfLifeDays: 14, emoji: '🥬' },
  { id: 'bean-sprouts', name: 'Bean sprouts (taugeh)', nameMs: 'Taugeh', category: 'vegetable', unit: 'g', pricePerUnit: 0.004, shelfLifeDays: 2, emoji: '🌱' },
  { id: 'long-beans', name: 'Long beans', nameMs: 'Kacang panjang', category: 'vegetable', unit: 'ikat', pricePerUnit: 2.5, shelfLifeDays: 5, emoji: '🫛' },
  { id: 'cucumber', name: 'Cucumber', nameMs: 'Timun', category: 'vegetable', unit: 'kg', pricePerUnit: 3.5, shelfLifeDays: 7, emoji: '🥒' },
  { id: 'spring-onion', name: 'Spring onions', nameMs: 'Daun bawang', category: 'herb', unit: 'ikat', pricePerUnit: 1.5, shelfLifeDays: 5, emoji: '🌿' },
  { id: 'coriander', name: 'Coriander leaves', nameMs: 'Daun ketumbar', category: 'herb', unit: 'ikat', pricePerUnit: 1.5, shelfLifeDays: 4, emoji: '🌿' },
  { id: 'kaffir-lime-leaf', name: 'Kaffir lime leaves', nameMs: 'Daun limau purut', category: 'herb', unit: 'g', pricePerUnit: 0.03, shelfLifeDays: 10, emoji: '🍃' },
  { id: 'ulam-herbs', name: 'Mixed ulam herbs', nameMs: 'Ulam-ulaman', category: 'herb', unit: 'ikat', pricePerUnit: 3, shelfLifeDays: 2, emoji: '🌿' },
  { id: 'lime', name: 'Lime (limau nipis)', nameMs: 'Limau nipis', category: 'fruit', unit: 'pcs', pricePerUnit: 0.4, shelfLifeDays: 14, emoji: '🍋' },
  { id: 'calamansi', name: 'Calamansi (limau kasturi)', nameMs: 'Limau kasturi', category: 'fruit', unit: 'pcs', pricePerUnit: 0.15, shelfLifeDays: 10, emoji: '🍋' },
  { id: 'banana-leaf', name: 'Banana leaves', nameMs: 'Daun pisang', category: 'other', unit: 'pcs', pricePerUnit: 0.5, shelfLifeDays: 3, emoji: '🍃' },

  // Sauces, pastes, pantry
  { id: 'coconut-milk', name: 'Coconut milk (santan)', nameMs: 'Santan', category: 'sauce', unit: 'ml', pricePerUnit: 0.011, pack: { qty: 200, unit: 'ml', price: 2.2, label: '200ml box' }, shelfLifeDays: 3, emoji: '🥥' },
  { id: 'soy-sauce', name: 'Soy sauce (kicap)', nameMs: 'Kicap', category: 'sauce', unit: 'ml', pricePerUnit: 0.012, pack: { qty: 340, unit: 'ml', price: 4.1, label: '340ml bottle' }, shelfLifeDays: 365, emoji: '🍶' },
  { id: 'sweet-soy', name: 'Sweet soy sauce (kicap manis)', nameMs: 'Kicap manis', category: 'sauce', unit: 'ml', pricePerUnit: 0.013, shelfLifeDays: 365, emoji: '🍶' },
  { id: 'oyster-sauce', name: 'Oyster sauce', nameMs: 'Sos tiram', category: 'sauce', unit: 'ml', pricePerUnit: 0.02, shelfLifeDays: 365, emoji: '🦪' },
  { id: 'fish-sauce', name: 'Fish sauce', nameMs: 'Sos ikan', category: 'sauce', unit: 'ml', pricePerUnit: 0.015, shelfLifeDays: 365, emoji: '🍶' },
  { id: 'belacan', name: 'Shrimp paste (belacan)', nameMs: 'Belacan', category: 'sauce', unit: 'g', pricePerUnit: 0.025, shelfLifeDays: 365, emoji: '🟤' },
  { id: 'budu', name: 'Budu (Kelantan fish sauce)', nameMs: 'Budu', category: 'sauce', unit: 'ml', pricePerUnit: 0.016, shelfLifeDays: 365, emoji: '🍶' },
  { id: 'tamarind', name: 'Tamarind paste (asam jawa)', nameMs: 'Asam jawa', category: 'sauce', unit: 'g', pricePerUnit: 0.014, shelfLifeDays: 180, emoji: '🟤' },
  { id: 'sambal-paste', name: 'Sambal paste', nameMs: 'Sambal', category: 'sauce', unit: 'g', pricePerUnit: 0.03, shelfLifeDays: 60, emoji: '🌶️' },
  { id: 'curry-powder', name: 'Meat curry powder', nameMs: 'Serbuk kari', category: 'spice', unit: 'g', pricePerUnit: 0.028, shelfLifeDays: 365, emoji: '🟡' },
  { id: 'turmeric-powder', name: 'Turmeric powder', nameMs: 'Serbuk kunyit', category: 'spice', unit: 'g', pricePerUnit: 0.025, shelfLifeDays: 365, emoji: '🟡' },
  { id: 'cooking-oil', name: 'Cooking oil', nameMs: 'Minyak masak', category: 'oil', unit: 'ml', pricePerUnit: 0.0065, pack: { qty: 1000, unit: 'ml', price: 6.5, label: '1L bottle' }, shelfLifeDays: 365, emoji: '🛢️' },
  { id: 'sugar', name: 'Sugar', nameMs: 'Gula', category: 'dry-goods', unit: 'g', pricePerUnit: 0.0029, shelfLifeDays: 730, emoji: '🧂' },
  { id: 'gula-melaka', name: 'Palm sugar (gula melaka)', nameMs: 'Gula melaka', category: 'dry-goods', unit: 'g', pricePerUnit: 0.016, shelfLifeDays: 365, emoji: '🟤' },
  { id: 'salt', name: 'Salt', nameMs: 'Garam', category: 'dry-goods', unit: 'g', pricePerUnit: 0.0016, shelfLifeDays: 999, emoji: '🧂' },
  { id: 'peanuts', name: 'Roasted peanuts', nameMs: 'Kacang tanah', category: 'dry-goods', unit: 'g', pricePerUnit: 0.014, shelfLifeDays: 90, emoji: '🥜' },
  { id: 'butterfly-pea', name: 'Butterfly pea flowers (bunga telang)', nameMs: 'Bunga telang', category: 'dry-goods', unit: 'g', pricePerUnit: 0.08, shelfLifeDays: 180, emoji: '💙' },
  { id: 'kerisik', name: 'Toasted coconut paste (kerisik)', nameMs: 'Kerisik', category: 'sauce', unit: 'g', pricePerUnit: 0.03, shelfLifeDays: 30, emoji: '🥥' },
  { id: 'sarawak-pepper', name: 'Sarawak black pepper', nameMs: 'Lada hitam Sarawak', category: 'spice', unit: 'g', pricePerUnit: 0.06, shelfLifeDays: 365, emoji: '⚫' },
  { id: 'laksa-paste-swk', name: 'Sarawak laksa paste', nameMs: 'Pes laksa Sarawak', category: 'sauce', unit: 'g', pricePerUnit: 0.035, pack: { qty: 300, unit: 'g', price: 10.5, label: '300g packet' }, shelfLifeDays: 180, emoji: '🌶️' },
];

export const INGREDIENT_MAP: Record<string, Ingredient> = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i]),
);

export function ingredientName(id: string): string {
  return INGREDIENT_MAP[id]?.name ?? id;
}
