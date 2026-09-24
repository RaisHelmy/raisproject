import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Project } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export function Projects() {
  const { data: projects, loading, refetch } = useApi(() => api.get<Project[]>("/projects"), []);
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  async function create() {
    const p = await api.post<Project>("/projects", { name });
    toast.push({ title: "Project created", message: p.name });
    setParams({});
    setName("");
    refetch();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Projects</h1>
          <div className="rf-page-sub">Group applications, databases and domains by product.</div>
        </div>
        <button className="btn-rf btn-rf-primary" onClick={() => setParams({ new: "1" })}><i className="bi bi-plus-lg me-1" />New Project</button>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 160 }} />}
      <div className="row g-3">
        {projects?.map((p) => (
          <div className="col-md-6 col-xl-4" key={p.id}>
            <div className="rf-card h-100" style={{ cursor: "pointer" }} onClick={() => navigate(`/applications?projectId=${p.id}`)}>
              <div className="d-flex justify-content-between mb-1">
                <div className="fw-semibold">{p.name}</div>
                <StatusBadge status={p.status === "active" ? "healthy" : "unknown"} label={p.status} />
              </div>
              <div className="rf-faint">{p.description ?? "No description"}</div>
            </div>
          </div>
        ))}
      </div>
      {params.get("new") === "1" && (
        <>
          <div className="rf-backdrop" onClick={() => setParams({})} />
          <div className="rf-modal">
            <div className="p-3 border-bottom" style={{ borderColor: "var(--rf-border-soft)" }}><strong>New Project</strong></div>
            <div className="p-3">
              <input className="form-control" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="p-3 border-top d-flex justify-content-end gap-2" style={{ borderColor: "var(--rf-border-soft)" }}>
              <button className="btn-rf" onClick={() => setParams({})}>Cancel</button>
              <button className="btn-rf btn-rf-primary" disabled={!name} onClick={create}>Create</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
