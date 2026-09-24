import { useEffect, useMemo, useState } from "react";
import type { Point } from "highcharts";
import { formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { baseChartOptions, ringgitAxis } from "./chartTheme";
import { Chart } from "./Chart";

interface Breakdown {
  key: string;
  label: string;
  count: number;
  spentSen: number;
}

interface UsageSummary {
  totalSpentSen: number;
  todaySpentSen: number;
  monthSpentSen: number;
  generations: number;
  workflowRuns: number;
  failureRate: number;
  daily: { day: string; generations: number; spentSen: number }[];
  byModel: Breakdown[];
  byCategory: Breakdown[];
  byProject: Breakdown[];
  currency: string;
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function UsagePage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const dark = useMemo(
    () => document.documentElement.getAttribute("data-bs-theme") !== "light",
    [],
  );

  useEffect(() => {
    setSummary(null);
    api<UsageSummary>(`/usage?days=${days}`)
      .then(setSummary)
      .catch(() => setFailed(true));
  }, [days]);

  if (failed) {
    return (
      <section>
        <p className="lp-eyebrow mb-2">Governance</p><h1 className="display-6 fw-bold mb-3">Usage</h1>
        <div className="alert alert-danger" role="alert">Usage could not be loaded.</div>
      </section>
    );
  }

  const base = baseChartOptions(dark);
  const hasSpend = (summary?.generations ?? 0) > 0;

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div><p className="lp-eyebrow mb-2">Governance</p><h1 className="display-6 fw-bold mb-0">Usage</h1></div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={`btn ${days === range.days ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {summary === null && <p className="text-secondary">Loading…</p>}

      {summary && !hasSpend && (
        <EmptyState
          icon="bar-chart"
          title="Nothing to chart yet."
          description="Once you generate something, your spending shows up here."
        />
      )}

      {summary && hasSpend && (
        <>
          <div className="row g-3 mb-4">
            <Stat label="Spent today" value={formatMYR(summary.todaySpentSen)} />
            <Stat label="This month" value={formatMYR(summary.monthSpentSen)} />
            <Stat label="Total spent" value={formatMYR(summary.totalSpentSen)} />
            <Stat label="Generations" value={String(summary.generations)} note={`${summary.workflowRuns} canvas runs`} />
          </div>

          {summary.failureRate > 0.1 && (
            <div className="alert alert-warning" role="alert">
              {Math.round(summary.failureRate * 100)}% of generations failed. Check History for the reasons.
            </div>
          )}

          <div className="row g-3">
            <div className="col-lg-8">
              <ChartCard title="Daily spending">
                <Chart
                  title="Daily spending in ringgit"
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "column", height: 260 },
                    xAxis: { ...base.xAxis, categories: summary.daily.map((d) => d.day.slice(5)) },
                    yAxis: ringgitAxis(base),
                    tooltip: { ...base.tooltip, pointFormatter(this: Point) {
                      return `<b>${formatMYR(Number(this.y) * 100)}</b>`;
                    } },
                    series: [{ type: "column", name: "Spent", data: summary.daily.map((d) => d.spentSen / 100) }],
                  }}
                />
              </ChartCard>
            </div>

            <div className="col-lg-4">
              <ChartCard title="Where it went">
                <Chart
                  title="Spending by category"
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "pie", height: 260 },
                    tooltip: { ...base.tooltip, pointFormatter(this: Point) {
                      return `<b>${formatMYR(Number(this.y) * 100)}</b>`;
                    } },
                    series: [
                      {
                        type: "pie",
                        name: "Spent",
                        innerSize: "55%",
                        data: summary.byCategory.map((c) => ({ name: c.label, y: c.spentSen / 100 })),
                      },
                    ],
                  }}
                />
              </ChartCard>
            </div>

            <div className="col-lg-6">
              <ChartCard title="Generations per day">
                <Chart
                  title="Generations per day"
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "areaspline", height: 240 },
                    xAxis: { ...base.xAxis, categories: summary.daily.map((d) => d.day.slice(5)) },
                    series: [{ type: "areaspline", name: "Generations", data: summary.daily.map((d) => d.generations) }],
                  }}
                />
              </ChartCard>
            </div>

            <div className="col-lg-6">
              <ChartCard title="Most-used models">
                <Chart
                  title="Spending by model"
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "bar", height: 240 },
                    xAxis: { ...base.xAxis, categories: summary.byModel.map((m) => m.label) },
                    yAxis: ringgitAxis(base),
                    series: [{ type: "bar", name: "Spent", data: summary.byModel.map((m) => m.spentSen / 100) }],
                  }}
                />
              </ChartCard>
            </div>
          </div>

          {summary.byProject.length > 0 && (
            <div className="card mt-3">
              <div className="card-body">
                <h2 className="h6 mb-3">Spending by project</h2>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <caption className="visually-hidden">Spending by project</caption>
                    <thead>
                      <tr>
                        <th scope="col">Project</th>
                        <th scope="col" className="text-end">Generations</th>
                        <th scope="col" className="text-end">Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byProject.map((project) => (
                        <tr key={project.key}>
                          <td>{project.label}</td>
                          <td className="text-end">{project.count}</td>
                          <td className="text-end">{formatMYR(project.spentSen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat(props: { label: string; value: string; note?: string }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card h-100">
        <div className="card-body">
          <p className="text-secondary small mb-1">{props.label}</p>
          <p className="h4 mb-0">{props.value}</p>
          {props.note && <p className="text-secondary small mb-0">{props.note}</p>}
        </div>
      </div>
    </div>
  );
}

function ChartCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <h2 className="h6 mb-2">{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}
