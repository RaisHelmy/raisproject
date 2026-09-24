import type { Substitution } from '../types';

export const SUBSTITUTIONS: Substitution[] = [
  { forIngredientId: 'lime', substituteId: 'calamansi', similarity: 5, note: 'Slightly sweeter and more floral — the most Malaysian swap.' },
  { forIngredientId: 'calamansi', substituteId: 'lime', similarity: 4, note: 'A touch sharper; use a little less.' },
  { forIngredientId: 'lime', substituteId: 'tamarind', similarity: 3, note: 'Different aroma, same sour job in gravies.' },
  { forIngredientId: 'shallot', substituteId: 'onion', similarity: 4, note: 'Milder; use ~1.5x the amount.' },
  { forIngredientId: 'onion', substituteId: 'shallot', similarity: 4, note: 'Sweeter, more intense; use less.' },
  { forIngredientId: 'galangal', substituteId: 'ginger', similarity: 3, note: 'Loses the piney note but keeps warmth.' },
  { forIngredientId: 'turmeric-fresh', substituteId: 'turmeric-powder', similarity: 4, note: 'Use 1/3 the amount by weight.' },
  { forIngredientId: 'chicken-thigh', substituteId: 'chicken-breast', similarity: 4, note: 'Leaner — reduce cooking time to keep it juicy.' },
  { forIngredientId: 'chicken-breast', substituteId: 'chicken-thigh', similarity: 4, note: 'Fattier and more forgiving.' },
  { forIngredientId: 'chicken-whole', substituteId: 'chicken-thigh', similarity: 5, note: 'Same flavour profile, easier portions.' },
  { forIngredientId: 'fish-tenggiri', substituteId: 'fish-mackerel', similarity: 4, note: 'Cheaper; smaller fillets, cook gently.' },
  { forIngredientId: 'prawn', substituteId: 'chicken-breast', similarity: 2, note: 'Changes the dish, but keeps the protein.' },
  { forIngredientId: 'kangkung', substituteId: 'spinach', similarity: 4, note: 'Softer texture; cook even faster.' },
  { forIngredientId: 'spinach', substituteId: 'kangkung', similarity: 4, note: 'Slightly crunchier stems.' },
  { forIngredientId: 'sweet-soy', substituteId: 'soy-sauce', similarity: 3, note: 'Add sugar (1 tsp per tbsp) to mimic kicap manis.' },
  { forIngredientId: 'budu', substituteId: 'fish-sauce', similarity: 3, note: 'Cleaner and saltier; add a pinch of sugar.' },
  { forIngredientId: 'fish-sauce', substituteId: 'budu', similarity: 3, note: 'Funkier and thicker — start with half.' },
  { forIngredientId: 'gula-melaka', substituteId: 'sugar', similarity: 3, note: 'Loses the caramel smokiness; add a drop of dark soy.' },
  { forIngredientId: 'coconut-milk', substituteId: 'kerisik', similarity: 2, note: 'For dry dishes only — adds richness, not liquid.' },
  { forIngredientId: 'laksa-noodles', substituteId: 'rice-vermicelli', similarity: 4, note: 'Thinner but classic in Sarawak laksa anyway.' },
  { forIngredientId: 'kuey-teow', substituteId: 'yellow-noodles', similarity: 3, note: 'Different chew, same treatment.' },
  { forIngredientId: 'belacan', substituteId: 'fish-sauce', similarity: 2, note: 'Use a splash for umami; skip the toasting step.' },
  { forIngredientId: 'chili-padi', substituteId: 'chili-red', similarity: 4, note: 'Much milder — use 3x for similar heat.' },
  { forIngredientId: 'dried-chili', substituteId: 'chili-red', similarity: 3, note: 'Fresher taste, less smoky depth.' },
  { forIngredientId: 'tempeh', substituteId: 'tofu', similarity: 3, note: 'Softer; press well and fry harder.' },
];

export function substitutesFor(ingredientId: string): Substitution[] {
  return SUBSTITUTIONS.filter((s) => s.forIngredientId === ingredientId)
    .sort((a, b) => b.similarity - a.similarity);
}
