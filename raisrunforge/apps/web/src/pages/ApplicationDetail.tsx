import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Application, ApplicationRevision, Deployment, EnvironmentVariable, Event, LogEntry, MetricSeries } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { MetricChart } from "../components/MetricChart";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface Health {
  status: string; cpuPercent: number; memoryMb: number; requestsPerMinute: number; requestsLastHour: number;
  latencyMs: number; errorRatePercent: number; instances: number; uptimeSeconds: number;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

const TABS = ["Overview", "Deployments", "Revisions", "Logs", "Metrics", "Environment", "Health"];

export function ApplicationDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState("Overview");
  const [confirmRollback, setConfirmRollback] = useState<ApplicationRevision | null>(null);
  const { data: app, refetch: refetchApp } = useApi(() => api.get<Application>(`/applications/${id}`), [id], { pollMs: 5000 });
  const { data: health } = useApi(() => api.get<Health>(`/applications/${id}/health`), [id], { pollMs: 3000 });
  const toast = useToast();

  if (!app) return <div className="rf-skeleton" style={{ height: 200 }} />;

  async function deploy() {
    const dep = await api.post<Deployment>(`/applications/${id}/deploy`, { commitMessage: "Manual deploy from RunForge UI" });
    toast.push({ title: "Deployment started", message: `${app!.name} ${dep.version}`, demo: true });
    window.location.href = `/deployments/${dep.id}`;
  }
  async function restart() {
    await api.post(`/applications/${id}/restart`);
    toast.push({ title: "Application restarted", message: app!.name, demo: true });
    refetchApp();
  }
  async function doRollback() {
    if (!confirmRollback) return;
    await api.post(`/applications/${id}/rollback`, { revisionId: confirmRollback.id });
    toast.push({ title: "Rolled back", message: `${app!.name} → ${confirmRollback.version}`, demo: true });
    setConfirmRollback(null);
    refetchApp();
  }

  return (
    <div>
      <div className="rf-breadcrumb"><Link to="/applications">Applications</Link> / {app.name}</div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">{app.name}</h1>
          <div className="rf-page-sub d-flex align-items-center gap-2 mt-1">
            <StatusBadge status={app.status} />
            <span className="text-capitalize">{app.environment}</span>
            {app.url && <a href={app.url} target="_blank" rel="noreferrer">{app.url}</a>}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn-rf btn-rf-primary" onClick={deploy}><i className="bi bi-rocket-takeoff me-1" />Deploy</button>
          <button className="btn-rf" onClick={restart}><i className="bi bi-arrow-clockwise me-1" />Restart</button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">Revision</div><div className="rf-stat-value" style={{ fontSize: 16 }}>{app.currentVersion ?? "—"}</div></div></div>
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">CPU</div><div className="rf-stat-value">{health?.cpuPercent ?? "—"}%</div></div></div>
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">Memory</div><div className="rf-stat-value">{health?.memoryMb ?? "—"}<span style={{ fontSize: 13 }}> MB</span></div></div></div>
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">Requests</div><div className="rf-stat-value">{health?.requestsLastHour ?? "—"}</div></div></div>
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">Latency</div><div className="rf-stat-value">{health?.latencyMs ?? "—"}<span style={{ fontSize: 13 }}> ms</span></div></div></div>
        <div className="col-6 col-md-2"><div className="rf-stat-card"><div className="rf-stat-label">Errors</div><div className="rf-stat-value">{health?.errorRatePercent ?? "—"}%</div></div></div>
      </div>

      <div className="rf-tabs">
        {TABS.map((t) => <div key={t} className={`rf-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</div>)}
      </div>

      {tab === "Overview" && <OverviewTab app={app} health={health} />}
      {tab === "Deployments" && <DeploymentsTab applicationId={id} />}
      {tab === "Revisions" && <RevisionsTab applicationId={id} currentRevisionId={app.currentRevisionId} onRollback={setConfirmRollback} />}
      {tab === "Logs" && <LogsTab applicationId={id} />}
      {tab === "Metrics" && <MetricsTab applicationId={id} />}
      {tab === "Environment" && <EnvironmentTab applicationId={id} />}
      {tab === "Health" && <HealthTab health={health} />}

      {confirmRollback && (
        <ConfirmDialog
          title="Rollback application"
          danger
          confirmLabel="Rollback"
          onConfirm={doRollback}
          onCancel={() => setConfirmRollback(null)}
        >
          <p>Roll back <strong>{app.name}</strong> to <strong>{confirmRollback.version}</strong>?</p>
          <p className="rf-faint">This is a DANGEROUS action on production applications and is recorded in the audit log.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function OverviewTab({ app, health }: { app: Application; health?: Health }) {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="rf-card">
          <div className="fw-semibold mb-2">Configuration</div>
          <Row label="Runtime" value={app.runtimeLabel} />
          <Row label="Packaging" value={app.packaging} />
          <Row label="Source" value={app.source.repository ?? app.source.image ?? app.source.type} />
          <Row label="Branch" value={app.source.branch ?? "—"} />
          <Row label="Port" value={String(app.port)} />
          <Row label="Health check" value={app.healthPath} />
        </div>
      </div>
      <div className="col-md-6">
        <div className="rf-card">
          <div className="fw-semibold mb-2">Resources</div>
          <Row label="CPU" value={String(app.resources.cpu)} />
          <Row label="Memory" value={`${app.resources.memoryMb} MB`} />
          <Row label="Instances" value={`${app.resources.instances} (min ${app.resources.minInstances} / max ${app.resources.maxInstances})`} />
          <Row label="Uptime" value={health ? formatUptime(health.uptimeSeconds) : "—"} />
        </div>
      </div>
      {health && (
        <div className="col-12">
          <div className="rf-card">
            <div className="fw-semibold mb-2">Health Checks</div>
            {health.checks.map((c) => (
              <div key={c.name} className="d-flex justify-content-between py-1" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
                <span><i className={`bi ${c.ok ? "bi-check-circle text-success" : "bi-x-circle text-danger"} me-2`} />{c.name}</span>
                <span className="rf-faint">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="d-flex justify-content-between py-1" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
      <span className="rf-faint">{label}</span><span className="text-truncate ms-2">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function DeploymentsTab({ applicationId }: { applicationId: string }) {
  const { data: deployments, loading } = useApi(() => api.get<Deployment[]>(`/deployments?applicationId=${applicationId}`), [applicationId], { pollMs: 3000 });
  if (loading) return <div className="rf-skeleton" style={{ height: 160 }} />;
  if (!deployments?.length) return <div className="rf-empty"><i className="bi bi-rocket" />No deployments yet.</div>;
  return (
    <div className="rf-table-card">
      <table className="rf-table">
        <thead><tr><th>Version</th><th>Commit</th><th>Trigger</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead>
        <tbody>
          {deployments.map((d) => (
            <tr key={d.id} onClick={() => (window.location.href = `/deployments/${d.id}`)}>
              <td className="fw-medium">{d.version}</td>
              <td className="rf-faint rf-mono">{d.commitSha}</td>
              <td className="rf-faint text-capitalize">{d.trigger}</td>
              <td><StatusBadge status={d.status} /></td>
              <td className="rf-faint">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
              <td className="rf-faint">{new Date(d.queuedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevisionsTab({ applicationId, currentRevisionId, onRollback }: { applicationId: string; currentRevisionId?: string; onRollback: (r: ApplicationRevision) => void }) {
  const { data: revisions, loading } = useApi(() => api.get<ApplicationRevision[]>(`/applications/${applicationId}/revisions`), [applicationId]);
  if (loading) return <div className="rf-skeleton" style={{ height: 160 }} />;
  return (
    <div className="rf-table-card">
      <table className="rf-table">
        <thead><tr><th>Revision</th><th>Traffic</th><th>Status</th><th>Commit</th><th></th></tr></thead>
        <tbody>
          {revisions?.map((r) => (
            <tr key={r.id}>
              <td className="fw-medium">{r.version}{r.id === currentRevisionId && <span className="rf-faint ms-2">current</span>}</td>
              <td>{r.trafficPercent}%</td>
              <td><StatusBadge status={r.status} /></td>
              <td className="rf-faint rf-mono">{r.commitSha}</td>
              <td className="text-end">
                {r.id !== currentRevisionId && (
                  <button className="btn-rf" onClick={(e) => { e.stopPropagation(); onRollback(r); }}>Rollback</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsTab({ applicationId }: { applicationId: string }) {
  const { data: logs } = useApi(() => api.get<LogEntry[]>(`/logs?applicationId=${applicationId}&limit=150`), [applicationId], { pollMs: 3000 });
  return (
    <div className="rf-card p-0">
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {logs?.map((l) => (
          <div key={l.id} className="rf-log-line">
            <span className="rf-faint">{new Date(l.timestamp).toLocaleTimeString()}</span>
            <span className={`rf-sev-${l.severity}`} style={{ width: 46 }}>{l.severity.toUpperCase()}</span>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ applicationId }: { applicationId: string }) {
  const { data: metrics } = useApi(
    () => api.get<MetricSeries[]>(`/metrics?resourceType=application&resourceId=${applicationId}&names=requests,latency,errors,cpu&range=1h`),
    [applicationId],
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

function EnvironmentTab({ applicationId }: { applicationId: string }) {
  const { data: vars, loading, refetch } = useApi(() => api.get<EnvironmentVariable[]>(`/applications/${applicationId}/environment`), [applicationId]);
  const [reveal, setReveal] = useState(false);
  const toast = useToast();
  if (loading) return <div className="rf-skeleton" style={{ height: 120 }} />;
  return (
    <div className="rf-card">
      <div className="d-flex justify-content-between mb-2">
        <div className="fw-semibold">Environment Variables</div>
        <button className="btn-rf" onClick={() => setReveal((r) => !r)}>{reveal ? "Hide" : "Reveal"} secrets</button>
      </div>
      <table className="rf-table">
        <tbody>
          {vars?.map((v) => (
            <tr key={v.key}>
              <td className="rf-mono fw-medium">{v.key}</td>
              <td className="rf-mono rf-faint">{v.secret && !reveal ? "••••••••••••" : v.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthTab({ health }: { health?: Health }) {
  if (!health) return <div className="rf-skeleton" style={{ height: 120 }} />;
  return (
    <div className="rf-card">
      <div className="fw-semibold mb-2">Checks</div>
      {health.checks.map((c) => (
        <div key={c.name} className="d-flex justify-content-between py-1" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
          <span><i className={`bi ${c.ok ? "bi-check-circle text-success" : "bi-x-circle text-danger"} me-2`} />{c.name}</span>
          <span className="rf-faint">{c.detail}</span>
        </div>
      ))}
    </div>
  );
}
