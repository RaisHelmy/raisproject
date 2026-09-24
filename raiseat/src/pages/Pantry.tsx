import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { INGREDIENTS, INGREDIENT_MAP } from '../data/ingredients';
import type { PantryItem, StorageLocation, Unit } from '../types';
import { expiryLabel, daysUntil, formatQty, uid } from '../utils/format';
import { recommend } from '../services/recommend';
import RecipeCard from '../components/RecipeCard';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';

const LOCATIONS: { key: StorageLocation; label: string; icon: string }[] = [
  { key: 'fridge', label: 'Fridge', icon: '🧊' },
  { key: 'freezer', label: 'Freezer', icon: '❄️' },
  { key: 'pantry', label: 'Pantry', icon: '🗄️' },
  { key: 'counter', label: 'Counter', icon: '🍞' },
];

export default function Pantry() {
  const { pantry, setPantry, ownedIngredientIds, prefs } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newLoc, setNewLoc] = useState<StorageLocation>('fridge');
  const [newExpiry, setNewExpiry] = useState('');

  const expiring = useMemo(
    () => pantry
      .filter((p) => p.expiryDate && daysUntil(p.expiryDate) <= 3)
      .sort((a, b) => daysUntil(a.expiryDate!) - daysUntil(b.expiryDate!)),
    [pantry],
  );
  const expiringIds = useMemo(() => new Set(expiring.map((p) => p.ingredientId)), [expiring]);

  const rescueRecipes = useMemo(() => {
    if (expiringIds.size === 0) return [];
    return recommend({
      ownedIds: ownedIngredientIds,
      expiringIds,
      servings: prefs.householdAdults + prefs.householdKids || 4,
      dietary: prefs.dietary,
      favoriteCuisines: prefs.favoriteCuisines,
      limit: 3,
    }).filter((s) => s.recipe.ingredients.some((i) => expiringIds.has(i.ingredientId)));
  }, [expiringIds, ownedIngredientIds, prefs]);

  const addItem = () => {
    const ing = INGREDIENT_MAP[newId];
    if (!ing || !newQty) return;
    const item: PantryItem = {
      id: uid(),
      ingredientId: newId,
      qty: Number(newQty),
      unit: ing.unit as Unit,
      location: newLoc,
      expiryDate: newExpiry || undefined,
    };
    setPantry((p) => [...p, item]);
    setShowAdd(false);
    setNewId(''); setNewQty(''); setNewExpiry('');
  };

  const removeItem = (id: string) => setPantry((p) => p.filter((x) => x.id !== id));
  const adjustQty = (id: string, delta: number) =>
    setPantry((p) => p.map((x) => x.id === id ? { ...x, qty: Math.max(0, Math.round((x.qty + delta) * 100) / 100) } : x));

  return (
    <div className="container-xl py-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-0">🧊 My Pantry</h1>
          <div className="text-muted small">{pantry.length} items · everything here counts toward recipe matching</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>+ Add item</button>
      </div>

      {showAdd && (
        <div className="card mt-3"><div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold" htmlFor="pi-ing">Ingredient</label>
              <select id="pi-ing" className="form-select" value={newId} onChange={(e) => setNewId(e.target.value)}>
                <option value="">Choose…</option>
                {INGREDIENTS.map((i) => <option key={i.id} value={i.id}>{i.name}{i.nameMs ? ` (${i.nameMs})` : ''}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold" htmlFor="pi-qty">Qty {newId && `(${INGREDIENT_MAP[newId]?.unit})`}</label>
              <input id="pi-qty" type="number" min="0" step="any" className="form-control" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold" htmlFor="pi-loc">Location</label>
              <select id="pi-loc" className="form-select" value={newLoc} onChange={(e) => setNewLoc(e.target.value as StorageLocation)}>
                {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold" htmlFor="pi-exp">Expiry (optional)</label>
              <input id="pi-exp" type="date" className="form-control" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <button className="btn btn-success w-100" onClick={addItem} disabled={!newId || !newQty}>Add</button>
            </div>
          </div>
        </div></div>
      )}

      {expiring.length > 0 && (
        <>
          <SectionHeader title="🚨 Use these first" subtitle="Prioritised by expiry date" />
          <div className="row g-2">
            {expiring.map((p) => {
              const lbl = expiryLabel(p.expiryDate);
              const ing = INGREDIENT_MAP[p.ingredientId];
              return (
                <div className="col-12 col-md-4" key={p.id}>
                  <div className={`card border-${lbl.tone === 'danger' ? 'danger' : 'warning'}`}>
                    <div className="card-body py-2 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{ing?.emoji} {ing?.name}</div>
                        <div className={`small text-${lbl.tone === 'danger' ? 'danger' : 'warning-emphasis'}`}>{lbl.text} · {formatQty(p.qty, p.unit)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {rescueRecipes.length > 0 && (
            <>
              <SectionHeader title="Rescue recipes" subtitle="Designed to use your expiring ingredients" />
              <div className="row g-3">
                {rescueRecipes.map((s) => (
                  <div className="col-12 col-md-6 col-xl-4" key={s.recipe.id}><RecipeCard scored={s} showWhy /></div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {pantry.length === 0 ? (
        <EmptyState icon="🧊" title="Your fridge is empty">
          Add a few ingredients and we'll find something you can cook.
          <div className="mt-2"><button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add your first item</button></div>
        </EmptyState>
      ) : (
        LOCATIONS.map((loc) => {
          const items = pantry.filter((p) => p.location === loc.key);
          if (items.length === 0) return null;
          return (
            <div key={loc.key}>
              <SectionHeader title={`${loc.icon} ${loc.label}`} subtitle={`${items.length} items`} />
              <div className="card">
                <ul className="list-group list-group-flush">
                  {items.map((p) => {
                    const ing = INGREDIENT_MAP[p.ingredientId];
                    const lbl = expiryLabel(p.expiryDate);
                    const step = ['kg', 'L'].includes(p.unit) ? 0.1 : ['g', 'ml'].includes(p.unit) ? 50 : 1;
                    return (
                      <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                          <span className="fw-semibold">{ing?.emoji} {ing?.name ?? p.ingredientId}</span>
                          {p.notes && <span className="text-muted small ms-2">{p.notes}</span>}
                          {lbl.tone !== 'none' && (
                            <span className={`badge ms-2 ${lbl.tone === 'danger' ? 'text-bg-danger' : lbl.tone === 'warning' ? 'text-bg-warning' : 'text-bg-light border'}`}>
                              {lbl.text}
                            </span>
                          )}
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => adjustQty(p.id, -step)} aria-label="Decrease quantity">−</button>
                          <span className="qty-display">{formatQty(p.qty, p.unit)}</span>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => adjustQty(p.id, step)} aria-label="Increase quantity">+</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => removeItem(p.id)} aria-label={`Remove ${ing?.name}`}>🗑</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })
      )}

      <div className="text-center mt-4">
        <Link to="/" className="btn btn-outline-primary">🍳 Cook with what I have →</Link>
      </div>
    </div>
  );
}
