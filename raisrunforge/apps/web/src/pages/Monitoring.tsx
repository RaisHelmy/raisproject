import { useState } from "react";
import type { Application, MetricRange, MetricSeries, Server } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { MetricChart } from "../components/MetricChart";

const RANGES: MetricRange[] = ["5m", "1h", "6h", "24h", "7d", "30d"];

export function Monitoring() {
  const [resourceType, setResourceType] = useState<"server" | "application">("server");
  const [resourceId, setResourceId] = useState("");
  const [range, setRange] = useState<MetricRange>("1h");
  const { data: servers } = useApi(() => api.get<Server[]>("/servers"), []);
  const { data: apps } = useApi(() => api.get<Application[]>("/applications"), []);

  const options = resourceType === "server" ? servers : apps;
  const activeId = resourceId || options?.[0]?.id || "";
  const names = resourceType === "server" ? "cpu,memory,network,disk" : "requests,latency,errors,cpu";

  const { data: metrics } = useApi(
    () => (activeId ? api.get<MetricSeries[]>(`/metrics?resourceType=${resourceType}&resourceId=${activeId}&names=${names}&range=${range}`) : Promise.resolve([])),
    [resourceType, activeId, range],
    { pollMs: 5000 },
  );

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Monitoring</h1>
          <div className="rf-page-sub">Server, application and database metrics.</div>
        </div>
      </div>

      <div className="rf-card mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <select className="form-select" style={{ maxWidth: 160 }} value={resourceType} onChange={(e) => { setResourceType(e.target.value as never); setResourceId(""); }}>
            <option value="server">Servers</option>
            <option value="application">Applications</option>
          </select>
          <select className="form-select" style={{ maxWidth: 220 }} value={activeId} onChange={(e) => setResourceId(e.target.value)}>
            {options?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <div className="d-flex gap-1 ms-auto">
            {RANGES.map((r) => (
              <button key={r} className={`btn-rf ${range === r ? "btn-rf-primary" : ""}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="row g-3">
        {metrics?.map((s) => (
          <div className="col-md-6" key={s.name}>
            <div className="rf-card">
              <div className="fw-semibold mb-2 text-capitalize">{s.name}</div>
              <MetricChart series={s} height={220} />
            </div>
          </div>
        ))}
        {!metrics?.length && <div className="col-12"><div className="rf-skeleton" style={{ height: 220 }} /></div>}
      </div>
    </div>
  );
}
