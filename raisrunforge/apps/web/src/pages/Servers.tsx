import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Server } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

function bytesGb(gb: number) { return `${gb} GB`; }

export function Servers() {
  const { data: servers, loading, refetch } = useApi(() => api.get<Server[]>("/servers"), [], { pollMs: 6000 });
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({ name: "", region: "Singapore", cpuCores: 4, memoryMb: 8192, diskGb: 160, os: "Ubuntu 24.04" });

  const showConnect = params.get("connect") === "1";

  async function submitConnect() {
    setConnecting(true);
    try {
      await api.post("/servers", form);
      toast.push({ title: "Server connected", message: `${form.name} is now provisioning`, demo: true });
      setParams({});
      refetch();
    } catch (err) {
      toast.push({ title: "Failed to connect server", variant: "error" });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Servers</h1>
          <div className="rf-page-sub">Your connected infrastructure — RunForge is a control plane, not a hosting provider.</div>
        </div>
        <button className="btn-rf btn-rf-primary" onClick={() => setParams({ connect: "1" })}>
          <i className="bi bi-plus-lg me-1" /> Connect Server
        </button>
      </div>

      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}

      <div className="row g-3">
        {servers?.map((s) => (
          <div className="col-md-6 col-xl-4" key={s.id}>
            <div className="rf-card h-100" style={{ cursor: "pointer" }} onClick={() => navigate(`/servers/${s.id}`)}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="fw-semibold">{s.name}</div>
                  <div className="rf-faint">{s.providerLabel} · {s.region}</div>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="rf-faint mb-2">{s.os} · {s.cpuCores} CPU · {(s.memoryMb / 1024).toFixed(0)} GB RAM · {bytesGb(s.diskGb)} SSD</div>
              <div className="d-flex gap-3 rf-faint">
                <span><i className="bi bi-box-seam me-1" />server metrics</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showConnect && (
        <>
          <div className="rf-backdrop" onClick={() => setParams({})} />
          <div className="rf-modal">
            <div className="p-3 border-bottom" style={{ borderColor: "var(--rf-border-soft)" }}><strong>Connect Server</strong></div>
            <div className="p-3">
              <p className="rf-faint">
                Bring your own infrastructure: VPS, dedicated server, or cloud provider. The Demo Provider simulates provisioning —
                in production, RunForge installs the RunForge Agent via <code className="rf-mono">curl -fsSL https://install.runforge.dev | sh</code>.
              </p>
              <div className="mb-2">
                <label className="rf-faint mb-1 d-block">Name</label>
                <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="production-02" />
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="rf-faint mb-1 d-block">Region</label>
                  <input className="form-control" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="rf-faint mb-1 d-block">OS</label>
                  <input className="form-control" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} />
                </div>
              </div>
              <div className="row g-2">
                <div className="col-4">
                  <label className="rf-faint mb-1 d-block">CPU cores</label>
                  <input type="number" className="form-control" value={form.cpuCores} onChange={(e) => setForm({ ...form, cpuCores: Number(e.target.value) })} />
                </div>
                <div className="col-4">
                  <label className="rf-faint mb-1 d-block">Memory (MB)</label>
                  <input type="number" className="form-control" value={form.memoryMb} onChange={(e) => setForm({ ...form, memoryMb: Number(e.target.value) })} />
                </div>
                <div className="col-4">
                  <label className="rf-faint mb-1 d-block">Disk (GB)</label>
                  <input type="number" className="form-control" value={form.diskGb} onChange={(e) => setForm({ ...form, diskGb: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="p-3 border-top d-flex justify-content-end gap-2" style={{ borderColor: "var(--rf-border-soft)" }}>
              <button className="btn-rf" onClick={() => setParams({})}>Cancel</button>
              <button className="btn-rf btn-rf-primary" disabled={!form.name || connecting} onClick={submitConnect}>
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
