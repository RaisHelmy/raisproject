import type { Recipe, ScoredRecipe, Cuisine, Equipment } from '../types';
import { RECIPES } from '../data/recipes';
import { INGREDIENT_MAP } from '../data/ingredients';
import { estimateCost } from './cost';

/** Assumed-in-every-kitchen staples — never counted as "missing". */
const STAPLES = new Set(['salt', 'sugar', 'cooking-oil']);

export interface RecommendCriteria {
  ownedIds?: Set<string>;
  budget?: number;
  servings?: number;
  maxMinutes?: number;
  cuisine?: Cuisine | 'Any';
  equipment?: Equipment[];
  /** Ingredients the user explicitly asked to cook with — strongly boosted. */
  preferredIds?: Set<string>;
  expiringIds?: Set<string>;
  dietary?: string[]; // 'vegetarian' | 'no-seafood' | 'no-beef'
  favoriteCuisines?: Cuisine[];
  limit?: number;
}

const SEAFOOD = new Set(['prawn', 'fish-mackerel', 'fish-tenggiri', 'anchovies', 'belacan', 'budu', 'fish-sauce']);
const MEAT = new Set(['chicken-whole', 'chicken-breast', 'chicken-thigh', 'beef']);

function violatesDietary(recipe: Recipe, dietary: string[]): boolean {
  for (const d of dietary) {
    if (d === 'vegetarian' && recipe.ingredients.some((i) => MEAT.has(i.ingredientId) || SEAFOOD.has(i.ingredientId))) return true;
    if (d === 'no-seafood' && recipe.ingredients.some((i) => !i.optional && SEAFOOD.has(i.ingredientId))) return true;
    if (d === 'no-beef' && recipe.ingredients.some((i) => i.ingredientId === 'beef')) return true;
  }
  return false;
}

export function scoreRecipe(recipe: Recipe, c: RecommendCriteria): ScoredRecipe {
  const servings = c.servings ?? recipe.baseServings;
  const owned = c.ownedIds ?? new Set<string>();
  const reasons: string[] = [];
  const warnings: string[] = [];

  const required = recipe.ingredients.filter((i) => !i.optional && !STAPLES.has(i.ingredientId));
  const have: string[] = [];
  const missing: string[] = [];
  const missingIds: string[] = [];
  let ownedCost = 0;
  let requiredCost = 0;
  for (const ri of required) {
    const ing = INGREDIENT_MAP[ri.ingredientId];
    const name = ing?.name ?? ri.ingredientId;
    const riCost = ing ? ri.qty * ing.pricePerUnit : 0;
    requiredCost += riCost;
    if (owned.has(ri.ingredientId)) {
      have.push(name);
      ownedCost += riCost;
    } else {
      missing.push(name);
      missingIds.push(ri.ingredientId);
    }
  }
  const matchPercent = required.length ? Math.round((have.length / required.length) * 100) : 100;
  // Cost-weighted match: having the chicken matters more than having the soy sauce.
  const weightedMatch = requiredCost > 0 ? ownedCost / requiredCost : 1;

  const cost = estimateCost(recipe, servings);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;

  let score = 0;

  // Ingredient match (0–40): blend of count-based and cost-weighted coverage
  score += ((matchPercent / 100) * 0.45 + weightedMatch * 0.55) * 40;
  if (have.length >= 4) reasons.push(`Uses ${have.length} ingredients you already have`);
  else if (have.length > 0) reasons.push(`Uses ${have.join(', ')} from your kitchen`);

  // Budget fit (0–25)
  if (c.budget != null) {
    if (cost.total <= c.budget) {
      score += 25 * (1 - cost.total / (c.budget * 2)); // cheaper under budget = better
      reasons.push(`Fits your RM${c.budget} budget (est. ${cost.total.toFixed(2)})`);
    } else if (cost.total <= c.budget * 1.15) {
      score += 5;
      warnings.push(`Slightly over budget (est. RM${cost.total.toFixed(2)})`);
    } else {
      score -= 20;
      warnings.push(`Over budget: est. RM${cost.total.toFixed(2)}`);
    }
  } else {
    score += 10;
  }

  // Time fit (0–12)
  if (c.maxMinutes != null) {
    if (totalMinutes <= c.maxMinutes) {
      score += 12;
      reasons.push(`Ready in ${totalMinutes} minutes`);
    } else {
      score -= 15;
      warnings.push(`Takes ${totalMinutes} min — longer than your ${c.maxMinutes} min window`);
    }
  } else if (totalMinutes <= 30) {
    score += 5;
  }

  // Cuisine (0–8)
  if (c.cuisine && c.cuisine !== 'Any') {
    if (recipe.cuisine === c.cuisine) {
      score += 8;
      reasons.push(`${c.cuisine} cuisine, as requested`);
    } else {
      score -= 12;
    }
  }
  if (c.favoriteCuisines?.includes(recipe.cuisine)) {
    score += 6;
    reasons.push(`Matches your favourite: ${recipe.cuisine} style`);
  }
  if (recipe.tags.includes('favorite')) score += 3;

  // Explicitly requested ingredients (0–26), weighted so proteins count most:
  // "I have chicken" means the chicken should end up in the pot.
  if (c.preferredIds && c.preferredIds.size > 0) {
    const weightOf = (id: string) => {
      const cat = INGREDIENT_MAP[id]?.category;
      return cat === 'protein' || cat === 'seafood' ? 3 : 1;
    };
    const inRecipe = new Set(recipe.ingredients.map((i) => i.ingredientId));
    let usedWeight = 0;
    let totalWeight = 0;
    const usedNames: string[] = [];
    for (const id of c.preferredIds) {
      const w = weightOf(id);
      totalWeight += w;
      if (inRecipe.has(id)) {
        usedWeight += w;
        usedNames.push(INGREDIENT_MAP[id]?.name ?? id);
      }
    }
    if (usedNames.length > 0) {
      score += 26 * (usedWeight / totalWeight);
      reasons.unshift(`Cooks with your ${usedNames.slice(0, 3).join(', ')}`);
    } else {
      score -= 10; // asked for chicken, recipe has none
    }
  }

  // Expiring ingredients (0–15)
  if (c.expiringIds && c.expiringIds.size > 0) {
    const uses = recipe.ingredients.filter((i) => c.expiringIds!.has(i.ingredientId));
    if (uses.length > 0) {
      score += Math.min(15, uses.length * 7);
      const names = uses.map((i) => INGREDIENT_MAP[i.ingredientId]?.name ?? i.ingredientId);
      reasons.push(`Uses ${names.join(' & ')} before they expire`);
    }
  }

  // Equipment
  if (c.equipment && c.equipment.length > 0) {
    const missingEq = recipe.equipment.filter(
      (e) => !c.equipment!.includes(e) && e !== 'knife' && e !== 'stove',
    );
    // wok ↔ pan are interchangeable enough at home
    const realMissing = missingEq.filter((e) => !(
      (e === 'wok' && c.equipment!.includes('pan')) ||
      (e === 'pan' && c.equipment!.includes('wok')) ||
      (e === 'pot' && c.equipment!.includes('rice-cooker')) ||
      (e === 'grill' && (c.equipment!.includes('air-fryer') || c.equipment!.includes('oven') || c.equipment!.includes('pan')))
    ));
    if (realMissing.length > 0) {
      score -= 30;
      warnings.push(`Needs: ${realMissing.join(', ')}`);
    } else {
      reasons.push('Works with your equipment');
    }
  }

  // Serving scale warnings
  const factor = servings / recipe.baseServings;
  if (factor > 2) warnings.push('Large batch — you may need to cook in two rounds');
  if (servings >= 4 && recipe.baseServings <= servings) {
    reasons.push(`Feeds ${servings} people`);
  }

  return { recipe, score, matchPercent, have, missing, missingIds, cost, reasons, warnings, servings };
}

