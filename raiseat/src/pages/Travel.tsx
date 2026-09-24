import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { ROUTES, FOOD_PLACES } from '../data/travel';
import { recommend } from '../services/recommend';
import { formatRM, formatRMRange } from '../utils/format';
import type { Equipment } from '../types';
import RecipeCard from '../components/RecipeCard';
import SectionHeader from '../components/SectionHeader';

const EQUIPMENT_OPTIONS: { key: Equipment; label: string }[] = [
  { key: 'rice-cooker', label: 'Rice cooker' },
  { key: 'stove', label: 'Portable stove' },
  { key: 'pan', label: 'Frying pan' },
  { key: 'pot', label: 'Pot' },
  { key: 'air-fryer', label: 'Air fryer' },
  { key: 'oven', label: 'Oven' },
  { key: 'knife', label: 'Knife' },
];

const FUEL_PRICE_RM_PER_L = 2.05; // RON95 demo estimate
const FUEL_L_PER_100KM = 7.5;

export default function Travel() {
  const [params] = useSearchParams();
  const { ownedIngredientIds, prefs } = useApp();
  const [routeId, setRouteId] = useState(() => params.get('route') ?? 'kl-penang');
  const [people, setPeople] = useState(() => Number(params.get('people')) || 4);
  const [budget, setBudget] = useState(() => Number(params.get('budget')) || 300);
  const [equipment, setEquipment] = useState<Equipment[]>(['rice-cooker', 'pan', 'knife']);
  const [removedStops, setRemovedStops] = useState<Set<string>>(new Set());

  const route = ROUTES.find((r) => r.id === routeId) ?? ROUTES[0];
  const stops = route.stops.filter((s) => !removedStops.has(s.name));

  const foodBudgetSplit = useMemo(() => ([
    { label: 'Breakfast', amount: budget * 0.2 },
    { label: 'Lunch', amount: budget * 0.33 },
    { label: 'Dinner', amount: budget * 0.33 },
    { label: 'Snacks', amount: budget * 0.14 },
  ]), [budget]);

  const fuelCost = (route.distanceKm / 100) * FUEL_L_PER_100KM * FUEL_PRICE_RM_PER_L;
  const tollEstimate = route.distanceKm * 0.10; // rough demo heuristic
  const stopCost = stops.reduce((s, x) => s + ((x.pricePerPerson[0] + x.pricePerPerson[1]) / 2) * people, 0);

  const travelRecipes = useMemo(() => recommend({
    ownedIds: ownedIngredientIds,
    servings: people,
    equipment,
    dietary: prefs.dietary,
    favoriteCuisines: prefs.favoriteCuisines,
    limit: 20,
  }).filter((s) => s.warnings.every((w) => !w.startsWith('Needs:'))).slice(0, 3), [ownedIngredientIds, people, equipment, prefs]);

  const routeCities = [route.from.split(',')[0], route.to.split(',')[0], ...route.stops.map((s) => s.name)]
    .map((c) => c.toLowerCase());
  const placesOnRoute = FOOD_PLACES.filter((p) => {
    const city = p.city.toLowerCase();
    // full-name containment either way, so "Tapah R&R" matches "Tapah"
    // but "Kota Bharu" never matches "Kota Kinabalu"
    return routeCities.some((c) => c.includes(city) || city.includes(c));
  });

  return (
    <div className="container-xl py-3">
      <h1 className="h3">🚗 Travel Food Planner</h1>
      <p className="text-muted">Pick a route, set your budget, and plan every makan stop. <span className="badge text-bg-light border">Demo data</span></p>

      <div className="card"><div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-5">
            <label className="form-label fw-semibold" htmlFor="routeSel">Route</label>
            <select id="routeSel" className="form-select" value={route.id} onChange={(e) => { setRouteId(e.target.value); setRemovedStops(new Set()); }}>
              {ROUTES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold" htmlFor="tp">People</label>
            <input id="tp" type="number" min={1} className="form-control" value={people} onChange={(e) => setPeople(Number(e.target.value) || 1)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold" htmlFor="tb">Food budget</label>
            <div className="input-group">
              <span className="input-group-text">RM</span>
              <input id="tb" type="number" min={0} className="form-control" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="col-12 col-md-2">
            <div className="text-muted small">🛣️ {route.distanceKm} km · ~{route.driveHours} hr drive</div>
          </div>
        </div>
      </div></div>

      <div className="row g-3 mt-1">
        <div className="col-12 col-lg-7">
          <SectionHeader title={`Suggested food stops: ${route.from.split(',')[0]} → ${route.to.split(',')[0]}`} subtitle="Remove any stop you want to skip" />
          <div className="route-timeline">
            {stops.map((s, i) => (
              <div className="route-stop" key={s.name}>
                <div className="route-dot">{i + 1}</div>
                <div className="card flex-grow-1"><div className="card-body py-2 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{s.name} <span className="text-muted small">· km {s.km}</span></div>
                    <div className="small text-muted">
                      {s.kind === 'meal' ? '🍽️' : s.kind === 'snack' ? '🍢' : '⛽'} {s.suggestion}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="small fw-semibold">{formatRMRange(s.pricePerPerson[0], s.pricePerPerson[1])}<span className="text-muted">/pax</span></div>
                    <button className="btn btn-sm btn-outline-danger py-0 mt-1" onClick={() => setRemovedStops((r) => new Set([...r, s.name]))}>skip</button>
                  </div>
                </div></div>
              </div>
            ))}
          </div>
          {removedStops.size > 0 && (
            <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setRemovedStops(new Set())}>↺ Restore skipped stops</button>
          )}
          <div className="card mt-3"><div className="card-body">
            <h2 className="h6">🍜 Local specialties on this route</h2>
            <div className="d-flex flex-wrap gap-2">
              {route.specialties.map((sp) => <span key={sp} className="badge text-bg-warning-subtle border text-dark">{sp}</span>)}
            </div>
          </div></div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card"><div className="card-body">
            <h2 className="h6">💰 Trip cost estimate</h2>
            <div className="budget-stat"><span className="text-muted">⛽ Fuel ({FUEL_L_PER_100KM} L/100km @ RM{FUEL_PRICE_RM_PER_L})</span><b>{formatRM(fuelCost)}</b></div>
            <div className="budget-stat"><span className="text-muted">🛣️ Tolls (est.)</span><b>{formatRM(tollEstimate)}</b></div>
            <div className="budget-stat"><span className="text-muted">🍽️ Food stops × {people} pax (est.)</span><b>{formatRM(stopCost)}</b></div>
            <hr className="my-2" />
            <div className="budget-stat fs-5"><span>Total (one way)</span><b>{formatRM(fuelCost + tollEstimate + stopCost)}</b></div>
            <div className="budget-stat small text-muted"><span>Per person</span><span>{formatRM((fuelCost + tollEstimate + stopCost) / people)}</span></div>
            <div className={`alert ${stopCost <= budget ? 'alert-success' : 'alert-danger'} mt-2 mb-0 py-2 small`}>
              {stopCost <= budget
                ? <>✓ Food stops fit your RM{budget} food budget ({formatRM(budget - stopCost)} spare for snacks).</>
                : <>⚠ Food stops exceed your RM{budget} budget — skip a stop or cook along the way.</>}
            </div>
          </div></div>

          <div className="card mt-3"><div className="card-body">
            <h2 className="h6">Budget allocation</h2>
            {foodBudgetSplit.map((b) => (
              <div className="budget-stat" key={b.label}><span className="text-muted">{b.label}</span><b>{formatRM(b.amount)}</b></div>
            ))}
          </div></div>

          <div className="card mt-3"><div className="card-body">
            <h2 className="h6">📍 Eat along the way</h2>
            {placesOnRoute.length === 0 && <div className="text-muted small">No demo listings for this route's towns.</div>}
            {placesOnRoute.map((p) => (
              <div key={p.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                <div>
                  <div className="fw-semibold small">{p.name}</div>
                  <div className="tiny text-muted">
                    {p.city} · {p.kind} · ⭐ {p.rating}{p.halalClaimed && ' · halal-claimed*'}
                  </div>
                </div>
                <div className="small fw-semibold">{formatRMRange(p.pricePerPerson[0], p.pricePerPerson[1])}</div>
              </div>
            ))}
            <div className="tiny text-muted mt-2">*User-reported, not verified certification. Demo listings.</div>
          </div></div>
        </div>
      </div>

      <SectionHeader
        title="🏕️ Cook while travelling"
        subtitle="Staying at a homestay or Airbnb? Tick what's in the kitchen and we'll match meals."
      />
      <div className="d-flex flex-wrap gap-2 mb-3">
        {EQUIPMENT_OPTIONS.map((e) => (
          <button
            key={e.key}
            className={`btn btn-sm ${equipment.includes(e.key) ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setEquipment((eq) => eq.includes(e.key) ? eq.filter((x) => x !== e.key) : [...eq, e.key])}
            aria-pressed={equipment.includes(e.key)}
          >
            {equipment.includes(e.key) ? '☑' : '☐'} {e.label}
          </button>
        ))}
      </div>
      <div className="row g-3">
        {travelRecipes.map((s) => (
          <div className="col-12 col-md-6 col-xl-4" key={s.recipe.id}><RecipeCard scored={s} showWhy /></div>
        ))}
        {travelRecipes.length === 0 && (
          <div className="col-12"><div className="alert alert-light border">No matches for that equipment — try adding a pan or pot.</div></div>
        )}
      </div>
    </div>
  );
}
