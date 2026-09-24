import { useState } from "react";
import type { Port, Route, Tunnel } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

const TABS = ["Routes", "Ports", "Reverse Proxy", "Cloudflare Tunnel"];

export function Networking() {
  const [tab, setTab] = useState("Routes");
  const { data: routes } = useApi(() => api.get<Route[]>("/routes"), [], { pollMs: 6000 });
  const { data: ports, refetch: refetchPorts } = useApi(() => api.get<Port[]>("/ports"), [], { pollMs: 6000 });
  const { data: tunnels } = useApi(() => api.get<Tunnel[]>("/tunnels"), []);
  const [exposeTarget, setExposeTarget] = useState<Port | null>(null);
  const toast = useToast();

  async function confirmExpose() {
    if (!exposeTarget) return;
    await api.post(`/ports/${exposeTarget.id}/exposure`, { exposure: "public" });
    toast.push({ title: "Port exposed publicly", message: `${exposeTarget.port}/${exposeTarget.protocol}`, demo: true, variant: "info" });
    setExposeTarget(null);
    refetchPorts();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Networking</h1>
          <div className="rf-page-sub">Reverse proxy routes, ports and Cloudflare Tunnels.</div>
        </div>
      </div>

      <div className="rf-tabs">
        {TABS.map((t) => <div key={t} className={`rf-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</div>)}
      </div>

      {(tab === "Routes" || tab === "Reverse Proxy") && (
        <div className="rf-table-card">
          <table className="rf-table">
            <thead><tr><th>Domain</th><th>Target</th><th>Internal Port</th><th>Protocol</th><th>WebSocket</th><th>Via Tunnel</th><th>Status</th></tr></thead>
            <tbody>
              {routes?.map((r) => (
                <tr key={r.id}>
                  <td className="fw-medium">{r.domain}{r.path !== "/" && r.path}</td>
                  <td className="rf-faint">{r.applicationName}</td>
                  <td className="rf-mono">{r.internalPort}</td>
                  <td className="rf-faint text-uppercase">{r.protocol}</td>
                  <td>{r.websocket ? <i className="bi bi-check-lg text-success" /> : <span className="rf-faint">—</span>}</td>
                  <td>{r.viaTunnel ? <i className="bi bi-check-lg text-success" /> : <span className="rf-faint">—</span>}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Ports" && (
        <div className="rf-table-card">
          <table className="rf-table">
            <thead><tr><th>Port</th><th>Protocol</th><th>Service</th><th>Exposure</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {ports?.map((p) => (
                <tr key={p.id}>
                  <td className="rf-mono fw-medium">{p.port}</td>
                  <td className="rf-faint text-uppercase">{p.protocol}</td>
                  <td>{p.service}</td>
                  <td>
                    <StatusBadge status={p.exposure === "public" ? "degraded" : p.exposure === "restricted" ? "unknown" : "healthy"} label={p.exposure} />
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-end">
                    {p.exposure !== "public" ? (
                      <button className="btn-rf btn-rf-danger" onClick={(e) => { e.stopPropagation(); setExposeTarget(p); }}>Expose publicly</button>
                    ) : (
                      <button className="btn-rf" onClick={async (e) => { e.stopPropagation(); await api.post(`/ports/${p.id}/exposure`, { exposure: "internal" }); refetchPorts(); }}>Restrict</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Cloudflare Tunnel" && (
        <div className="row g-3">
          {tunnels?.map((t) => (
            <div className="col-md-6" key={t.id}>
              <div className="rf-card">
                <div className="d-flex justify-content-between mb-2">
                  <div className="fw-semibold">{t.name}</div>
                  <StatusBadge status={t.status === "healthy" ? "healthy" : t.status} />
                </div>
                <div className="rf-faint mb-2">{t.connectors} connector{t.connectors === 1 ? "" : "s"}</div>
                {t.ingress.map((i, idx) => (
                  <div key={idx} className="rf-mono rf-faint" style={{ fontSize: 12 }}>{i.hostname} → {i.service}</div>
                ))}
              </div>
            </div>
          ))}
          {tunnels?.length === 0 && <div className="rf-empty"><i className="bi bi-cloud" />No tunnels configured.</div>}
        </div>
      )}

      {exposeTarget && (
        <ConfirmDialog
          title="Expose port publicly"
          danger
          confirmLabel="Expose publicly"
          onConfirm={confirmExpose}
          onCancel={() => setExposeTarget(null)}
        >
          <p>Port <strong>{exposeTarget.port}/{exposeTarget.protocol}</strong> ({exposeTarget.service}) will become reachable from the public internet.</p>
          <p className="rf-faint">This changes the security posture of {`production-01`}. Make sure this is intentional.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
