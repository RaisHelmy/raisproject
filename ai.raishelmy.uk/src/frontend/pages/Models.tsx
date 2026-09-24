import { useEffect, useState } from "react";
import { api, type Alias, type Model } from "../api";

export function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [newModel, setNewModel] = useState({ id: "", display_name: "", input: "", output: "" });
  const [newAlias, setNewAlias] = useState({ name: "", description: "", candidates: "" });
  const load = () => api("/catalog").then((c) => { setModels(c.models); setAliases(c.aliases); });
  useEffect(() => { load(); }, []);

  const saveModel = async (m: Model) => { await api(`/models/${encodeURIComponent(m.id)}`, { method: "PUT", json: { ...m, enabled: !!m.enabled } }); setMsg(`Saved ${m.id}`); load(); };
  const delModel = async (id: string) => { if (confirm(`Remove ${id} from the catalog?`)) { await api(`/models/${encodeURIComponent(id)}`, { method: "DELETE" }); load(); } };
  const addModel = async () => {
    if (!newModel.id.includes("/")) return setMsg("Model id must be provider/model, e.g. anthropic/claude-sonnet-5");
    await api(`/models/${encodeURIComponent(newModel.id.trim())}`, { method: "PUT", json: { display_name: newModel.display_name || newModel.id, input_usd_per_m: Number(newModel.input) || 0, output_usd_per_m: Number(newModel.output) || 0, enabled: true } });
    setNewModel({ id: "", display_name: "", input: "", output: "" }); load();
  };
  const saveAlias = async (a: Alias) => { await api(`/aliases/${encodeURIComponent(a.name)}`, { method: "PUT", json: { description: a.description, candidates: JSON.parse(a.candidates) } }); setMsg(`Saved ${a.name}`); load(); };
  const delAlias = async (n: string) => { if (confirm(`Delete alias ${n}? Apps using it will get 404.`)) { await api(`/aliases/${encodeURIComponent(n)}`, { method: "DELETE" }); load(); } };
  const addAlias = async () => {
    if (!newAlias.name.trim()) return;
    await api(`/aliases/${encodeURIComponent(newAlias.name.trim())}`, { method: "PUT", json: { description: newAlias.description, candidates: newAlias.candidates.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) } });
    setNewAlias({ name: "", description: "", candidates: "" }); load();
  };
  const upd = (i: number, patch: Partial<Model>) => setModels((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const updA = (i: number, patch: Partial<Alias>) => setAliases((as) => as.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <>
      <h3>Models & aliases</h3>
      <p className="text-secondary small">Prices are USD per 1M tokens and drive the budget estimates. Workers AI requests are priced from the neurons Cloudflare reports instead. Model ids are exactly what Cloudflare AI Gateway's OpenAI-compatible endpoint accepts (<code>provider/model</code>).</p>
      {msg && <div className="alert alert-info py-2 small" onClick={() => setMsg(null)}>{msg}</div>}

      <div className="card mb-4"><div className="card-body">
        <h6>Aliases <span className="text-secondary fw-normal small">— what apps should ask for; candidates are tried in order, the next one is used if the previous fails</span></h6>
        {aliases.map((a, i) => (
          <div className="row g-2 align-items-start border-bottom border-secondary-subtle py-2" key={a.name}>
            <div className="col-md-2 mono pt-1">{a.name}</div>
            <div className="col-md-3"><input className="form-control form-control-sm" value={a.description} onChange={(e) => updA(i, { description: e.target.value })} /></div>
            <div className="col-md-5"><textarea className="form-control form-control-sm mono" rows={2} value={JSON.parse(a.candidates).join("\n")} onChange={(e) => updA(i, { candidates: JSON.stringify(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)) })} /></div>
            <div className="col-md-2 d-flex gap-1"><button className="btn btn-sm btn-outline-secondary" onClick={() => saveAlias(a)}>Save</button><button className="btn btn-sm btn-outline-danger" onClick={() => delAlias(a.name)}>×</button></div>
          </div>
        ))}
        <div className="row g-2 mt-2">
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="new alias, e.g. auto/chat" value={newAlias.name} onChange={(e) => setNewAlias({ ...newAlias, name: e.target.value })} /></div>
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="description" value={newAlias.description} onChange={(e) => setNewAlias({ ...newAlias, description: e.target.value })} /></div>
          <div className="col-md-5"><textarea className="form-control form-control-sm mono" rows={2} placeholder="model ids, one per line, in priority order" value={newAlias.candidates} onChange={(e) => setNewAlias({ ...newAlias, candidates: e.target.value })} /></div>
          <div className="col-md-2"><button className="btn btn-sm btn-primary" onClick={addAlias}>Add alias</button></div>
        </div>
      </div></div>

      <div className="card"><div className="card-body">
        <h6>Model catalog</h6>
        <div className="table-responsive"><table className="table table-dark table-sm align-middle small">
          <thead><tr><th>On</th><th>Model id</th><th>Name</th><th>Provider</th><th>$ in /1M</th><th>$ out /1M</th><th>Tags</th><th></th></tr></thead>
          <tbody>
            {models.map((m, i) => (
              <tr key={m.id}>
                <td><input type="checkbox" className="form-check-input" checked={!!m.enabled} onChange={(e) => upd(i, { enabled: e.target.checked ? 1 : 0 })} /></td>
                <td className="mono">{m.id}</td>
                <td><input className="form-control form-control-sm" value={m.display_name} onChange={(e) => upd(i, { display_name: e.target.value })} /></td>
                <td><span className="badge text-bg-secondary badge-provider">{m.provider}</span></td>
                <td style={{ width: 100 }}><input type="number" step="0.001" className="form-control form-control-sm" value={m.input_usd_per_m} onChange={(e) => upd(i, { input_usd_per_m: Number(e.target.value) })} /></td>
                <td style={{ width: 100 }}><input type="number" step="0.001" className="form-control form-control-sm" value={m.output_usd_per_m} onChange={(e) => upd(i, { output_usd_per_m: Number(e.target.value) })} /></td>
                <td style={{ width: 160 }}><input className="form-control form-control-sm" value={m.tags} onChange={(e) => upd(i, { tags: e.target.value })} /></td>
                <td className="text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => saveModel(m)}>Save</button><button className="btn btn-sm btn-outline-danger" onClick={() => delModel(m.id)}>×</button></td>
              </tr>
            ))}
            <tr>
              <td /><td><input className="form-control form-control-sm mono" placeholder="provider/model" value={newModel.id} onChange={(e) => setNewModel({ ...newModel, id: e.target.value })} /></td>
              <td><input className="form-control form-control-sm" placeholder="display name" value={newModel.display_name} onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })} /></td>
              <td />
              <td><input type="number" className="form-control form-control-sm" placeholder="0" value={newModel.input} onChange={(e) => setNewModel({ ...newModel, input: e.target.value })} /></td>
              <td><input type="number" className="form-control form-control-sm" placeholder="0" value={newModel.output} onChange={(e) => setNewModel({ ...newModel, output: e.target.value })} /></td>
              <td /><td><button className="btn btn-sm btn-primary" onClick={addModel}>Add</button></td>
            </tr>
          </tbody>
        </table></div>
        <div className="small text-secondary">Models with a $0 price and a non-Workers-AI provider are counted as free in budgets — fill in their prices (OpenAI, OpenRouter) before enabling them.</div>
      </div></div>
    </>
  );
}
