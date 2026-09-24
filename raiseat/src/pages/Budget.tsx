import { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { useApp } from '../state/AppContext';
import { optimizeStrategies } from '../services/recommend';
import { formatRM } from '../utils/format';
import RecipeCard from '../components/RecipeCard';
import SectionHeader from '../components/SectionHeader';

export default function Budget() {
  const { prefs, setPrefs, ownedIngredientIds } = useApp();
  const [optBudget, setOptBudget] = useState(20);
  const [optPeople, setOptPeople] = useState(6);
  const [showStrategies, setShowStrategies] = useState(false);

  const monthly = prefs.monthlyBudget;
  const daysIn = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();

  // Demo spending model: deterministic pseudo-random daily spend around budget pace.
  const spendSeries = useMemo(() => {
    const daily = monthly / daysIn;
    const out: number[] = [];
    let acc = 0;
    for (let d = 1; d <= dayOfMonth; d++) {
      const wobble = 0.55 + ((d * 7919) % 100) / 100 * 0.9; // 0.55–1.45
      acc += daily * wobble * 0.92;
      out.push(Math.round(acc));
    }
    return out;
  }, [monthly, daysIn, dayOfMonth]);

  const used = spendSeries[spendSeries.length - 1] ?? 0;
  const projected = Math.round((used / dayOfMonth) * daysIn);
  const remaining = monthly - used;

  const allocation = [
    { name: 'Breakfast', y: monthly * 0.2 },
    { name: 'Lunch', y: monthly * 0.33 },
    { name: 'Dinner', y: monthly * 0.37 },
    { name: 'Snacks', y: monthly * 0.07 },
    { name: 'Buffer', y: monthly * 0.03 },
  ];

  const trendOptions: Highcharts.Options = {
    chart: { type: 'area', height: 280, backgroundColor: 'transparent' },
    title: { text: undefined }, credits: { enabled: false },
    xAxis: { title: { text: 'Day of month' }, allowDecimals: false },
    yAxis: { title: { text: 'RM' }, plotLines: [{ value: monthly, color: '#dc3545', dashStyle: 'Dash', label: { text: 'Budget' } }] },
    tooltip: { pointFormat: 'Spent so far: <b>RM{point.y}</b>' },
    series: [{ type: 'area', name: 'Cumulative spend (demo)', data: spendSeries.map((v, i) => [i + 1, v]), color: '#e8590c', fillOpacity: 0.15 }],
  };

  const allocOptions: Highcharts.Options = {
    chart: { type: 'bar', height: 280, backgroundColor: 'transparent' },
    title: { text: undefined }, credits: { enabled: false },
    xAxis: { categories: allocation.map((a) => a.name) },
    yAxis: { title: { text: 'RM / month' } },
    legend: { enabled: false },
    tooltip: { pointFormat: '<b>RM{point.y:.0f}</b>' },
    series: [{ type: 'bar', name: 'Suggested', data: allocation.map((a) => Math.round(a.y)), color: '#2f9e44' }],
  };

  const strategies = useMemo(
    () => showStrategies
      ? optimizeStrategies({ ownedIds: ownedIngredientIds, budget: optBudget, servings: optPeople, dietary: prefs.dietary, favoriteCuisines: prefs.favoriteCuisines })
      : [],
    [showStrategies, ownedIngredientIds, optBudget, optPeople, prefs],
  );

  return (
    <div className="container-xl py-3">
      <h1 className="h3">💰 Food Budget</h1>
      <p className="text-muted">Track your month and squeeze the most out of every ringgit. <span className="badge text-bg-light border">Demo data</span></p>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card h-100"><div className="card-body">
            <label className="form-label fw-semibold" htmlFor="mb">Monthly food budget</label>
            <div className="input-group mb-3">
              <span className="input-group-text">RM</span>
              <input id="mb" type="number" className="form-control" value={monthly}
                onChange={(e) => setPrefs((p) => ({ ...p, monthlyBudget: Number(e.target.value) || 0 }))} />
            </div>
            <div className="budget-stat"><span className="text-muted">Used so far</span><b>{formatRM(used)}</b></div>
            <div className="progress my-2" style={{ height: 10 }} role="progressbar" aria-label="Budget used"
              aria-valuenow={Math.round((used / monthly) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`progress-bar ${used / monthly > 0.9 ? 'bg-danger' : 'bg-success'}`} style={{ width: `${Math.min(100, (used / monthly) * 100)}%` }} />
            </div>
            <div className="budget-stat"><span className="text-muted">Remaining</span><b className={remaining < 0 ? 'text-danger' : ''}>{formatRM(remaining)}</b></div>
            <div className="budget-stat"><span className="text-muted">Projected month-end</span>
              <b className={projected > monthly ? 'text-danger' : 'text-success'}>{formatRM(projected)}</b></div>
            <hr />
            <div className="small text-muted">
              💡 Cooking dinner at home 5×/week typically saves a household of {prefs.householdAdults + prefs.householdKids || 2} around <b>RM300–450/month</b> vs eating out.
            </div>
          </div></div>
        </div>
        <div className="col-12 col-lg-8">
          <div className="card h-100"><div className="card-body">
            <h2 className="h6">Spending this month (demo)</h2>
            <HighchartsReact highcharts={Highcharts} options={trendOptions} />
          </div></div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100"><div className="card-body">
            <h2 className="h6">Suggested allocation</h2>
            <HighchartsReact highcharts={Highcharts} options={allocOptions} />
          </div></div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100"><div className="card-body">
            <h2 className="h6">🎯 Budget optimizer</h2>
            <p className="small text-muted">"I have RM{optBudget}. Feed {optPeople} people." — get four strategies.</p>
            <div className="row g-2 align-items-end">
              <div className="col-5">
                <label className="form-label small" htmlFor="ob">Budget</label>
                <div className="input-group">
                  <span className="input-group-text">RM</span>
                  <input id="ob" type="number" min={5} className="form-control" value={optBudget} onChange={(e) => setOptBudget(Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="col-4">
                <label className="form-label small" htmlFor="op">People</label>
                <input id="op" type="number" min={1} className="form-control" value={optPeople} onChange={(e) => setOptPeople(Number(e.target.value) || 1)} />
              </div>
              <div className="col-3">
                <button className="btn btn-primary w-100" onClick={() => setShowStrategies(true)}>Optimize</button>
              </div>
            </div>
            {showStrategies && strategies.length > 0 && (
              <ul className="list-group list-group-flush mt-3">
                {strategies.map((s) => (
                  <li key={s.label} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                    <div>
                      <b>{s.icon} {s.label}</b> — {s.pick.recipe.title}
                      <div className="small text-muted">{s.blurb}</div>
                    </div>
                    <div className="text-end">
                      <div className={`fw-semibold ${s.pick.cost.total <= optBudget ? 'text-success' : 'text-danger'}`}>{formatRM(s.pick.cost.total)}</div>
                      <div className="tiny text-muted">{formatRM(s.pick.cost.total / optPeople)}/person</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div></div>
        </div>
      </div>

      {showStrategies && strategies.length > 0 && (
        <>
          <SectionHeader title="Optimizer picks in detail" />
          <div className="row g-3">
            {strategies.map((s) => (
              <div className="col-12 col-md-6 col-xl-3" key={s.pick.recipe.id}>
                <div className="strategy-tag">{s.icon} {s.label}</div>
                <RecipeCard scored={{ ...s.pick, servings: optPeople }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
