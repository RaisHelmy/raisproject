import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, PRESETS, type Alias, type Model, type Project, type Preset } from "../api";
import { KeyReveal } from "../components/KeyReveal";

export function CreateCredential() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<{ models: Model[]; aliases: Alias[] }>({ models: [], aliases: [] });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ key: string; model: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(params.get("project") ?? "");
  const [newProjectName, setNewProjectName] = useState("");
  const [preset, setPreset] = useState<Preset>(PRESETS[1]!);
  const [daily, setDaily] = useState<string>("2");
  const [weekly, setWeekly] = useState<string>("10");
  const [monthly, setMonthly] = useState<string>("30");
  const [onLimit, setOnLimit] = useState<"block" | "fallback">("fallback");
  const [allowed, setAllowed] = useState<string[]>(PRESETS[1]!.allowed);
  const [defaultModel, setDefaultModel] = useState(PRESETS[1]!.default_model);
  const [fallback, setFallback] = useState<string>(PRESETS[1]!.fallback ?? "");
  const [rpm, setRpm] = useState<string>("60");
  const [expiry, setExpiry] = useState<"never" | "30" | "90" | "custom">("never");
  const [customExpiry, setCustomExpiry] = useState("");

  useEffect(() => {
    api<Project[]>("/projects").then((p) => { setProjects(p); if (!projectId && p[0]) setProjectId(p[0].id); });
    api("/catalog").then(setCatalog);
  }, []);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    setDaily(p.daily?.toString() ?? ""); setWeekly(p.weekly?.toString() ?? ""); setMonthly(p.monthly?.toString() ?? "");
    setOnLimit(p.on_limit); setAllowed(p.allowed); setDefaultModel(p.default_model); setFallback(p.fallback ?? ""); setRpm(p.rpm?.toString() ?? "");
  };

  const options = useMemo(() => [
    ...catalog.aliases.map((a) => ({ id: a.name, label: `${a.name} — ${a.description}`, kind: "alias" as const })),
    ...catalog.models.filter((m) => m.enabled).map((m) => ({ id: m.id, label: `${m.display_name} (${m.id})`, kind: "model" as const })),
  ], [catalog]);

  const toggle = (id: string) => setAllowed((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      let pid = projectId;
      if (pid === "__new") {
        if (!newProjectName.trim()) throw new Error("Give the new project a name.");
        const p = await api<Project>("/projects", { method: "POST", json: { name: newProjectName.trim() } });
        pid = p.id;
      }
      if (!pid) throw new Error("Choose a project.");
      if (!name.trim()) throw new Error("Give the credential a name.");
      let expires_at: number | null = null;
      if (expiry === "30" || expiry === "90") expires_at = Math.floor(Date.now() / 1000) + Number(expiry) * 86400;
      if (expiry === "custom") { if (!customExpiry) throw new Error("Pick an expiry date."); expires_at = Math.floor(new Date(customExpiry).getTime() / 1000); }
      const r = await api<{ key: string; credential: { id: string; default_model: string } }>("/keys", {
        method: "POST",
        json: { project_id: pid, name: name.trim(), daily_usd: daily || null, weekly_usd: weekly || null, monthly_usd: monthly || null, on_limit: onLimit, allowed_models: allowed, default_model: defaultModel, fallback_model: fallback || null, requests_per_minute: rpm ? Number(rpm) : null, expires_at, preset: preset.id },
      });
      setCreated({ key: r.key, model: r.credential.default_model, id: r.credential.id });
      window.scrollTo(0, 0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (created) {
    return (
      <>
        <h3>Credential created</h3>
        <KeyReveal apiKey={created.key} model={created.model} />
        <Link className="btn btn-outline-secondary" to={`/credentials/${created.id}`}>Open credential</Link> <Link className="btn btn-link" to="/">Dashboard</Link>
      </>
    );
  }

  const sectionTitle = (t: string) => <div className="text-secondary small fw-bold text-uppercase mt-4 mb-2 border-bottom border-secondary-subtle pb-1">{t}</div>;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <h3>Create AI credential</h3>
        <p className="text-secondary small">Each app gets its own key, budget and model permissions. Apps talk plain OpenAI API to <code>{location.origin}/v1</code> and never see the real Cloudflare or provider keys.</p>
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="card"><div className="card-body">
          <label className="form-label">Name</label>
          <input className="form-control" placeholder="e.g. OpenHands production" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="form-label mt-3">Project</label>
          <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New project…</option>
          </select>
          {projectId === "__new" && <input className="form-control mt-2" placeholder="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />}

          {sectionTitle("Preset")}
          <div className="row g-2">
            {PRESETS.map((p) => (
              <div className="col-md-6" key={p.id}>
                <label className={`border rounded p-2 d-block h-100 ${preset.id === p.id ? "border-success" : "border-secondary-subtle"}`} style={{ cursor: "pointer" }}>
                  <input type="radio" className="form-check-input me-2" checked={preset.id === p.id} onChange={() => applyPreset(p)} />
                  <strong>{p.name}</strong>
                  <div className="small text-secondary">{p.blurb}</div>
                </label>
              </div>
            ))}
          </div>

          {sectionTitle("Budget (USD)")}
          <div className="row g-2">
            {([["Daily", daily, setDaily], ["Weekly", weekly, setWeekly], ["Monthly", monthly, setMonthly]] as const).map(([l, v, set]) => (
              <div className="col-md-4" key={l}>
                <label className="form-label small">{l}</label>
                <div className="input-group"><span className="input-group-text">$</span><input type="number" min="0" step="0.5" className="form-control" placeholder="no cap" value={v} onChange={(e) => set(e.target.value)} /></div>
              </div>
            ))}
          </div>
          <div className="mt-2 small">
            <div className="form-check form-check-inline"><input className="form-check-input" type="radio" id="ol-block" checked={onLimit === "block"} onChange={() => setOnLimit("block")} /><label className="form-check-label" htmlFor="ol-block">When limit reached: block requests (HTTP 429)</label></div>
            <div className="form-check form-check-inline"><input className="form-check-input" type="radio" id="ol-fb" checked={onLimit === "fallback"} onChange={() => setOnLimit("fallback")} /><label className="form-check-label" htmlFor="ol-fb">Use cheaper fallback model</label></div>
          </div>

          {sectionTitle("Models")}
          <div className="small text-secondary mb-2">Tick what this credential may use. Nothing ticked = everything enabled in the catalog.</div>
          <div className="row">
            {options.map((o) => (
              <div className="col-md-6" key={o.id}>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id={`m-${o.id}`} checked={allowed.includes(o.id)} onChange={() => toggle(o.id)} />
                  <label className="form-check-label small" htmlFor={`m-${o.id}`}>{o.kind === "alias" ? <code>{o.id}</code> : o.label}{o.kind === "alias" && <span className="text-secondary"> — {o.label.split(" — ")[1]}</span>}</label>
                </div>
              </div>
            ))}
          </div>
          <div className="row g-2 mt-1">
            <div className="col-md-6">
              <label className="form-label small">Default model (when the app sends none)</label>
              <select className="form-select" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}</select>
            </div>
            <div className="col-md-6">
              <label className="form-label small">Fallback when budget hit (if "cheaper fallback" chosen)</label>
              <select className="form-select" value={fallback} onChange={(e) => setFallback(e.target.value)}><option value="">— none —</option>{options.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}</select>
            </div>
          </div>

          {sectionTitle("Rate limit")}
          <div className="col-md-4">
            <label className="form-label small">Requests / minute</label>
            <input type="number" min="1" className="form-control" placeholder="unlimited" value={rpm} onChange={(e) => setRpm(e.target.value)} />
          </div>

          {sectionTitle("Expiry")}
          <div className="d-flex gap-3 flex-wrap small">
            {([["never", "Never"], ["30", "30 days"], ["90", "90 days"], ["custom", "Custom"]] as const).map(([v, l]) => (
              <div className="form-check" key={v}><input className="form-check-input" type="radio" id={`ex-${v}`} checked={expiry === v} onChange={() => setExpiry(v)} /><label className="form-check-label" htmlFor={`ex-${v}`}>{l}</label></div>
            ))}
            {expiry === "custom" && <input type="date" className="form-control form-control-sm w-auto" value={customExpiry} onChange={(e) => setCustomExpiry(e.target.value)} />}
          </div>

          <div className="d-flex justify-content-end mt-4 gap-2">
            <Link className="btn btn-outline-secondary" to="/">Cancel</Link>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create credential"}</button>
          </div>
        </div></div>
      </div>
    </div>
  );
}
