import { useNavigate } from "react-router-dom";
import type { GraphNode, InfrastructureGraph } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

const TYPE_ICON: Record<string, string> = {
  domain: "bi-globe2", cloudflare: "bi-cloud", tunnel: "bi-diagram-2", server: "bi-hdd-rack",
  proxy: "bi-signpost-split", container: "bi-box-seam", application: "bi-grid-1x2",
  database: "bi-database", storage: "bi-hdd-stack", cache: "bi-lightning-charge",
};

/** Groups nodes into columns by type so the dependency chain reads left-to-right (spec §47). */
const COLUMN_ORDER = ["domain", "cloudflare", "tunnel", "server", "proxy", "application", "container", "database", "cache", "storage"];

export function InfraGraph() {
  const { data: graph, loading } = useApi(() => api.get<InfrastructureGraph>("/graph"), [], { pollMs: 8000 });
  const navigate = useNavigate();

  if (loading || !graph) return <div className="rf-skeleton" style={{ height: 300 }} />;

  const columns = COLUMN_ORDER.map((type) => graph.nodes.filter((n) => n.type === type)).filter((c) => c.length > 0);

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Infrastructure Graph</h1>
          <div className="rf-page-sub">What's running, where, and how it's connected. Click a node to open it.</div>
        </div>
      </div>
      <div className="rf-card" style={{ overflowX: "auto" }}>
        <div className="d-flex gap-4" style={{ minWidth: 900 }}>
          {columns.map((col, i) => (
            <div key={i} className="d-flex flex-column gap-2" style={{ minWidth: 160 }}>
              {col.map((node) => (
                <GraphNodeCard key={node.id} node={node} onClick={() => node.href && navigate(node.href)} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="rf-faint mt-2">
        <i className="bi bi-info-circle me-1" />
        Grouped by layer: domain → Cloudflare → tunnel → server → reverse proxy → application → container → database.
      </div>
    </div>
  );
}

function GraphNodeCard({ node, onClick }: { node: GraphNode; onClick: () => void }) {
  return (
    <div className="rf-graph-node" style={{ cursor: node.href ? "pointer" : "default" }} onClick={onClick}>
      <div className="d-flex align-items-center gap-2">
        <i className={`bi ${TYPE_ICON[node.type] ?? "bi-box"}`} />
        <span className="fw-medium">{node.label}</span>
      </div>
      {node.sublabel && <div className="rf-faint mt-1">{node.sublabel}</div>}
    </div>
  );
}
