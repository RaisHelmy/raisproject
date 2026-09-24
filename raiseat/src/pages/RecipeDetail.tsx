import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { RECIPE_MAP } from '../data/recipes';
import { INGREDIENT_MAP } from '../data/ingredients';
import { substitutesFor } from '../data/substitutions';
import { estimateCost, eatOutEstimate } from '../services/cost';
import { buildShoppingItems } from '../services/shopping';
import { formatRM, formatRMRange, formatQty, formatMinutes } from '../utils/format';
import { useApp } from '../state/AppContext';
import ServingSelector from '../components/ServingSelector';
import EmptyState from '../components/EmptyState';

type Tab = 'ingredients' | 'steps' | 'cost' | 'nutrition' | 'subs' | 'leftovers';

export default function RecipeDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const recipe = id ? RECIPE_MAP[id] : undefined;
  const { ownedIngredientIds, setShopping, favorites, toggleFavorite } = useApp();
  const [servings, setServings] = useState(() => Number(params.get('servings')) || recipe?.baseServings || 4);
  const [tab, setTab] = useState<Tab>('ingredients');
  const [added, setAdded] = useState(false);

  const cost = useMemo(
    () => (recipe ? estimateCost(recipe, servings) : null),
    [recipe, servings],
  );

  if (!recipe || !cost) {
    return (
      <div className="container-xl py-4">
        <EmptyState icon="🍽️" title="Recipe not found">
          <Link to="/discover">Browse recipes instead</Link>
        </EmptyState>
      </div>
    );
  }

  const factor = servings / recipe.baseServings;
  const totalMin = recipe.prepMinutes + recipe.cookMinutes;
  const eatOut = eatOutEstimate(servings);
  const savings = eatOut.mid - cost.total;
  const missing = recipe.ingredients.filter((ri) => !ownedIngredientIds.has(ri.ingredientId) && !ri.optional);
  const fav = favorites.includes(recipe.id);

  const addMissingToShopping = () => {
    const items = buildShoppingItems([{ recipe, servings }], ownedIngredientIds)
      .filter((i) => !i.owned);
    setShopping((prev) => {
      const existing = new Set(prev.map((p) => p.ingredientId));
      return [...prev, ...items.filter((i) => !existing.has(i.ingredientId))];
    });
    setAdded(true);
  };

  const pieOptions: Highcharts.Options = {
    chart: { type: 'pie', height: 260, backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    tooltip: { pointFormat: '<b>RM{point.y:.2f}</b> ({point.percentage:.0f}%)' },
    plotOptions: { pie: { dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.0f}%' } } },
    series: [{
      type: 'pie',
      name: 'Cost',
      data: cost.breakdown.slice(0, 6).map((b) => ({ name: b.name, y: b.cost }))
        .concat(cost.breakdown.length > 6
          ? [{ name: 'Others', y: cost.breakdown.slice(6).reduce((s, b) => s + b.cost, 0) }]
          : []),
    }],
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'steps', label: 'Steps' },
    { key: 'cost', label: 'Cost' },
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'subs', label: 'Substitutions' },
    { key: 'leftovers', label: 'Leftovers' },
  ];

  return (
    <div className="container-xl py-3">
      <nav aria-label="breadcrumb" className="small">
        <Link to="/discover" className="text-decoration-none">← Back to Discover</Link>
      </nav>

      <div className="card mt-2">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="h3 mb-1">{recipe.emoji} {recipe.title}</h1>
              <p className="text-muted mb-2">{recipe.description}</p>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge text-bg-light border">⭐ {recipe.rating.toFixed(1)}</span>
                <span className="badge text-bg-light border">{recipe.cuisine}{recipe.region ? ` · ${recipe.region}` : ''}</span>
                <span className="badge text-bg-light border">{recipe.difficulty}</span>
                <span className="badge text-bg-light border">⏱ {formatMinutes(totalMin)}</span>
                {recipe.halalFriendly && (
                  <span className="badge text-bg-light border" title="Ingredient-level check only — not a halal certification">
                    Halal-friendly ingredients*
                  </span>
                )}
              </div>
            </div>
            <div className="text-end">
              <button className={`btn ${fav ? 'btn-danger' : 'btn-outline-danger'} btn-sm mb-2`} onClick={() => toggleFavorite(recipe.id)}>
                {fav ? '❤️ Saved' : '🤍 Save'}
              </button>
              <div className="display-6 fw-bold">{formatRM(cost.total)}</div>
              <div className="text-muted">{formatRM(cost.perServing)}/person · {servings} servings</div>
              <div className="small text-muted">
                Range {formatRMRange(cost.low, cost.high)} · <span className={`badge ${cost.confidence === 'High' ? 'text-bg-success' : cost.confidence === 'Medium' ? 'text-bg-warning' : 'text-bg-secondary'}`}>{cost.confidence} confidence</span>
              </div>
            </div>
          </div>

          <div className="row mt-3 g-3 align-items-center">
            <div className="col-auto">
              <label className="form-label fw-semibold mb-1">Serves</label>
              <ServingSelector value={servings} onChange={setServings} />
              {factor > 2 && <div className="small text-warning-emphasis mt-1">⚠ Big batch — may need two cooking rounds.</div>}
            </div>
            <div className="col-auto ms-auto d-flex gap-2">
              <Link to={`/cook/${recipe.id}?servings=${servings}`} className="btn btn-primary">▶ Start Cooking Mode</Link>
              <button className="btn btn-outline-primary" onClick={addMissingToShopping} disabled={missing.length === 0 || added}>
                {added ? '✓ Added to list' : missing.length === 0 ? '✓ You have everything' : `🛒 Add ${missing.length} missing to list`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ul className="nav nav-pills my-3 flex-nowrap overflow-auto">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'ingredients' && (
        <div className="card"><div className="card-body">
          <div className="small text-muted mb-2">Scaled for {servings} servings (base recipe: {recipe.baseServings}).</div>
          <ul className="list-group list-group-flush">
            {recipe.ingredients.map((ri) => {
              const ing = INGREDIENT_MAP[ri.ingredientId];
              const owned = ownedIngredientIds.has(ri.ingredientId);
              return (
                <li key={ri.ingredientId} className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <span>
                    {owned ? '✓ ' : '• '}{ing?.emoji} {ing?.name ?? ri.ingredientId}
                    {ri.optional && <span className="badge text-bg-light border ms-2">optional</span>}
                    {ri.note && <span className="text-muted small ms-2">({ri.note})</span>}
                  </span>
                  <span className="d-flex align-items-center gap-3">
                    <span className="fw-semibold">{formatQty(ri.qty * factor, ri.unit)}</span>
                    <span className={`small ${owned ? 'text-success' : 'text-muted'}`}>{owned ? 'have' : 'buy'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div></div>
      )}

      {tab === 'steps' && (
        <div className="card"><div className="card-body">
          <ol className="steps-list">
            {recipe.steps.map((s, i) => (
              <li key={i} className="mb-3">
                {s.text}
                {s.timerMinutes && <span className="badge text-bg-light border ms-2">⏲ {s.timerMinutes} min</span>}
              </li>
            ))}
          </ol>
          <div className="small text-muted">Equipment: {recipe.equipment.join(', ')}</div>
        </div></div>
      )}

      {tab === 'cost' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card h-100"><div className="card-body">
              <h3 className="h6">Cost breakdown</h3>
              <HighchartsReact highcharts={Highcharts} options={pieOptions} />
              <div className="small text-muted">{cost.source}</div>
            </div></div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="card h-100"><div className="card-body">
              <h3 className="h6">Cook at home vs eat out</h3>
              <div className="compare-row">
                <div>🏠 Cook at home</div><div className="fw-bold">{formatRM(cost.total)}</div>
              </div>
              <div className="compare-row">
                <div>🍽️ Eating out (est.)</div><div className="fw-bold">{formatRMRange(eatOut.low, eatOut.high)}</div>
              </div>
              <div className={`alert ${savings > 0 ? 'alert-success' : 'alert-secondary'} mt-3 mb-0`}>
                {savings > 0
                  ? <>💰 You save approximately <b>{formatRM(savings)}</b> cooking this at home for {servings} people.</>
                  : <>Eating out may be comparable for this dish at {servings} servings.</>}
              </div>
              <Link to="/compare" className="btn btn-sm btn-outline-secondary mt-3">Full comparison tool →</Link>
            </div></div>
          </div>
        </div>
      )}

      {tab === 'nutrition' && (
        <div className="card"><div className="card-body">
          <h3 className="h6 mb-3">Per serving (estimated)</h3>
          <div className="row g-3 text-center">
            {[
              ['Calories', `${recipe.nutritionPerServing.calories}`, 'kcal'],
              ['Protein', `${recipe.nutritionPerServing.protein}`, 'g'],
              ['Carbs', `${recipe.nutritionPerServing.carbs}`, 'g'],
              ['Fat', `${recipe.nutritionPerServing.fat}`, 'g'],
            ].map(([label, v, unit]) => (
              <div className="col-6 col-md-3" key={label}>
                <div className="nutrition-tile">
                  <div className="fs-4 fw-bold">{v}<span className="fs-6 text-muted"> {unit}</span></div>
                  <div className="small text-muted">{label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="small text-muted mt-3">Demo estimates for guidance — not verified nutrition data.</div>
        </div></div>
      )}

      {tab === 'subs' && (
        <div className="card"><div className="card-body">
          <h3 className="h6 mb-3">If you're missing something</h3>
          {recipe.ingredients.map((ri) => {
            const subs = substitutesFor(ri.ingredientId);
            if (subs.length === 0) return null;
            const ing = INGREDIENT_MAP[ri.ingredientId];
            return (
              <div key={ri.ingredientId} className="mb-3">
                <div className="fw-semibold">{ing?.emoji} {ing?.name}</div>
                {subs.map((s) => (
                  <div key={s.substituteId} className="small text-muted ms-3">
                    → {INGREDIENT_MAP[s.substituteId]?.name} {'★'.repeat(s.similarity)}{'☆'.repeat(5 - s.similarity)} — {s.note}
                  </div>
                ))}
              </div>
            );
          })}
          {recipe.ingredients.every((ri) => substitutesFor(ri.ingredientId).length === 0) && (
            <div className="text-muted">No common substitutions recorded for this recipe's ingredients.</div>
          )}
        </div></div>
      )}

      {tab === 'leftovers' && (
        <div className="card"><div className="card-body">
          <h3 className="h6 mb-3">♻️ Cook once, eat multiple meals</h3>
          {recipe.leftoverIdeas?.length
            ? <ul>{recipe.leftoverIdeas.map((l) => <li key={l}>{l}</li>)}</ul>
            : <div className="text-muted">This dish is best eaten fresh, but extra portions keep for tomorrow's lunch.</div>}
          {recipe.storageNote && <div className="alert alert-light border mt-2 mb-0">📦 {recipe.storageNote}</div>}
        </div></div>
      )}
    </div>
  );
}
