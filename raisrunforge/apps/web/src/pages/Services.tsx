import type { Server, ServiceRecord } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

export function Services() {
  const { data: servers } = useApi(() => api.get<Server[]>("/servers"), []);
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Services</h1>
          <div className="rf-page-sub">System services (Docker, Nginx, PostgreSQL, Redis, Cron, and more) per server.</div>
        </div>
      </div>
      {servers?.filter((s) => s.status === "online").map((s) => <ServerServices key={s.id} server={s} />)}
    </div>
  );
}

function ServerServices({ server }: { server: Server }) {
  const { data: services } = useApi(() => api.get<ServiceRecord[]>(`/servers/${server.id}/services`), [server.id], { pollMs: 8000 });
  return (
    <div className="rf-card mb-3">
      <div className="fw-semibold mb-2">{server.name}</div>
      <table className="rf-table">
        <thead><tr><th>Service</th><th>Status</th><th>CPU</th><th>Memory</th></tr></thead>
        <tbody>
          {services?.map((svc) => (
            <tr key={svc.id}>
              <td>{svc.name}</td>
              <td><StatusBadge status={svc.status} /></td>
              <td className="rf-faint">{svc.cpuPercent.toFixed(1)}%</td>
              <td className="rf-faint">{svc.memoryMb} MB</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
