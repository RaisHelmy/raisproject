import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/app/providers";
import type { CommandResult } from "@/domain/services";

const SUGGESTIONS = ["Deploy Claims Portal v2.8 to Production", "Create a .NET project called notification-service with CQRS", "Check all servers", "Why is production slow?", "Fix the failed Docker container", "What is blocking my release?", "Show pending approvals", "Generate monthly engineering report", "Optimize AI calls", "Add two-factor login to the customer portal"];
const PAGES: { label: string; href: string; icon: string; keywords: string }[] = [
  { label: "Dashboard", href: "/", icon: "bi-grid-1x2", keywords: "home" }, { label: "Start a Change", href: "/changes/new", icon: "bi-plus-circle", keywords: "new create intent" }, { label: "All Changes", href: "/changes", icon: "bi-arrow-left-right", keywords: "changes" }, { label: "Tasks", href: "/tasks", icon: "bi-gear", keywords: "task engine" },
  { label: "Approvals", href: "/approvals", icon: "bi-person-check", keywords: "approve" }, { label: "Agents", href: "/agents", icon: "bi-hdd-network", keywords: "agent health" }, { label: "Environments", href: "/infrastructure/environments", icon: "bi-diagram-3", keywords: "servers vms" }, { label: "Deployments", href: "/infrastructure/deployments", icon: "bi-rocket-takeoff", keywords: "deploy" },
  { label: "Incidents", href: "/incidents", icon: "bi-exclamation-triangle", keywords: "incident" }, { label: "Policies", href: "/security/policies", icon: "bi-shield-lock", keywords: "policy simulator" }, { label: "Audit Logs", href: "/security/audit", icon: "bi-journal-text", keywords: "audit" }, { label: "AI Optimization", href: "/ai/optimization", icon: "bi-lightning", keywords: "ai calls optimize" },
  { label: "AI Usage", href: "/ai/usage", icon: "bi-robot", keywords: "ai runs" }, { label: "Execution Analytics", href: "/ai/execution", icon: "bi-diagram-2", keywords: "mcp calls explorer trace" }, { label: "Learning Data", href: "/ai/learning", icon: "bi-mortarboard", keywords: "patterns knowledge" }, { label: "Git", href: "/devops/git", icon: "bi-git", keywords: "github gitlab connect" },
  { label: "Jira", href: "/work/jira", icon: "bi-kanban", keywords: "jira" }, { label: "Reports", href: "/work/reports", icon: "bi-file-earmark-bar-graph", keywords: "report" }, { label: "Marketplace", href: "/automations/marketplace", icon: "bi-shop", keywords: "automation" }, { label: "Users", href: "/organization/users", icon: "bi-people", keywords: "members invite" },
  { label: "Billing", href: "/billing", icon: "bi-credit-card", keywords: "plan usage invoices" }, { label: "Demo Lab", href: "/demo-lab", icon: "bi-flask", keywords: "demo scenario" }, { label: "My Data", href: "/data", icon: "bi-download", keywords: "export" }, { label: "Connected AI", href: "/ai/connected", icon: "bi-plug", keywords: "mcp claude chatgpt" },
];

export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { api, toast } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setResult(null); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pages = PAGES.filter((p) => !t || p.label.toLowerCase().includes(t) || p.keywords.includes(t)).slice(0, 6).map((p) => ({ kind: "page" as const, ...p }));
    const sugg = SUGGESTIONS.filter((s) => !t || s.toLowerCase().includes(t)).slice(0, 6).map((s) => ({ kind: "ask" as const, label: s, href: "", icon: "bi-robot", keywords: "" }));
    const ask = t.length > 3 && !sugg.some((s) => s.label.toLowerCase() === t) ? [{ kind: "ask" as const, label: q.trim(), href: "", icon: "bi-stars", keywords: "" }] : [];
    return [...ask, ...pages, ...sugg];
  }, [q]);
  const run = async (item: (typeof items)[number]) => {
    if (item.kind === "page") { nav(item.href); onClose(); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api.command(item.label);
      setResult(r);
      if (r.kind === "NAVIGATE") { nav(r.href); onClose(); }
      else if (r.kind === "PLAN") { nav(`/changes/new?intent=${encodeURIComponent(r.intent)}`); onClose(); }
      else if (r.kind === "TASK" || r.kind === "CHANGE_DEPLOY") { toast(r.message, "success"); nav(r.href); onClose(); }
    } catch (e) { setResult({ kind: "UNKNOWN", message: (e as Error).message, aiRunId: "" }); }
    finally { setBusy(false); }
  };
  if (!open) return null;
  return <div className="cmd-backdrop" onClick={onClose}><div className="cmd-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command center">
    <input ref={inputRef} className="cmd-input" placeholder="Ask Super MCP or jump to a page… (e.g. “Deploy my API to VM 103”)" value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); } if (e.key === "Enter" && items[active]) run(items[active]); if (e.key === "Escape") onClose(); }} aria-label="Command input" />
    <div className="cmd-list" role="listbox">
      {busy && <div className="p-3 text-secondary"><i className="bi bi-arrow-repeat spin me-2" />Interpreting intent → policy → task…</div>}
      {result && (result.kind === "ANSWER" || result.kind === "UNKNOWN") && <div className="p-3" style={{ background: "var(--smcp-surface-2)" }}><div className="d-flex gap-2"><i className="bi bi-robot text-primary" /><div>{result.message}{result.kind === "ANSWER" && result.href && <div className="mt-1"><button className="btn btn-sm btn-outline-secondary" onClick={() => { nav(result.href!); onClose(); }}>Open</button></div>}</div></div></div>}
      {!busy && items.map((it, i) => <div key={it.kind + it.label} className={`cmd-item${i === active ? " active" : ""}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => run(it)}><i className={`bi ${it.icon}`} /><span>{it.label}</span><span className="kind">{it.kind === "page" ? "Go to" : "Ask AI"}</span></div>)}
    </div>
    <div className="px-3 py-2 small text-secondary border-top d-flex justify-content-between"><span>↑↓ navigate · ⏎ run · esc close</span><span>Natural-language commands are governed: intent → policy → approval → Task Engine</span></div>
  </div></div>;
}
