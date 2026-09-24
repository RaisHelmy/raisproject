import { useMemo, useState } from 'react';
import { INGREDIENTS, INGREDIENT_MAP } from '../data/ingredients';

const QUICK_PICKS = ['chicken-whole', 'egg', 'rice', 'onion', 'garlic', 'carrot', 'prawn', 'spinach', 'coconut-milk', 'yellow-noodles'];

export default function IngredientPicker({
  selected, onChange,
}: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INGREDIENTS
      .filter((i) =>
        !selected.includes(i.id) &&
        (i.name.toLowerCase().includes(q) || i.nameMs?.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [query, selected]);

  const add = (id: string) => {
    if (!selected.includes(id)) onChange([...selected, id]);
    setQuery('');
  };
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <div>
      {selected.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {selected.map((id) => (
            <span key={id} className="ing-chip">
              {INGREDIENT_MAP[id]?.emoji} {INGREDIENT_MAP[id]?.name ?? id}
              <button className="chip-x" onClick={() => remove(id)} aria-label={`Remove ${INGREDIENT_MAP[id]?.name}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="position-relative">
        <input
          className="form-control"
          placeholder="Search ingredients… (e.g. ayam, santan, egg)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Add ingredient"
        />
        {matches.length > 0 && (
          <div className="list-group position-absolute w-100 shadow-sm search-dropdown">
            {matches.map((m) => (
              <button key={m.id} className="list-group-item list-group-item-action" onClick={() => add(m.id)}>
                {m.emoji} {m.name} {m.nameMs && <span className="text-muted small">· {m.nameMs}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="d-flex flex-wrap gap-1 mt-2">
        {QUICK_PICKS.filter((id) => !selected.includes(id)).map((id) => (
          <button key={id} className="btn btn-sm btn-outline-secondary" onClick={() => add(id)}>
            + {INGREDIENT_MAP[id]?.name}
          </button>
        ))}
      </div>
    </div>
  );
}
