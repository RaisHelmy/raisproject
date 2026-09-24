import type { Container, Server } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export function Containers() {
  const { data: containers, loading, refetch } = useApi(() => api.get<Container[]>("/containers"), [], { pollMs: 5000 });
  const { data: servers } = useApi(() => api.get<Server[]>("/servers"), []);
  const toast = useToast();

  async function act(id: string, action: "start" | "stop" | "restart", name: string) {
    await api.post(`/containers/${id}/${action}`);
    toast.push({ title: `Container ${action}ed`, message: name, demo: true });
    refetch();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Containers</h1>
          <div className="rf-page-sub">Docker containers across every connected server.</div>
        </div>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}
      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Container</th><th>Image</th><th>Server</th><th>Status</th><th>CPU</th><th>Memory</th><th>Ports</th><th></th></tr></thead>
          <tbody>
            {containers?.map((c) => (
              <tr key={c.id}>
                <td className="fw-medium">{c.name}</td>
                <td className="rf-faint rf-mono">{c.image}</td>
                <td className="rf-faint">{servers?.find((s) => s.id === c.serverId)?.name ?? "—"}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="rf-faint">{c.cpuPercent.toFixed(1)}%</td>
                <td className="rf-faint">{c.memoryMb} MB</td>
                <td className="rf-faint rf-mono">{c.ports.map((p) => p.host ?? p.container).join(", ") || "—"}</td>
                <td className="text-end">
                  <div className="d-flex gap-1 justify-content-end">
                    <button className="btn-rf" onClick={() => act(c.id, "restart", c.name)}>Restart</button>
                    {c.status === "running" ? (
                      <button className="btn-rf" onClick={() => act(c.id, "stop", c.name)}>Stop</button>
                    ) : (
                      <button className="btn-rf" onClick={() => act(c.id, "start", c.name)}>Start</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
