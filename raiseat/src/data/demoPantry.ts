import type { PantryItem } from '../types';

function daysFromNow(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
}

// Demo pantry — loaded on first run so the app is immediately useful.
export function buildDemoPantry(): PantryItem[] {
  return [
    { id: 'p1', ingredientId: 'chicken-whole', qty: 1.2, unit: 'kg', location: 'freezer', expiryDate: daysFromNow(2), notes: 'Thawed yesterday — use soon' },
    { id: 'p2', ingredientId: 'egg', qty: 8, unit: 'biji', location: 'fridge', expiryDate: daysFromNow(12) },
    { id: 'p3', ingredientId: 'rice', qty: 4, unit: 'kg', location: 'pantry', expiryDate: daysFromNow(300) },
    { id: 'p4', ingredientId: 'spinach', qty: 2, unit: 'ikat', location: 'fridge', expiryDate: daysFromNow(1) },
    { id: 'p5', ingredientId: 'tomato', qty: 0.4, unit: 'kg', location: 'fridge', expiryDate: daysFromNow(3) },
    { id: 'p6', ingredientId: 'onion', qty: 0.5, unit: 'kg', location: 'pantry', expiryDate: daysFromNow(20) },
    { id: 'p7', ingredientId: 'garlic', qty: 0.15, unit: 'kg', location: 'pantry', expiryDate: daysFromNow(40) },
    { id: 'p8', ingredientId: 'soy-sauce', qty: 250, unit: 'ml', location: 'pantry', expiryDate: daysFromNow(200) },
    { id: 'p9', ingredientId: 'sweet-soy', qty: 180, unit: 'ml', location: 'pantry', expiryDate: daysFromNow(200) },
    { id: 'p10', ingredientId: 'cooking-oil', qty: 800, unit: 'ml', location: 'pantry', expiryDate: daysFromNow(180) },
    { id: 'p11', ingredientId: 'coconut-milk', qty: 200, unit: 'ml', location: 'pantry', notes: 'UHT box, unopened', expiryDate: daysFromNow(90) },
    { id: 'p12', ingredientId: 'anchovies', qty: 120, unit: 'g', location: 'pantry', expiryDate: daysFromNow(100) },
    { id: 'p13', ingredientId: 'carrot', qty: 0.3, unit: 'kg', location: 'fridge', expiryDate: daysFromNow(10) },
    { id: 'p14', ingredientId: 'ginger', qty: 60, unit: 'g', location: 'fridge', expiryDate: daysFromNow(15) },
    { id: 'p15', ingredientId: 'curry-powder', qty: 100, unit: 'g', location: 'pantry', expiryDate: daysFromNow(250) },
    { id: 'p16', ingredientId: 'turmeric-powder', qty: 60, unit: 'g', location: 'pantry', expiryDate: daysFromNow(250) },
    { id: 'p17', ingredientId: 'sugar', qty: 500, unit: 'g', location: 'pantry', expiryDate: daysFromNow(400) },
    { id: 'p18', ingredientId: 'salt', qty: 400, unit: 'g', location: 'pantry' },
    { id: 'p19', ingredientId: 'sambal-paste', qty: 90, unit: 'g', location: 'fridge', expiryDate: daysFromNow(30) },
    { id: 'p20', ingredientId: 'bread', qty: 1, unit: 'packet', location: 'counter', expiryDate: daysFromNow(3) },
  ];
}
