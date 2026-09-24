import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Application, Container, LogEntry, MetricSeries, Server, ServerMetricsSnapshot, ServiceRecord } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { MetricChart } from "../components/MetricChart";
import { useToast } from "../components/Toast";

const TABS = ["Overview", "Applications", "Containers", "Services", "Monitoring", "Logs", "Networking", "Backups", "Settings"];

export function ServerDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState("Overview");
  const { data: server } = useApi(() => api.get<Server>(`/servers/${id}`), [id], { pollMs: 6000 });
  const { data: metrics } = useApi(() => api.get<ServerMetricsSnapshot>(`/servers/${id}/metrics`), [id], { pollMs: 3000 });
  const toast = useToast();

  if (!server) return <div className="rf-skeleton" style={{ height: 200 }} />;

  async function restartAgent() {
    await api.post(`/servers/${id}/restart-agent`);
    toast.push({ title: "Agent restarted", message: server!.name, demo: true });
  }

  return (
    <div>
      <div className="rf-breadcrumb"><Link to="/servers">Servers</Link> / {server.name}</div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">{server.name}</h1>
          <div className="rf-page-sub d-flex align-items-center gap-2 mt-1">
            <StatusBadge status={server.status} />
            <span>{server.os}</span>
            <span>·</span>
            <span>{server.providerLabel}</span>
            <span>·</span>
            <span>{server.region}</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn-rf" onClick={restartAgent}><i className="bi bi-arrow-clockwise me-1" />Restart Agent</button>
          <button className="btn-rf"><i className="bi bi-terminal me-1" />Terminal</button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">CPU</div><div className="rf-stat-value">{metrics?.cpuPercent ?? "—"}%</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Memory</div><div className="rf-stat-value">{metrics?.memoryPercent ?? "—"}%</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Disk</div><div className="rf-stat-value">{metrics?.diskPercent ?? "—"}%</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Network</div><div className="rf-stat-value">{metrics?.networkMbps ?? "—"} <span style={{ fontSize: 13 }}>Mbps</span></div></div></div>
      </div>

      <div className="rf-tabs">
        {TABS.map((t) => (
          <div key={t} className={`rf-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      {tab === "Overview" && <ServerOverviewTab server={server} metrics={metrics} />}
      {tab === "Applications" && <ServerApplicationsTab id={id} />}
      {tab === "Containers" && <ServerContainersTab id={id} />}
      {tab === "Services" && <ServerServicesTab id={id} />}
      {tab === "Monitoring" && <ServerMonitoringTab id={id} />}
      {tab === "Logs" && <ServerLogsTab id={id} />}
      {tab === "Networking" && <div className="rf-card"><Link to="/networking" className="rf-faint">Manage routes and ports in Networking →</Link></div>}
      {tab === "Backups" && <div className="rf-card"><Link to="/backups" className="rf-faint">Manage backups in the Backups center →</Link></div>}
      {tab === "Settings" && (
        <div className="rf-card">
          <div className="mb-2"><span className="rf-faint">IP address</span> <span className="rf-mono ms-2">{server.ipAddress}</span></div>
          <div className="mb-2"><span className="rf-faint">Agent version</span> <span className="ms-2">{server.agentVersion ?? "not installed"}</span></div>
          <div className="mb-3"><span className="rf-faint">Tags</span> <span className="ms-2">{server.tags.join(", ")}</span></div>
          <button className="btn-rf btn-rf-danger"><i className="bi bi-trash me-1" />Remove server</button>
        </div>
      )}
    </div>
  );
}

function ServerOverviewTab({ server, metrics }: { server: Server; metrics?: ServerMetricsSnapshot }) {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="rf-card">
          <div className="fw-semibold mb-2">System</div>
          <Row label="Operating System" value={server.os} />
          <Row label="CPU" value={`${server.cpuCores} cores`} />
          <Row label="Memory" value={`${(server.memoryMb / 1024).toFixed(0)} GB`} />
          <Row label="Disk" value={`${server.diskGb} GB`} />
          <Row label="Uptime" value={formatUptime(server.uptimeSeconds)} />
        </div>
      </div>
      <div className="col-md-6">
        <div className="rf-card">
          <div className="fw-semibold mb-2">Live</div>
          <Row label="Processes" value={String(metrics?.processes ?? "—")} />
          <Row label="Containers" value={String(metrics?.containers ?? "—")} />
          <Row label="Applications" value={String(metrics?.applications ?? "—")} />
          <Row label="Load average" value={metrics ? metrics.loadAverage.map((v) => v.toFixed(2)).join(" / ") : "—"} />
          <Row label="Last heartbeat" value={server.lastHeartbeatAt ? new Date(server.lastHeartbeatAt).toLocaleTimeString() : "—"} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="d-flex justify-content-between py-1" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
      <span className="rf-faint">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "offline";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

function ServerApplicationsTab({ id }: { id: string }) {
  const { data: apps, loading } = useApi(() => api.get<Application[]>(`/servers/${id}/applications`), [id]);
  if (loading) return <div className="rf-skeleton" style={{ height: 120 }} />;
  if (!apps?.length) return <div className="rf-empty"><i className="bi bi-grid-1x2" />No applications on this server.</div>;
  return (
    <div className="rf-table-card">
      <table className="rf-table">
        <thead><tr><th>Application</th><th>Environment</th><th>Status</th><th>Version</th></tr></thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} onClick={() => (window.location.href = `/applications/${a.id}`)}>
              <td className="fw-medium">{a.name}</td>
              <td className="rf-faint">{a.environment}</td>
              <td><StatusBadge status={a.status} /></td>
              <td className="rf-faint">{a.currentVersion ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServerContainersTab({ id }: { id: string }) {
  const { data: containers, loading, refetch } = useApi(() => api.get<Container[]>(`/containers?serverId=${id}`), [id], { pollMs: 5000 });
  const toast = useToast();
  async function restart(cid: string, name: string) {
    await api.post(`/containers/${cid}/restart`);
    toast.push({ title: "Container restarted", message: name, demo: true });
    refetch();
  }
  if (loading) return <div className="rf-skeleton" style={{ height: 120 }} />;
  return (
    <div className="rf-table-card">
      <table className="rf-table">
        <thead><tr><th>Container</th><th>Image</th><th>Status</th><th>CPU</th><th>Memory</th><th></th></tr></thead>
        <tbody>
          {containers?.map((c) => (
            <tr key={c.id}>
              <td className="fw-medium">{c.name}</td>
              <td className="rf-faint rf-mono">{c.image}</td>
              <td><StatusBadge status={c.status} /></td>
              <td className="rf-faint">{c.cpuPercent.toFixed(1)}%</td>
              <td className="rf-faint">{c.memoryMb} MB</td>
              <td className="text-end">
                <button className="btn-rf" onClick={(e) => { e.stopPropagation(); restart(c.id, c.name); }}>Restart</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServerServicesTab({ id }: { id: string }) {
  const { data: services, loading, refetch } = useApi(() => api.get<ServiceRecord[]>(`/servers/${id}/services`), [id], { pollMs: 6000 });
  const toast = useToast();
  async function control(svcId: string, action: "start" | "stop" | "restart", name: string) {
    await api.post(`/services/${svcId}/${action}`);
    toast.push({ title: `Service ${action}ed`, message: name, demo: true });
    refetch();
  }
  if (loading) return <div className="rf-skeleton" style={{ height: 120 }} />;
  return (
    <div className="rf-table-card">
      <table className="rf-table">
        <thead><tr><th>Service</th><th>Status</th><th>PID</th><th>CPU</th><th>Memory</th><th>Uptime</th><th></th></tr></thead>
        <tbody>
          {services?.map((s) => (
            <tr key={s.id}>
              <td className="fw-medium">{s.name}</td>
              <td><StatusBadge status={s.status} /></td>
              <td className="rf-faint rf-mono">{s.pid ?? "—"}</td>
              <td className="rf-faint">{s.cpuPercent.toFixed(1)}%</td>
              <td className="rf-faint">{s.memoryMb} MB</td>
              <td className="rf-faint">{formatUptime(s.uptimeSeconds)}</td>
              <td className="text-end">
                <button className="btn-rf" onClick={(e) => { e.stopPropagation(); control(s.id, "restart", s.name); }}>Restart</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServerMonitoringTab({ id }: { id: string }) {
  const { data: metrics } = useApi(
    () => api.get<MetricSeries[]>(`/metrics?resourceType=server&resourceId=${id}&names=cpu,memory,network,disk&range=1h`),
    [id],
    { pollMs: 5000 },
  );
  if (!metrics) return <div className="rf-skeleton" style={{ height: 200 }} />;
  return (
    <div className="row g-3">
      {metrics.map((s) => (
        <div className="col-md-6" key={s.name}>
          <div className="rf-card">
            <div className="fw-semibold mb-2 text-capitalize">{s.name}</div>
            <MetricChart series={s} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ServerLogsTab({ id }: { id: string }) {
  const { data: logs } = useApi(() => api.get<LogEntry[]>(`/logs?serverId=${id}&limit=100`), [id], { pollMs: 3000 });
  return (
    <div className="rf-card p-0">
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {logs?.map((l) => (
          <div key={l.id} className="rf-log-line">
            <span className="rf-faint">{new Date(l.timestamp).toLocaleTimeString()}</span>
            <span className={`rf-sev-${l.severity}`} style={{ width: 46 }}>{l.severity.toUpperCase()}</span>
            <span className="rf-faint">{l.service}</span>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
