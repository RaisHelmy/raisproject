import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Database } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

interface Health { status: string; connections: number; maxConnections: number; queriesPerSecond: number; slowQueries: number; sizeBytes: number; }
interface QueryResult { columns: string[]; rows: unknown[][]; durationMs: number; simulated: boolean; }

export function DatabaseDetail() {
  const { id = "" } = useParams();
  const [sql, setSql] = useState("SELECT * FROM orders LIMIT 10;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const { data: db } = useApi(() => api.get<Database>(`/databases/${id}`), [id], { pollMs: 5000 });
  const { data: health } = useApi(() => api.get<Health>(`/databases/${id}/health`), [id], { pollMs: 4000 });

  if (!db) return <div className="rf-skeleton" style={{ height: 200 }} />;

  async function runQuery() {
    const r = await api.post<QueryResult>(`/databases/${id}/query`, { sql });
    setResult(r);
  }

  return (
    <div>
      <div className="rf-breadcrumb"><Link to="/databases">Databases</Link> / {db.name}</div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">{db.name}</h1>
          <div className="rf-page-sub d-flex align-items-center gap-2 mt-1">
            <StatusBadge status={db.status} /><span>{db.engine} {db.version}</span>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Size</div><div className="rf-stat-value">{(db.sizeBytes / 1024 ** 3).toFixed(1)} GB</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Connections</div><div className="rf-stat-value">{health?.connections ?? db.connections} / {db.maxConnections}</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Queries/sec</div><div className="rf-stat-value">{health?.queriesPerSecond ?? db.queriesPerSecond}</div></div></div>
        <div className="col-6 col-md-3"><div className="rf-stat-card"><div className="rf-stat-label">Slow queries</div><div className="rf-stat-value">{health?.slowQueries ?? 0}</div></div></div>
      </div>

      <div className="rf-card">
        <div className="fw-semibold mb-2">Query <span className="rf-demo-pill ms-2">Demo Provider — read-only</span></div>
        <textarea className="form-control rf-mono mb-2" rows={3} value={sql} onChange={(e) => setSql(e.target.value)} />
        <button className="btn-rf btn-rf-primary" onClick={runQuery}>Run Query</button>
        {result && (
          <div className="mt-3 rf-table-card">
            <table className="rf-table">
              <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>{row.map((v, j) => <td key={j} className="rf-mono">{String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <div className="rf-faint p-2">{result.durationMs}ms · simulated</div>
          </div>
        )}
      </div>
    </div>
  );
}
