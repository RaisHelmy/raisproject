import type { Recipe, ShoppingListItem } from '../types';
import { INGREDIENT_MAP } from '../data/ingredients';
import { uid } from '../utils/format';

/**
 * Build a combined shopping list from one or more (recipe, servings) pairs.
 * Quantities for the same ingredient are merged; pack suggestions added
 * when buying a standard pack beats loose quantities.
 */
export function buildShoppingItems(
  selections: { recipe: Recipe; servings: number }[],
  ownedIds: Set<string>,
): ShoppingListItem[] {
  const merged = new Map<string, { qty: number; from: Set<string> }>();

  for (const { recipe, servings } of selections) {
    const factor = servings / recipe.baseServings;
    for (const ri of recipe.ingredients) {
      const entry = merged.get(ri.ingredientId) ?? { qty: 0, from: new Set<string>() };
      entry.qty += ri.qty * factor;
      entry.from.add(recipe.title);
      merged.set(ri.ingredientId, entry);
    }
  }

  const items: ShoppingListItem[] = [];
  for (const [ingredientId, entry] of merged) {
    const ing = INGREDIENT_MAP[ingredientId];
    if (!ing) continue;
    const owned = ownedIds.has(ingredientId);
    let packSuggestion: string | undefined;
    let estimatedCost = entry.qty * ing.pricePerUnit;
    if (ing.pack && entry.qty > ing.pack.qty * 0.6 && entry.qty <= ing.pack.qty * 1.5) {
      packSuggestion = `Buy ${ing.pack.label} (RM${ing.pack.price.toFixed(2)})`;
      estimatedCost = Math.min(estimatedCost, ing.pack.price);
    }
    items.push({
      id: uid(),
      name: ing.name,
      ingredientId,
      qty: Math.round(entry.qty * 100) / 100,
      unit: ing.unit,
      category: ing.category,
      checked: false,
      owned,
      estimatedCost,
      fromRecipes: [...entry.from],
      packSuggestion,
    });
  }

  const order = ['protein', 'seafood', 'egg', 'vegetable', 'fruit', 'herb', 'grain', 'noodle', 'dairy', 'sauce', 'spice', 'oil', 'dry-goods', 'other'];
  items.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  return items;
}

export const CATEGORY_LABELS: Record<string, string> = {
  protein: '🍗 Protein', seafood: '🐟 Seafood', egg: '🥚 Eggs', vegetable: '🥬 Vegetables',
  fruit: '🍋 Fruit', herb: '🌿 Herbs', grain: '🍚 Rice & Grains', noodle: '🍜 Noodles',
  dairy: '🥛 Dairy', sauce: '🍶 Sauces & Pastes', spice: '🟡 Spices', oil: '🛢️ Oils',
  'dry-goods': '📦 Dry Goods', other: '🧺 Others',
};
