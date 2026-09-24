import { Link } from "react-router-dom";

export interface GraphNode { label: string; tone?: "ok" | "warn" | "bad" | "ai"; href?: string; icon?: string; title?: string }

export function ExecutionGraph({ nodes }: { nodes: GraphNode[] }) {
  return <div className="exec-graph" role="list" aria-label="Execution graph">
    {nodes.map((n, i) => <span key={i} className="d-inline-flex align-items-center gap-2" role="listitem">
      {n.href ? <Link className={`exec-node ${n.tone ?? ""}`} to={n.href} title={n.title}>{n.icon && <i className={`bi ${n.icon}`} />}{n.label}</Link> : <span className={`exec-node ${n.tone ?? ""}`} title={n.title}>{n.icon && <i className={`bi ${n.icon}`} />}{n.label}</span>}
      {i < nodes.length - 1 && <i className="bi bi-arrow-right exec-arrow" aria-hidden />}
    </span>)}
  </div>;
}
