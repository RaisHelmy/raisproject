import type { Currency } from '../types';
import { INGREDIENTS, INGREDIENT_MAP } from '../data/ingredients';

/**
 * Provider abstraction layer.
 *
 * All external data (grocery prices, restaurants, routing, nutrition) flows
 * through these interfaces so real APIs can be plugged in later without
 * touching UI code. Keys live in environment variables (see .env.example);
 * when a key is absent the app falls back to the demo provider.
 */

export interface FoodPrice {
  ingredientId: string;
  name: string;
  price: number;
  currency: Currency;
  source: string;
  lastUpdated: string;
  isEstimate: boolean;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface FoodPriceProvider {
  readonly name: string;
  searchIngredient(query: string): Promise<FoodPrice[]>;
  getPriceHistory(ingredientId: string): Promise<PriceHistoryPoint[]>;
}

/** Demo provider — deterministic local estimates, clearly labelled. */
export class DemoPricingProvider implements FoodPriceProvider {
  readonly name = 'Demo (local estimates)';

  async searchIngredient(query: string): Promise<FoodPrice[]> {
    const q = query.toLowerCase();
    return INGREDIENTS
      .filter((i) => i.name.toLowerCase().includes(q) || i.nameMs?.toLowerCase().includes(q))
      .map((i) => ({
        ingredientId: i.id,
        name: i.name,
        price: i.pricePerUnit,
        currency: 'MYR' as Currency,
        source: 'historical/local estimate',
        lastUpdated: new Date().toISOString().slice(0, 10),
        isEstimate: true,
      }));
  }

  async getPriceHistory(ingredientId: string): Promise<PriceHistoryPoint[]> {
    const ing = INGREDIENT_MAP[ingredientId];
    if (!ing) return [];
    // Deterministic pseudo-history around the current estimate.
    const out: PriceHistoryPoint[] = [];
    for (let m = 11; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const wobble = 0.9 + ((m * 2654435761) % 100) / 500;
      out.push({ date: d.toISOString().slice(0, 7), price: Math.round(ing.pricePerUnit * wobble * 100) / 100 });
    }
    return out;
  }
}

/** Resolve the active pricing provider from environment configuration. */
export function getPricingProvider(): FoodPriceProvider {
  // A real provider would be selected here when VITE_PRICING_API_URL /
  // VITE_PRICING_API_KEY are configured. Until then, demo data.
  return new DemoPricingProvider();
}
