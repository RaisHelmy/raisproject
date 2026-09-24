import { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { RECIPES, RECIPE_MAP } from '../data/recipes';
import { estimateCost, eatOutEstimate } from '../services/cost';
import { formatRM, formatRMRange } from '../utils/format';

export default function Compare() {
  const [recipeId, setRecipeId] = useState('nasi-lemak');
  const [people, setPeople] = useState(5);

  const recipe = RECIPE_MAP[recipeId];
  const cost = useMemo(() => estimateCost(recipe, people), [recipe, people]);
  const out = eatOutEstimate(people);
  const delivery = { low: out.low * 1.3 + 5, high: out.high * 1.35 + 8 };
  const savings = out.mid - cost.total;

  const chartOptions: Highcharts.Options = {
    chart: { type: 'column', height: 300, backgroundColor: 'transparent' },
    title: { text: undefined }, credits: { enabled: false },
    xAxis: { categories: ['Cook at home', 'Restaurant', 'Delivery'] },
    yAxis: { title: { text: `RM for ${people} people` } },
    legend: { enabled: false },
    tooltip: { pointFormat: '<b>RM{point.y:.2f}</b>' },
    series: [{
      type: 'column',
      name: 'Cost',
      data: [
        { y: cost.total, color: '#2f9e44' },
        { y: out.mid, color: '#e8590c' },
        { y: (delivery.low + delivery.high) / 2, color: '#c92a2a' },
      ],
    }],
  };

  return (
    <div className="container-xl py-3">
      <h1 className="h3">⚖️ Cook vs Buy</h1>
      <p className="text-muted">See exactly what cooking at home saves you tonight.</p>

      <div className="card"><div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="cmpRecipe">Dish</label>
            <select id="cmpRecipe" className="form-select" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              {RECIPES.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.title}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold" htmlFor="cmpPeople">People</label>
            <input id="cmpPeople" type="number" min={1} max={50} className="form-control" value={people}
              onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
      </div></div>

      <div className="row g-3 mt-1">
        <div className="col-12 col-lg-6">
          <div className="card h-100"><div className="card-body">
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          </div></div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100"><div className="card-body">
            <div className="compare-row"><div>🏠 Cook at home ({recipe.title})</div><div className="fw-bold text-success">{formatRM(cost.total)}</div></div>
            <div className="compare-row small text-muted"><div>Per person</div><div>{formatRM(cost.perServing)}</div></div>
            <div className="compare-row mt-2"><div>🍽️ Restaurant (est.)</div><div className="fw-bold">{formatRMRange(out.low, out.high)}</div></div>
            <div className="compare-row small text-muted"><div>Per person</div><div>{formatRMRange(out.low / people, out.high / people)}</div></div>
            <div className="compare-row mt-2"><div>🛵 Delivery (est. incl. fees)</div><div className="fw-bold">{formatRMRange(delivery.low, delivery.high)}</div></div>
            <div className={`alert ${savings > 0 ? 'alert-success' : 'alert-secondary'} mt-3 mb-0`}>
              {savings > 0
                ? <>💰 You save approximately <b>{formatRM(savings)}</b> by cooking — that's {formatRM(savings / people)} per person.</>
                : <>For {people} people this dish costs about the same either way.</>}
            </div>
            <div className="small text-muted mt-2">
              Estimates use demo local prices ({cost.confidence.toLowerCase()} confidence) and typical Malaysian restaurant pricing. Cooking gas/electricity (~RM1–2/meal) not included.
            </div>
          </div></div>
        </div>
      </div>
    </div>
  );
}
