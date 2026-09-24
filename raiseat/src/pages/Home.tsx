import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { parseIntent, describeIntent } from '../services/intent';
import { recommend } from '../services/recommend';
import type { Cuisine, FoodPlanningIntent } from '../types';
import { INGREDIENT_MAP } from '../data/ingredients';
import { expiryLabel, daysUntil } from '../utils/format';
import IngredientPicker from '../components/IngredientPicker';
import ServingSelector from '../components/ServingSelector';
import RecipeCard from '../components/RecipeCard';
import SectionHeader from '../components/SectionHeader';

const TIME_OPTIONS = [{ label: '15 min', v: 15 }, { label: '30 min', v: 30 }, { label: '1 hour', v: 60 }, { label: 'Any', v: 0 }];
const CUISINE_OPTIONS: (Cuisine | 'Any')[] = ['Any', 'Malay', 'Kelantan', 'Sabah', 'Sarawak', 'Chinese', 'Indian', 'Penang', 'Thai'];
const DEMOS = [
  'I have chicken, eggs, rice and RM30 for 5 people',
  'RM50 to feed 8 people',
  'Use ingredients expiring soon',
  'KL to Penang road trip, 4 people',
  'Kelantan style dinner for 4',
];

export default function Home() {
  const { pantry, ownedIngredientIds, prefs, addHistory } = useApp();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [intent, setIntent] = useState<FoodPlanningIntent | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [servings, setServings] = useState(4);
  const [budget, setBudget] = useState<number | ''>('');
  const [maxMinutes, setMaxMinutes] = useState(0);
  const [cuisine, setCuisine] = useState<Cuisine | 'Any'>('Any');
  const [useExpiring, setUseExpiring] = useState(false);
  const [searched, setSearched] = useState(false);

  const expiringItems = useMemo(
    () => pantry
      .filter((p) => p.expiryDate && daysUntil(p.expiryDate) <= 3 && daysUntil(p.expiryDate) >= 0)
      .sort((a, b) => daysUntil(a.expiryDate!) - daysUntil(b.expiryDate!)),
    [pantry],
  );
  const expiringIds = useMemo(() => new Set(expiringItems.map((p) => p.ingredientId)), [expiringItems]);

  const runSearch = (fromText?: string) => {
    const raw = fromText ?? text;
    let next = { ingredients, servings, budget, maxMinutes, cuisine, useExpiring };
    if (raw.trim()) {
      const parsed = parseIntent(raw);
      setIntent(parsed);
      if (parsed.routeQuery) {
        addHistory('search', raw);
        navigate(`/travel?route=${parsed.routeQuery}${parsed.servings ? `&people=${parsed.servings}` : ''}${parsed.budget ? `&budget=${parsed.budget}` : ''}`);
        return;
      }
      next = {
        ingredients: [...new Set([...ingredients, ...parsed.ingredients])],
        servings: parsed.servings ?? servings,
        budget: parsed.budget ?? budget,
        maxMinutes: parsed.maxMinutes ?? maxMinutes,
        cuisine: parsed.cuisine ?? cuisine,
        useExpiring: parsed.expiring ?? useExpiring,
      };
      setIngredients(next.ingredients);
      setServings(next.servings);
      setBudget(next.budget);
      setMaxMinutes(next.maxMinutes);
      setCuisine(next.cuisine);
      setUseExpiring(next.useExpiring);
      addHistory('search', raw);
    }
    setSearched(true);
  };

  const results = useMemo(() => {
    if (!searched) return [];
    const owned = new Set([...ownedIngredientIds, ...ingredients]);
    return recommend({
      ownedIds: owned,
      preferredIds: ingredients.length > 0 ? new Set(ingredients) : undefined,
      budget: budget === '' ? undefined : budget,
      servings,
      maxMinutes: maxMinutes || undefined,
      cuisine,
      expiringIds: useExpiring ? expiringIds : undefined,
      dietary: prefs.dietary,
      favoriteCuisines: prefs.favoriteCuisines,
      limit: 6,
    });
  }, [searched, ownedIngredientIds, ingredients, budget, servings, maxMinutes, cuisine, useExpiring, expiringIds, prefs]);

  const forYou = useMemo(() => recommend({
    ownedIds: ownedIngredientIds,
    favoriteCuisines: prefs.favoriteCuisines,
    dietary: prefs.dietary,
    servings: prefs.householdAdults + prefs.householdKids || 4,
    limit: 4,
  }), [ownedIngredientIds, prefs]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="container-xl py-3">
      <div className="hero card border-0">
        <div className="card-body p-4">
          <h1 className="h3 mb-1">{greeting} 👋</h1>
          <p className="text-muted mb-3">What are we cooking today?</p>

          <form
            className="d-flex gap-2 flex-wrap flex-sm-nowrap"
            onSubmit={(e) => { e.preventDefault(); runSearch(); }}
            role="search"
          >
            <input
              className="form-control form-control-lg assistant-input"
              style={{ minWidth: 0 }}
              placeholder='Try: "I have chicken, eggs and RM30 for 5 people"'
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Describe what you have or want"
            />
            <button className="btn btn-primary btn-lg text-nowrap" type="submit">Find meals →</button>
          </form>

          <div className="d-flex flex-wrap gap-1 mt-2">
            {DEMOS.map((d) => (
              <button key={d} className="btn btn-sm btn-outline-secondary demo-chip" onClick={() => { setText(d); runSearch(d); }}>
                {d}
              </button>
            ))}
          </div>

          {intent && (
            <div className="mt-2 small text-muted" aria-live="polite">
              Understood: {describeIntent(intent).join(' · ') || 'general search'}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <div className="row g-4">
            <div className="col-12 col-lg-5">
              <label className="form-label fw-semibold">🥘 What do you have?</label>
              <IngredientPicker selected={ingredients} onChange={setIngredients} />
              <div className="form-check mt-2">
                <input className="form-check-input" type="checkbox" id="usePantry" checked readOnly />
                <label className="form-check-label small text-muted" htmlFor="usePantry">
                  Your pantry ({ownedIngredientIds.size} items) is always counted
                </label>
              </div>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label fw-semibold">👥 People</label>
              <ServingSelector value={servings} onChange={setServings} />
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label fw-semibold" htmlFor="budgetInput">💰 Budget</label>
              <div className="input-group">
                <span className="input-group-text">RM</span>
                <input
                  id="budgetInput" type="number" min={1} className="form-control" placeholder="30"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <label className="form-label fw-semibold mt-3">⏱ Time</label>
              <div className="d-flex flex-wrap gap-1">
                {TIME_OPTIONS.map((t) => (
                  <button key={t.label} className={`btn btn-sm ${maxMinutes === t.v ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setMaxMinutes(t.v)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label fw-semibold">🍛 Cuisine</label>
              <div className="d-flex flex-wrap gap-1">
                {CUISINE_OPTIONS.map((cz) => (
                  <button key={cz} className={`btn btn-sm ${cuisine === cz ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setCuisine(cz)}>{cz}</button>
                ))}
              </div>
              {expiringItems.length > 0 && (
                <div className="form-check mt-3">
                  <input className="form-check-input" type="checkbox" id="expiringChk"
                    checked={useExpiring} onChange={(e) => setUseExpiring(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="expiringChk">
                    ♻️ Prioritise {expiringItems.length} expiring item{expiringItems.length > 1 ? 's' : ''}
                  </label>
                </div>
              )}
              <button className="btn btn-primary w-100 mt-3" onClick={() => runSearch()}>Find meals →</button>
            </div>
          </div>
        </div>
      </div>

      {searched && (
        <>
          <SectionHeader
            title={results.length > 0 ? 'Recommended for you' : 'No good match'}
            subtitle={results.length > 0 ? 'Ranked by pantry match, budget, time and your tastes — each card explains why.' : undefined}
          />
          {results.length === 0 ? (
            <div className="alert alert-light border">
              We couldn't find a good match. Try increasing your budget, adding another ingredient, or allowing more time.
            </div>
          ) : (
            <div className="row g-3">
              {results.map((s, idx) => (
                <div className="col-12 col-md-6 col-xl-4" key={s.recipe.id}>
                  {idx === 0 && <div className="best-match-tag">🏆 BEST MATCH</div>}
                  <RecipeCard scored={s} showWhy />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {expiringItems.length > 0 && (
        <>
          <SectionHeader
            title="🚨 Use these first"
            subtitle="Sorted by expiry — cook them before they go to waste"
            action={<Link to="/pantry" className="btn btn-sm btn-outline-secondary">Open pantry</Link>}
          />
          <div className="d-flex flex-wrap gap-2">
            {expiringItems.map((p) => {
              const lbl = expiryLabel(p.expiryDate);
              return (
                <div key={p.id} className={`use-soon-chip border-${lbl.tone === 'danger' ? 'danger' : 'warning'}`}>
                  <span>{INGREDIENT_MAP[p.ingredientId]?.emoji} {INGREDIENT_MAP[p.ingredientId]?.name}</span>
                  <span className={`small text-${lbl.tone === 'danger' ? 'danger' : 'warning-emphasis'}`}>{lbl.text}</span>
                </div>
              );
            })}
            <button className="btn btn-sm btn-warning align-self-center" onClick={() => { setUseExpiring(true); setSearched(true); }}>
              Cook with these →
            </button>
          </div>
        </>
      )}

      {!searched && (
        <>
          <SectionHeader title="✨ For you" subtitle={`Based on your favourites: ${prefs.favoriteCuisines.join(', ')}`} />
          <div className="row g-3">
            {forYou.map((s) => (
              <div className="col-12 col-md-6 col-xl-3" key={s.recipe.id}>
                <RecipeCard scored={s} />
              </div>
            ))}
          </div>

          <SectionHeader title="Quick actions" />
          <div className="row g-3 mb-4">
            {[
              { to: '/discover', icon: '🍳', label: 'Cook With My Ingredients', sub: 'Browse everything you can make' },
              { to: '/budget', icon: '💰', label: 'Budget Meals', sub: 'Track & optimise spending' },
              { to: '/pantry', icon: '🧊', label: 'My Fridge', sub: `${pantry.length} items tracked` },
              { to: '/shopping', icon: '🛒', label: 'Shopping List', sub: 'Grouped & combined' },
              { to: '/meal-plan', icon: '📅', label: 'Meal Planner', sub: 'Plan your week' },
              { to: '/travel', icon: '🚗', label: 'Travel Food', sub: 'Route-aware food plans' },
            ].map((c) => (
              <div className="col-6 col-md-4 col-xl-2" key={c.to}>
                <Link to={c.to} className="quick-card card h-100 text-decoration-none">
                  <div className="card-body text-center">
                    <div className="fs-3" aria-hidden>{c.icon}</div>
                    <div className="fw-semibold small mt-1">{c.label}</div>
                    <div className="text-muted tiny">{c.sub}</div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