export function recommend(c: RecommendCriteria): ScoredRecipe[] {
  const results = RECIPES
    .filter((r) => !c.dietary || !violatesDietary(r, c.dietary))
    .map((r) => scoreRecipe(r, c))
    .sort((a, b) => b.score - a.score);
  return results.slice(0, c.limit ?? 12);
}

/** Budget optimizer — four named strategies over the same criteria. */
export function optimizeStrategies(c: RecommendCriteria): { label: string; icon: string; blurb: string; pick: ScoredRecipe }[] {
  const pool = RECIPES
    .filter((r) => !c.dietary || !violatesDietary(r, c.dietary))
    .map((r) => scoreRecipe(r, { ...c, budget: undefined, maxMinutes: undefined }));
  const servings = c.servings ?? 4;
  const inBudget = pool.filter((s) => c.budget == null || s.cost.total <= c.budget * 1.05);
  const candidates = inBudget.length > 0 ? inBudget : pool;

  const cheapest = [...candidates].sort((a, b) => a.cost.total - b.cost.total)[0];
  const bestValue = [...candidates].sort(
    (a, b) => (b.matchPercent / Math.max(1, b.cost.perServing)) - (a.matchPercent / Math.max(1, a.cost.perServing)),
  )[0];
  const healthier = [...candidates].sort(
    (a, b) =>
      (b.recipe.nutritionPerServing.protein / Math.max(1, b.recipe.nutritionPerServing.calories)) -
      (a.recipe.nutritionPerServing.protein / Math.max(1, a.recipe.nutritionPerServing.calories)),
  )[0];
  const fastest = [...candidates].sort(
    (a, b) => (a.recipe.prepMinutes + a.recipe.cookMinutes) - (b.recipe.prepMinutes + b.recipe.cookMinutes),
  )[0];

  const out: { label: string; icon: string; blurb: string; pick: ScoredRecipe }[] = [];
  const seen = new Set<string>();
  const push = (label: string, icon: string, blurb: string, pick?: ScoredRecipe) => {
    if (pick && !seen.has(pick.recipe.id)) {
      seen.add(pick.recipe.id);
      out.push({ label, icon, blurb, pick });
    }
  };
  push('Cheapest', '💸', `Lowest total cost for ${servings} people`, cheapest);
  push('Best value', '⭐', 'Best pantry match per ringgit', bestValue);
  push('Healthier', '🥗', 'Most protein per calorie', healthier);
  push('Fastest', '⚡', 'On the table soonest', fastest);
  return out;
}
