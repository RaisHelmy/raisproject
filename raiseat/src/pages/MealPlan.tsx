import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { RECIPES, RECIPE_MAP } from '../data/recipes';
import { recommend } from '../services/recommend';
import { estimateCost } from '../services/cost';
import { buildShoppingItems } from '../services/shopping';
import { formatRM, uid } from '../utils/format';
import type { MealPlanItem, MealSlot } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: { key: MealSlot; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
];

export default function MealPlan() {
  const { mealPlan, setMealPlan, ownedIngredientIds, prefs, addHistory, setShopping } = useApp();
  const [picking, setPicking] = useState<{ day: number; slot: MealSlot } | null>(null);
  const [genBudget, setGenBudget] = useState<number | ''>('');
  const [addedToList, setAddedToList] = useState(false);

  const servings = prefs.householdAdults + prefs.householdKids || 4;

  const weekCost = useMemo(
    () => mealPlan.reduce((sum, m) => {
      const r = RECIPE_MAP[m.recipeId];
      return r ? sum + estimateCost(r, m.servings).total : sum;
    }, 0),
    [mealPlan],
  );

  const cellFor = (day: number, slot: MealSlot) => mealPlan.find((m) => m.day === day && m.slot === slot);

  const setCell = (day: number, slot: MealSlot, recipeId: string) => {
    setMealPlan((mp) => [
      ...mp.filter((m) => !(m.day === day && m.slot === slot)),
      { id: uid(), day, slot, recipeId, servings },
    ]);
    setPicking(null);
    setAddedToList(false);
  };

  const clearCell = (day: number, slot: MealSlot) => {
    setMealPlan((mp) => mp.filter((m) => !(m.day === day && m.slot === slot)));
    setAddedToList(false);
  };

  /** Generate dinners (and simple breakfasts) for the week, maximising ingredient reuse and budget. */
  const generateWeek = () => {
    const budget = genBudget === '' ? undefined : genBudget;
    const perMealBudget = budget ? budget / 7 : undefined;
    const ranked = recommend({
      ownedIds: ownedIngredientIds,
      servings,
      budget: perMealBudget,
      dietary: prefs.dietary,
      favoriteCuisines: prefs.favoriteCuisines,
      limit: 20,
    });
    const plan: MealPlanItem[] = [];
    const usedProteins = new Map<string, number>();
    let di = 0;
    for (const s of ranked) {
      if (di >= 7) break;
      // encourage protein reuse across consecutive days (buy once, cook twice)
      const protein = s.recipe.ingredients.find((i) => i.ingredientId.startsWith('chicken') || i.ingredientId === 'beef' || i.ingredientId.startsWith('fish') || i.ingredientId === 'prawn')?.ingredientId ?? 'none';
      const count = usedProteins.get(protein) ?? 0;
      if (count >= 3) continue;
      usedProteins.set(protein, count + 1);
      plan.push({ id: uid(), day: di, slot: 'dinner', recipeId: s.recipe.id, servings });
      di++;
    }
    // simple rotating breakfasts
    const breakfasts = RECIPES.filter((r) => r.tags.includes('breakfast') || r.tags.includes('15-min')).slice(0, 3);
    for (let d = 0; d < 7 && breakfasts.length > 0; d++) {
      plan.push({ id: uid(), day: d, slot: 'breakfast', recipeId: breakfasts[d % breakfasts.length].id, servings });
    }
    setMealPlan(plan);
    setAddedToList(false);
    addHistory('plan', `Generated week plan${budget ? ` under RM${budget}` : ''}`);
  };

  const addWeekToShopping = () => {
    const selections = mealPlan
      .map((m) => ({ recipe: RECIPE_MAP[m.recipeId], servings: m.servings }))
      .filter((x) => x.recipe);
    const items = buildShoppingItems(selections, ownedIngredientIds).filter((i) => !i.owned);
    setShopping((prev) => {
      const existing = new Set(prev.map((p) => p.ingredientId));
      return [...prev, ...items.filter((i) => !existing.has(i.ingredientId))];
    });
    setAddedToList(true);
    addHistory('shopping', `Week plan → shopping list (${items.length} items)`);
  };

  return (
    <div className="container-xl py-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-0">📅 Weekly Meal Planner</h1>
          <div className="text-muted small">
            {mealPlan.length} meals planned · estimated week cost <b>{formatRM(weekCost)}</b> for {servings} people
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="input-group input-group-sm" style={{ width: 160 }}>
            <span className="input-group-text">RM</span>
            <input type="number" className="form-control" placeholder="Week budget"
              value={genBudget} onChange={(e) => setGenBudget(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Weekly budget" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={generateWeek}>✨ Generate week</button>
          {mealPlan.length > 0 && (
            <button className="btn btn-outline-primary btn-sm" onClick={addWeekToShopping} disabled={addedToList}>
              {addedToList ? '✓ On shopping list' : '🛒 Shop the week'}
            </button>
          )}
        </div>
      </div>

      <div className="mealplan-grid mt-3">
        <div className="table-responsive">
          <table className="table align-middle mealplan-table">
            <thead>
              <tr>
                <th className="slot-col"></th>
                {DAYS.map((d) => <th key={d} className="text-center">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot.key}>
                  <th className="slot-col text-muted small">{slot.icon} {slot.label}</th>
                  {DAYS.map((_, day) => {
                    const cell = cellFor(day, slot.key);
                    const recipe = cell ? RECIPE_MAP[cell.recipeId] : undefined;
                    return (
                      <td key={day} className="meal-cell">
                        {recipe ? (
                          <div className="meal-chip">
                            <div className="small fw-semibold">{recipe.emoji} {recipe.title}</div>
                            <div className="tiny text-muted">{formatRM(estimateCost(recipe, cell!.servings).total)}</div>
                            <button className="chip-x" onClick={() => clearCell(day, slot.key)} aria-label="Remove meal">×</button>
                          </div>
                        ) : (
                          <button className="btn btn-sm btn-outline-secondary w-100 add-meal" onClick={() => setPicking({ day, slot: slot.key })}>+</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {picking && (
        <div className="card mt-3"><div className="card-body">
          <div className="d-flex justify-content-between">
            <h2 className="h6">Choose a meal for {DAYS[picking.day]} {picking.slot}</h2>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPicking(null)}>Cancel</button>
          </div>
          <div className="row g-2 mt-1">
            {RECIPES.map((r) => (
              <div className="col-6 col-md-4 col-xl-3" key={r.id}>
                <button className="btn btn-outline-secondary w-100 text-start" onClick={() => setCell(picking.day, picking.slot, r.id)}>
                  <div className="small fw-semibold">{r.emoji} {r.title}</div>
                  <div className="tiny text-muted">{formatRM(estimateCost(r, servings).total)} · {r.prepMinutes + r.cookMinutes} min</div>
                </button>
              </div>
            ))}
          </div>
        </div></div>
      )}

      {mealPlan.length === 0 && !picking && (
        <div className="alert alert-light border mt-3">
          💡 Tap <b>✨ Generate week</b> to auto-plan dinners that reuse ingredients (buy 1 kg chicken once, cook it three ways), or tap any <b>+</b> to plan manually.
        </div>
      )}
    </div>
  );
}
