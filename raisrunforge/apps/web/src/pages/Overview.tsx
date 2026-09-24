import { Link } from "react-router-dom";
import type { Deployment, Event, Incident, MetricSeries, OverviewSummary } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { MetricChart } from "../components/MetricChart";

interface OverviewData {
  summary: OverviewSummary;
  recentDeployments: Deployment[];
  recentEvents: Event[];
  activeIncidents: Incident[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rf-stat-card">
      <div className="rf-stat-label">{label}</div>
      <div className="rf-stat-value">{value}</div>
      {sub && <div className="rf-stat-sub">{sub}</div>}
    </div>
  );
}

export function Overview() {
  const { data, loading, error } = useApi(() => api.get<OverviewData>("/overview"), [], { pollMs: 5000 });
  const { data: metrics } = useApi(
    () => api.get<MetricSeries[]>("/metrics?resourceType=organization&resourceId=org_demo&names=cpu,requests,latency,errors&range=1h"),
    [],
    { pollMs: 5000 },
  );

  if (error) return <div className="rf-empty"><i className="bi bi-exclamation-triangle" />{error}</div>;
  if (loading || !data) return <OverviewSkeleton />;

  const { summary } = data;

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">
            {summary.allHealthy ? (
              <><i className="bi bi-check-circle-fill text-success me-2" />Everything is healthy</>
            ) : (
              <><i className="bi bi-exclamation-triangle-fill text-warning me-2" />Attention needed</>
            )}
          </h1>
          <div className="rf-page-sub">{summary.availabilityPercent}% availability across the organization</div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        {[
          ["Projects", summary.counts.projects],
          ["Applications", summary.counts.applications],
          ["Servers", summary.counts.servers],
          ["Containers", summary.counts.containers],
          ["Databases", summary.counts.databases],
          ["Deployments Today", summary.counts.deploymentsToday],
        ].map(([label, value]) => (
          <div className="col-6 col-md-4 col-lg-2" key={label as string}>
            <StatCard label={label as string} value={value as number} />
          </div>
        ))}
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-4">
          <StatCard label="Healthy" value={summary.counts.healthy} sub="applications" />
        </div>
        <div className="col-6 col-md-4">
          <StatCard label="Degraded" value={summary.counts.degraded} sub="applications" />
        </div>
        <div className="col-6 col-md-4">
          <StatCard label="Failed" value={summary.counts.failed} sub="applications" />
        </div>
      </div>

      {metrics && (
        <div className="rf-card mb-3">
          <div className="fw-semibold mb-2">Infrastructure Health</div>
          <div className="row g-3">
            {metrics.map((s) => (
              <div className="col-md-6" key={s.name}>
                <div className="rf-faint mb-1 text-capitalize">{s.name}</div>
                <MetricChart series={s} height={140} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="rf-card">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold">Recent Deployments</div>
              <Link to="/deployments" className="rf-faint">View all</Link>
            </div>
            <div className="rf-table-card" style={{ border: "none" }}>
              <table className="rf-table">
                <tbody>
                  {data.recentDeployments.map((d) => (
                    <tr key={d.id} onClick={() => (window.location.href = `/deployments/${d.id}`)}>
                      <td>
                        <div className="fw-medium">{d.applicationName}</div>
                        <div className="rf-faint">{d.version} · {d.commitSha}</div>
                      </td>
                      <td><StatusBadge status={d.environment === "production" ? "active" : "unknown"} label={d.environment} /></td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="rf-faint text-end">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="rf-card mb-3">
            <div className="fw-semibold mb-2">Active Incidents</div>
            {data.activeIncidents.length === 0 && <div className="rf-faint">No active incidents.</div>}
            {data.activeIncidents.map((i) => (
              <Link to="/incidents" key={i.id} className="d-block mb-2 p-2 rounded" style={{ background: "var(--rf-surface-raised)" }}>
                <div className="d-flex justify-content-between">
                  <span className="fw-medium">{i.title}</span>
                  <StatusBadge status={i.status} />
                </div>
                <div className="rf-faint mt-1">{i.likelyCause ?? i.resourceName}</div>
              </Link>
            ))}
          </div>
          <div className="rf-card">
            <div className="fw-semibold mb-2">Recent Activity</div>
            {data.recentEvents.map((e) => (
              <div key={e.id} className="d-flex align-items-start gap-2 mb-2">
                <i className={`bi ${e.status === "failed" ? "bi-x-circle text-danger" : "bi-check-circle text-success"} mt-1`} style={{ fontSize: 11 }} />
                <div>
                  <div>{e.message}</div>
                  <div className="rf-faint">{e.actorName} · {new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div>
      <div className="rf-skeleton mb-3" style={{ height: 32, width: 280 }} />
      <div className="row g-2 mb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="col-6 col-md-4 col-lg-2" key={i}><div className="rf-skeleton" style={{ height: 70 }} /></div>
        ))}
      </div>
      <div className="rf-skeleton" style={{ height: 240 }} />
    </div>
  );
}
