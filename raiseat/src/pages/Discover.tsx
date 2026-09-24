import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { RECIPES } from '../data/recipes';
import { scoreRecipe } from '../services/recommend';
import type { Cuisine, ScoredRecipe } from '../types';
import { formatRM, formatMinutes } from '../utils/format';
import RecipeCard from '../components/RecipeCard';
import SectionHeader from '../components/SectionHeader';

const CUISINES: (Cuisine | 'All')[] = ['All', 'Malay', 'Kelantan', 'Terengganu', 'Sabah', 'Sarawak', 'Penang', 'Chinese', 'Indian', 'Thai', 'Fusion'];

export default function Discover() {
  const { ownedIngredientIds, prefs } = useApp();
  const [cuisine, setCuisine] = useState<Cuisine | 'All'>('All');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const scored = useMemo(() => {
    const servings = prefs.householdAdults + prefs.householdKids || 4;
    return RECIPES.map((r) => scoreRecipe(r, {
      ownedIds: ownedIngredientIds,
      servings,
      favoriteCuisines: prefs.favoriteCuisines,
      dietary: prefs.dietary,
    }));
  }, [ownedIngredientIds, prefs]);

  const filtered = cuisine === 'All' ? scored : scored.filter((s) => s.recipe.cuisine === cuisine);

  const rows: { title: string; subtitle: string; items: ScoredRecipe[] }[] = useMemo(() => {
    if (cuisine !== 'All') return [];
    const by = (pred: (s: ScoredRecipe) => boolean, sort?: (a: ScoredRecipe, b: ScoredRecipe) => number) =>
      [...scored.filter(pred)].sort(sort ?? ((a, b) => b.score - a.score)).slice(0, 4);
    return [
      { title: '✨ For you', subtitle: `Your favourites: ${prefs.favoriteCuisines.join(', ')}`, items: by((s) => prefs.favoriteCuisines.includes(s.recipe.cuisine)) },
      { title: '💸 Under RM5/person', subtitle: 'Cheapest cost per serving', items: by((s) => s.cost.perServing <= 5, (a, b) => a.cost.perServing - b.cost.perServing) },
      { title: '⚡ 30-minute meals', subtitle: 'Prep + cook within half an hour', items: by((s) => s.recipe.prepMinutes + s.recipe.cookMinutes <= 30) },
      { title: '🏝️ Borneo kitchen', subtitle: 'Sabah & Sarawak specialties', items: by((s) => s.recipe.cuisine === 'Sabah' || s.recipe.cuisine === 'Sarawak') },
      { title: '🌊 East Coast classics', subtitle: 'Kelantan & Terengganu', items: by((s) => s.recipe.cuisine === 'Kelantan' || s.recipe.cuisine === 'Terengganu') },
      { title: '🍲 One-pot & travel-friendly', subtitle: 'Minimal equipment needed', items: by((s) => s.recipe.tags.includes('one-pot') || s.recipe.tags.includes('travel')) },
      { title: '♻️ Fridge clean-out', subtitle: 'Flexible with whatever you have', items: by((s) => s.recipe.tags.includes('fridge-cleanout') || s.recipe.tags.includes('leftover-friendly')) },
    ].filter((r) => r.items.length > 0);
  }, [scored, cuisine, prefs.favoriteCuisines]);

  const toggleCompare = (id: string) =>
    setCompareIds((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c);
  const comparing = scored.filter((s) => compareIds.includes(s.recipe.id));

  return (
    <div className="container-xl py-3">
      <h1 className="h3">Discover Malaysian food</h1>
      <p className="text-muted">Every card shows real cost and pantry match for your kitchen.</p>

      <div className="d-flex flex-wrap gap-1 mb-2">
        {CUISINES.map((c) => (
          <button key={c} className={`btn btn-sm ${cuisine === c ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setCuisine(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="small text-muted mb-3">
        Tick <b>Compare</b> on up to 3 recipes to see them side by side.
      </div>

      {comparing.length >= 2 && (
        <div className="card mb-4"><div className="card-body">
          <h2 className="h6">⚖️ Comparison</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th></th>{comparing.map((s) => <th key={s.recipe.id}>{s.recipe.emoji} {s.recipe.title}</th>)}</tr></thead>
              <tbody>
                <tr><td className="text-muted">Cost</td>{comparing.map((s) => <td key={s.recipe.id} className="fw-semibold">{formatRM(s.cost.total)}</td>)}</tr>
                <tr><td className="text-muted">Cost/person</td>{comparing.map((s) => <td key={s.recipe.id}>{formatRM(s.cost.perServing)}</td>)}</tr>
                <tr><td className="text-muted">Servings</td>{comparing.map((s) => <td key={s.recipe.id}>{s.servings}</td>)}</tr>
                <tr><td className="text-muted">Time</td>{comparing.map((s) => <td key={s.recipe.id}>{formatMinutes(s.recipe.prepMinutes + s.recipe.cookMinutes)}</td>)}</tr>
                <tr><td className="text-muted">Pantry match</td>{comparing.map((s) => (
                  <td key={s.recipe.id}>
                    <span className={`badge ${s.matchPercent >= 80 ? 'text-bg-success' : s.matchPercent >= 50 ? 'text-bg-warning' : 'text-bg-secondary'}`}>{s.matchPercent}%</span>
                  </td>
                ))}</tr>
                <tr><td className="text-muted">Difficulty</td>{comparing.map((s) => <td key={s.recipe.id}>{s.recipe.difficulty}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div></div>
      )}

      {cuisine === 'All' ? (
        rows.map((row) => (
          <div key={row.title}>
            <SectionHeader title={row.title} subtitle={row.subtitle} />
            <div className="row g-3">
              {row.items.map((s) => (
                <div className="col-12 col-md-6 col-xl-3" key={s.recipe.id}>
                  <div className="compare-check form-check">
                    <input className="form-check-input" type="checkbox" id={`cmp-${row.title}-${s.recipe.id}`}
                      checked={compareIds.includes(s.recipe.id)} onChange={() => toggleCompare(s.recipe.id)} />
                    <label className="form-check-label small text-muted" htmlFor={`cmp-${row.title}-${s.recipe.id}`}>Compare</label>
                  </div>
                  <RecipeCard scored={s} />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="row g-3 mt-1">
          {filtered.length === 0 && <div className="text-muted">No {cuisine} recipes in the demo set yet.</div>}
          {filtered.sort((a, b) => b.score - a.score).map((s) => (
            <div className="col-12 col-md-6 col-xl-3" key={s.recipe.id}>
              <div className="compare-check form-check">
                <input className="form-check-input" type="checkbox" id={`cmp-${s.recipe.id}`}
                  checked={compareIds.includes(s.recipe.id)} onChange={() => toggleCompare(s.recipe.id)} />
                <label className="form-check-label small text-muted" htmlFor={`cmp-${s.recipe.id}`}>Compare</label>
              </div>
              <RecipeCard scored={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
