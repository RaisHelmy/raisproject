import { useApp } from '../state/AppContext';
import type { Cuisine, Equipment } from '../types';

const CUISINES: Cuisine[] = ['Malay', 'Chinese', 'Indian', 'Peranakan', 'Kelantan', 'Terengganu', 'Sabah', 'Sarawak', 'Penang', 'Johor', 'Thai', 'Western'];
const DIETARY = [
  { key: 'no-seafood', label: 'No seafood' },
  { key: 'no-beef', label: 'No beef' },
  { key: 'vegetarian', label: 'Vegetarian' },
];
const EQUIPMENT: Equipment[] = ['rice-cooker', 'stove', 'oven', 'air-fryer', 'pan', 'pot', 'wok', 'knife', 'blender', 'grill', 'steamer'];

export default function Settings() {
  const { prefs, setPrefs, resetDemoData } = useApp();

  const toggleIn = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="container-xl py-3" style={{ maxWidth: 820 }}>
      <h1 className="h3">⚙️ Settings</h1>

      <div className="card mt-3"><div className="card-body">
        <h2 className="h6">Household</h2>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <label className="form-label small" htmlFor="adults">Adults</label>
            <input id="adults" type="number" min={0} className="form-control" value={prefs.householdAdults}
              onChange={(e) => setPrefs((p) => ({ ...p, householdAdults: Number(e.target.value) || 0 }))} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small" htmlFor="kids">Children</label>
            <input id="kids" type="number" min={0} className="form-control" value={prefs.householdKids}
              onChange={(e) => setPrefs((p) => ({ ...p, householdKids: Number(e.target.value) || 0 }))} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small" htmlFor="mbudget">Monthly food budget (RM)</label>
            <input id="mbudget" type="number" min={0} className="form-control" value={prefs.monthlyBudget}
              onChange={(e) => setPrefs((p) => ({ ...p, monthlyBudget: Number(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="small text-muted mt-2">Children are counted as ~0.6 of an adult portion when sizing meals.</div>
      </div></div>

      <div className="card mt-3"><div className="card-body">
        <h2 className="h6">Favourite cuisines</h2>
        <div className="d-flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <button key={c}
              className={`btn btn-sm ${prefs.favoriteCuisines.includes(c) ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setPrefs((p) => ({ ...p, favoriteCuisines: toggleIn(p.favoriteCuisines, c) }))}
              aria-pressed={prefs.favoriteCuisines.includes(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="small text-muted mt-2">These boost matching recipes in recommendations.</div>
      </div></div>

      <div className="card mt-3"><div className="card-body">
        <h2 className="h6">Dietary preferences</h2>
        <div className="d-flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <button key={d.key}
              className={`btn btn-sm ${prefs.dietary.includes(d.key) ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setPrefs((p) => ({ ...p, dietary: toggleIn(p.dietary, d.key) }))}
              aria-pressed={prefs.dietary.includes(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="small text-muted mt-2">
          These are <b>your preferences</b>, used to filter recipes — they are not verified dietary or halal certification of any dish or restaurant.
        </div>
      </div></div>

      <div className="card mt-3"><div className="card-body">
        <h2 className="h6">Kitchen equipment</h2>
        <div className="d-flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <button key={e}
              className={`btn btn-sm ${prefs.equipment.includes(e) ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setPrefs((p) => ({ ...p, equipment: toggleIn(p.equipment, e) }))}
              aria-pressed={prefs.equipment.includes(e)}>
              {e}
            </button>
          ))}
        </div>
      </div></div>

      <div className="card mt-3 border-danger-subtle"><div className="card-body">
        <h2 className="h6">Data</h2>
        <p className="small text-muted mb-2">
          Everything is stored locally in your browser. This app runs on demo data — prices are local estimates, not live feeds.
        </p>
        <button className="btn btn-outline-danger btn-sm" onClick={() => { if (confirm('Reset pantry, shopping list, meal plan and history to demo defaults?')) resetDemoData(); }}>
          Reset demo data
        </button>
      </div></div>
    </div>
  );
}
