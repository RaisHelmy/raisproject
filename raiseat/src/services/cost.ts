import type { CostEstimate, Recipe, Confidence, IngredientCategory } from '../types';
import { INGREDIENT_MAP } from '../data/ingredients';

/** Price variability by category — drives the confidence band. */
const VARIABILITY: Partial<Record<IngredientCategory, number>> = {
  seafood: 0.25,
  vegetable: 0.2,
  protein: 0.15,
  fruit: 0.2,
  herb: 0.2,
  noodle: 0.1,
};
const DEFAULT_VARIABILITY = 0.08;

export function scaleFactor(recipe: Recipe, servings: number): number {
  return servings / recipe.baseServings;
}

/**
 * Estimate the cost of a recipe at a given serving count.
 * `ownedIds` — ingredients the user already has; excluded when `missingOnly`.
 */
export function estimateCost(
  recipe: Recipe,
  servings: number,
  opts: { ownedIds?: Set<string>; missingOnly?: boolean } = {},
): CostEstimate {
  const factor = scaleFactor(recipe, servings);
  const breakdown: CostEstimate['breakdown'] = [];
  let total = 0;
  let spread = 0;

  for (const ri of recipe.ingredients) {
    if (opts.missingOnly && opts.ownedIds?.has(ri.ingredientId)) continue;
    const ing = INGREDIENT_MAP[ri.ingredientId];
    if (!ing) continue;
    const qty = ri.qty * factor;
    const cost = qty * ing.pricePerUnit;
    total += cost;
    spread += cost * (VARIABILITY[ing.category] ?? DEFAULT_VARIABILITY);
    breakdown.push({ ingredientId: ing.id, name: ing.name, qty, unit: ri.unit, cost });
  }

  breakdown.sort((a, b) => b.cost - a.cost);
  const rel = total > 0 ? spread / total : 0;
  const confidence: Confidence = rel < 0.1 ? 'High' : rel < 0.17 ? 'Medium' : 'Low';

  return {
    total,
    low: Math.max(0, total - spread),
    high: total + spread,
    perServing: servings > 0 ? total / servings : 0,
    currency: 'MYR',
    confidence,
    breakdown,
    source: 'Estimated local prices (demo data)',
  };
}

/** Rough "eat out" comparison for the same meal. */
export function eatOutEstimate(servings: number, cuisineFactor = 1): { low: number; high: number; mid: number } {
  const perPerson: [number, number] = [9 * cuisineFactor, 16 * cuisineFactor];
  return {
    low: perPerson[0] * servings,
    high: perPerson[1] * servings,
    mid: ((perPerson[0] + perPerson[1]) / 2) * servings,
  };
}
