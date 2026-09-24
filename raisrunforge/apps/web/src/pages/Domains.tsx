import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Application, Domain } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export function Domains() {
  const { data: domains, loading, refetch } = useApi(() => api.get<Domain[]>("/domains"), [], { pollMs: 5000 });
  const { data: apps } = useApi(() => api.get<Application[]>("/applications"), []);
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState("");
  const [appId, setAppId] = useState("");
  const toast = useToast();

  async function create() {
    await api.post("/domains", { name, applicationId: appId || undefined });
    toast.push({ title: "Domain added", message: name, demo: true });
    setParams({});
    setName("");
    refetch();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Domains</h1>
          <div className="rf-page-sub">Domains, SSL and routing.</div>
        </div>
        <button className="btn-rf btn-rf-primary" onClick={() => setParams({ new: "1" })}><i className="bi bi-plus-lg me-1" />Add Domain</button>
      </div>

      {loading && <div className="rf-skeleton" style={{ height: 160 }} />}

      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Domain</th><th>Application</th><th>SSL</th><th>Provider</th><th>Status</th></tr></thead>
          <tbody>
            {domains?.map((d) => (
              <tr key={d.id}>
                <td className="fw-medium">{d.name}</td>
                <td className="rf-faint">{apps?.find((a) => a.id === d.applicationId)?.name ?? "—"}</td>
                <td><StatusBadge status={d.ssl === "active" ? "healthy" : d.ssl} label={d.ssl} /></td>
                <td className="rf-faint text-capitalize">{d.provider}</td>
                <td><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {params.get("new") === "1" && (
        <>
          <div className="rf-backdrop" onClick={() => setParams({})} />
          <div className="rf-modal">
            <div className="p-3 border-bottom" style={{ borderColor: "var(--rf-border-soft)" }}><strong>Add Domain</strong></div>
            <div className="p-3">
              <label className="rf-faint mb-1 d-block">Domain</label>
              <input className="form-control mb-2" placeholder="app.example.com" value={name} onChange={(e) => setName(e.target.value)} />
              <label className="rf-faint mb-1 d-block">Route to application (optional)</label>
              <select className="form-select" value={appId} onChange={(e) => setAppId(e.target.value)}>
                <option value="">— none —</option>
                {apps?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="p-3 border-top d-flex justify-content-end gap-2" style={{ borderColor: "var(--rf-border-soft)" }}>
              <button className="btn-rf" onClick={() => setParams({})}>Cancel</button>
              <button className="btn-rf btn-rf-primary" disabled={!name} onClick={create}>Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
