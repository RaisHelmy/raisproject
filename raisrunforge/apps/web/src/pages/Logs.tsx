import { useEffect, useRef, useState } from "react";
import type { LogEntry, LogSeverity } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

const SEVERITIES: LogSeverity[] = ["debug", "info", "warn", "error"];

export function Logs() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<Set<LogSeverity>>(new Set());
  const [service, setService] = useState("");
  const [live, setLive] = useState(true);
  const { data: services } = useApi(() => api.get<string[]>("/logs/services"), []);
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (severity.size) query.set("severity", [...severity].join(","));
  if (service) query.set("service", service);
  query.set("limit", "300");

  const { data: logs } = useApi(() => api.get<LogEntry[]>(`/logs?${query.toString()}`), [search, [...severity].join(","), service], { pollMs: live ? 2500 : undefined });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, live]);

  function toggleSeverity(s: LogSeverity) {
    setSeverity((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Logs</h1>
          <div className="rf-page-sub">Centralized logs across applications, containers, servers and the agent.</div>
        </div>
      </div>

      <div className="rf-card mb-2">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <input className="form-control" style={{ maxWidth: 280 }} placeholder="Search message, service, request id…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 200 }} value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">All services</option>
            {services?.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="d-flex gap-1">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                className={`btn-rf ${severity.has(s) ? "btn-rf-primary" : ""}`}
                onClick={() => toggleSeverity(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="form-check form-switch ms-auto">
            <input className="form-check-input" type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} id="liveMode" />
            <label className="form-check-label rf-faint" htmlFor="liveMode">Live</label>
          </div>
        </div>
      </div>

      <div className="rf-card p-0">
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {logs?.map((l) => (
            <div key={l.id} className="rf-log-line">
              <span className="rf-faint" style={{ width: 90, flexShrink: 0 }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
              <span className={`rf-sev-${l.severity}`} style={{ width: 50, flexShrink: 0 }}>{l.severity.toUpperCase()}</span>
              <span className="rf-faint" style={{ width: 130, flexShrink: 0 }}>{l.service}</span>
              <span>{l.message}</span>
            </div>
          ))}
          {logs?.length === 0 && <div className="rf-empty"><i className="bi bi-terminal" />No log lines match this filter.</div>}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
