import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { CATEGORY_LABELS } from '../services/shopping';
import { GROCERY_STORES } from '../data/travel';
import { INGREDIENTS, INGREDIENT_MAP } from '../data/ingredients';
import { formatRM, formatQty, uid } from '../utils/format';
import type { ShoppingListItem } from '../types';
import EmptyState from '../components/EmptyState';

export default function Shopping() {
  const { shopping, setShopping } = useApp();
  const [manualId, setManualId] = useState('');

  const groups = useMemo(() => {
    const g = new Map<string, ShoppingListItem[]>();
    for (const item of shopping) {
      const arr = g.get(item.category) ?? [];
      arr.push(item);
      g.set(item.category, arr);
    }
    return g;
  }, [shopping]);

  const totals = useMemo(() => {
    const toBuy = shopping.filter((i) => !i.owned);
    return {
      count: toBuy.length,
      checked: toBuy.filter((i) => i.checked).length,
      cost: toBuy.reduce((s, i) => s + (i.estimatedCost ?? 0), 0),
    };
  }, [shopping]);

  const toggle = (id: string) => setShopping((s) => s.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
  const toggleOwned = (id: string) => setShopping((s) => s.map((i) => i.id === id ? { ...i, owned: !i.owned } : i));
  const remove = (id: string) => setShopping((s) => s.filter((i) => i.id !== id));
  const clearChecked = () => setShopping((s) => s.filter((i) => !i.checked));

  const addManual = () => {
    const ing = INGREDIENT_MAP[manualId];
    if (!ing) return;
    setShopping((s) => [...s, {
      id: uid(), name: ing.name, ingredientId: ing.id, qty: 1, unit: ing.unit,
      category: ing.category, checked: false, owned: false,
      estimatedCost: ing.pricePerUnit, fromRecipes: ['Added manually'],
    }]);
    setManualId('');
  };

  return (
    <div className="container-xl py-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-0">🛒 Shopping List</h1>
          <div className="text-muted small">
            {totals.count > 0
              ? <>{totals.checked}/{totals.count} picked up · estimated total <b>{formatRM(totals.cost)}</b></>
              : 'Add missing ingredients from any recipe page'}
          </div>
        </div>
        {shopping.some((i) => i.checked) && (
          <button className="btn btn-outline-secondary btn-sm" onClick={clearChecked}>Clear checked</button>
        )}
      </div>

      <div className="card mt-3"><div className="card-body py-2">
        <div className="row g-2 align-items-center">
          <div className="col">
            <select className="form-select form-select-sm" value={manualId} onChange={(e) => setManualId(e.target.value)} aria-label="Add ingredient manually">
              <option value="">+ Add item manually…</option>
              {INGREDIENTS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-sm btn-primary" onClick={addManual} disabled={!manualId}>Add</button>
          </div>
        </div>
      </div></div>

      {shopping.length === 0 ? (
        <EmptyState icon="🛒" title="Your list is empty">
          Open a recipe and tap <b>“Add missing to list”</b> — quantities from multiple recipes get combined automatically.
          <div className="mt-2"><Link to="/discover" className="btn btn-primary btn-sm">Browse recipes</Link></div>
        </EmptyState>
      ) : (
        <>
          {[...groups.entries()].map(([cat, items]) => (
            <div key={cat} className="mt-3">
              <h2 className="h6 text-muted">{CATEGORY_LABELS[cat] ?? cat}</h2>
              <div className="card">
                <ul className="list-group list-group-flush">
                  {items.map((i) => (
                    <li key={i.id} className={`list-group-item d-flex align-items-center gap-2 ${i.checked ? 'item-checked' : ''} ${i.owned ? 'item-owned' : ''}`}>
                      <input
                        className="form-check-input mt-0 flex-shrink-0"
                        type="checkbox" checked={i.checked} onChange={() => toggle(i.id)}
                        aria-label={`Mark ${i.name} as bought`} disabled={i.owned}
                      />
                      <div className="flex-grow-1">
                        <div className={i.checked ? 'text-decoration-line-through text-muted' : ''}>
                          <b>{i.name}</b> · {formatQty(i.qty, i.unit)}
                          {i.owned && <span className="badge text-bg-success ms-2">already have</span>}
                        </div>
                        <div className="small text-muted">
                          {i.fromRecipes.length > 1 ? `Combined from ${i.fromRecipes.length} recipes` : i.fromRecipes[0]}
                          {i.packSuggestion && <span className="text-primary"> · 💡 {i.packSuggestion}</span>}
                        </div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        {!i.owned && i.estimatedCost != null && <div className="fw-semibold small">{formatRM(i.estimatedCost)}</div>}
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => toggleOwned(i.id)} title="Toggle already owned">🏠</button>
                          <button className="btn btn-sm btn-outline-danger py-0" onClick={() => remove(i.id)} aria-label={`Delete ${i.name}`}>×</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          <div className="card mt-4"><div className="card-body">
            <h2 className="h6">🏪 Where to buy cheaper</h2>
            <div className="d-flex flex-wrap gap-2">
              {GROCERY_STORES.map((s) => (
                <span key={s.id} className="badge text-bg-light border">
                  {s.name} {'💲'.repeat(s.priceLevel)}
                </span>
              ))}
            </div>
            <div className="small text-muted mt-2">💲 = cheapest tier. Wet markets usually beat supermarkets for vegetables and fish. (Demo guidance, not live prices.)</div>
          </div></div>
        </>
      )}
    </div>
  );
}
