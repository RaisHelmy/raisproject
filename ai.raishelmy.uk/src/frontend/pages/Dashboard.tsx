import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, type Overview, type Credential } from "../api";
import { BudgetBar } from "../components/BudgetBar";

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");
  const load = () => api<Overview>("/overview").then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <div className="text-secondary">Loading…</div>;

  const g = data.global;
  const addProject = async () => {
    if (!newProject.trim()) return;
    await api("/projects", { method: "POST", json: { name: newProject.trim() } });
    setNewProject(""); load();
  };
  const remaining = g.budget.month !== null ? g.budget.month - g.spend.month : null;

  return (
    <>
      <div className="d-flex justify-content-between align-items-end mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-0">Total spend</h3>
          <div className="text-secondary small">Windows in {data.timezone}. Estimates from the model price list; Cloudflare's figure is synced onto each request when available.</div>
        </div>
        <Link className="btn btn-primary" to="/credentials/new">+ Create credential</Link>
      </div>

      <div className="row g-3 mb-4">
        {([["Today", "day"], ["This week", "week"], ["This month", "month"]] as const).map(([label, k]) => (
          <div className="col-md-4" key={k}>
            <div className="card h-100"><div className="card-body">
              <div className="text-secondary small">{label}</div>
              <div className="stat">{money(g.spend[k])} <small>/ {g.budget[k] !== null ? money(g.budget[k]) : "no cap"}</small></div>
              <BudgetBar label="" spent={g.spend[k]} limit={g.budget[k]} />
              {k === "month" && remaining !== null && <div className="small text-secondary">Remaining {money(remaining)}</div>}
            </div></div>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Projects</h5>
        <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
          <input className="form-control" placeholder="New project name" value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} />
          <button className="btn btn-outline-secondary" onClick={addProject}>Add</button>
        </div>
      </div>

      {data.projects.length === 0 && <div className="card"><div className="card-body text-secondary">No projects yet. Add one above, then create a credential for it.</div></div>}

      {data.projects.map((p) => (
        <div className="card mb-3" key={p.id}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-0">{p.name} <span className="badge text-bg-secondary badge-provider ms-1 mono">{p.slug}</span></h5>
                {p.description && <div className="text-secondary small">{p.description}</div>}
              </div>
              <div className="text-end">
                <div className="small text-secondary">This month</div>
                <div className="fw-bold">{money(p.month_spend)}</div>
              </div>
            </div>
            {(p.keys ?? []).length === 0 ? (
              <div className="text-secondary small mt-2">No credentials. <Link to={`/credentials/new?project=${p.id}`}>Create one</Link>.</div>
            ) : (
              <div className="mt-3 d-flex flex-column gap-3">
                {(p.keys ?? []).map((k) => <KeyCard key={k.id} k={k} />)}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="text-secondary small mt-4">Last Cloudflare cost sync: {data.last_cost_sync ? new Date(data.last_cost_sync * 1000).toLocaleString() : "never (set CLOUDFLARE_API_TOKEN)"} · <Link to="/settings">Settings</Link></div>
    </>
  );
}

function KeyCard({ k }: { k: Credential }) {
  const status = !k.enabled ? ["Disabled", "text-bg-secondary"] : k.expires_at && k.expires_at * 1000 < Date.now() ? ["Expired", "text-bg-danger"] : ["Active", "text-bg-success"];
  return (
    <div className="border border-secondary-subtle rounded p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div><strong>{k.name}</strong> <span className={`badge ${status[1]} ms-1`}>{status[0]}</span> <span className="badge text-bg-dark ms-1">{k.preset}</span></div>
        <div className="small text-secondary">{k.requests_month} req this month</div>
      </div>
      <div className="row">
        <div className="col-md-4"><BudgetBar label="Today" spent={k.spend.day} limit={k.daily_usd} /></div>
        <div className="col-md-4"><BudgetBar label="Week" spent={k.spend.week} limit={k.weekly_usd} /></div>
        <div className="col-md-4"><BudgetBar label="Month" spent={k.spend.month} limit={k.monthly_usd} /></div>
      </div>
      <div className="d-flex justify-content-between align-items-center mt-1 flex-wrap gap-2">
        <span className="mono text-secondary">{k.masked}</span>
        <div className="d-flex gap-2">
          <span className="small text-secondary align-self-center">default <code>{k.default_model}</code></span>
          <Link className="btn btn-sm btn-outline-secondary" to={`/credentials/${k.id}`}>Manage</Link>
        </div>
      </div>
    </div>
  );
}
