import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AuditLogDTO, HealthDTO, Role, UserDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ErrorAlert, Modal, PageHeader, Pagination, Spinner, StatusBadge, useToast } from "@/components/ui";
import { fmtDateTime, humanize } from "@/services/format";

const TABS = [["users", "Users"], ["settings", "Settings"], ["audit", "Audit Log"], ["health", "Health"]];

export default function AdminPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "users";
  return (
    <div>
      <PageHeader title="Administration" subtitle="Users, roles, system settings, audit and health." />
      <ul className="nav nav-tabs mb-3">{TABS.map(([k, l]) => <li key={k} className="nav-item"><button className={`nav-link${tab === k ? " active" : ""}`} onClick={() => { const n = new URLSearchParams(); n.set("tab", k!); setSp(n); }}>{l}</button></li>)}</ul>
      {tab === "users" && <UsersTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "health" && <HealthTab />}
    </div>
  );
}

const EMPTY_USER = { email: "", name: "", password: "", roles: ["USER"] as Role[], whatsapp_aliases: "", jira_account_id: "", is_active: true };

function UsersTab() {
  const users = useApi<UserDTO[]>("/admin/users");
  const [edit, setEdit] = useState<{ id: string | null; f: typeof EMPTY_USER } | null>(null);
  const act = useAction();
  const toast = useToast();
  const save = async () => {
    if (!edit) return;
    const body: Record<string, unknown> = { email: edit.f.email, name: edit.f.name, roles: edit.f.roles, whatsapp_aliases: edit.f.whatsapp_aliases.split(",").map((s) => s.trim()).filter(Boolean), jira_account_id: edit.f.jira_account_id || null, is_active: edit.f.is_active };
    if (edit.f.password) body.password = edit.f.password;
    const r = await act.run(() => edit.id ? api(`/admin/users/${edit.id}`, { method: "PATCH", body }) : api("/admin/users", { body }));
    if (r) { toast.show("User saved"); setEdit(null); users.reload(); }
  };
  return (
    <Card title="Users" className="p-0" actions={<button className="btn btn-sm btn-primary" onClick={() => setEdit({ id: null, f: EMPTY_USER })}>New user</button>}>
      {!users.data ? <Spinner /> : <div className="table-responsive"><table className="table table-hover align-middle mb-0 data-table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>WhatsApp names</th><th>Jira account</th><th>Status</th><th /></tr></thead><tbody>{users.data.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.roles.map((r) => <span key={r} className="badge text-bg-light border me-1">{r}</span>)}</td><td className="small">{u.whatsapp_aliases.join(", ")}</td><td className="small">{u.jira_account_id ?? "—"}</td><td><StatusBadge value={u.is_active ? "HEALTHY" : "DISCONNECTED"} /></td><td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit({ id: u.id, f: { email: u.email, name: u.name, password: "", roles: u.roles, whatsapp_aliases: u.whatsapp_aliases.join(", "), jira_account_id: u.jira_account_id ?? "", is_active: u.is_active } })}>Edit</button></td></tr>)}</tbody></table></div>}
      {edit && (
        <Modal open title={edit.id ? "Edit user" : "New user"} onClose={() => setEdit(null)} footer={<><button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={act.busy}>Save</button></>}>
          <ErrorAlert error={act.error} />
          <div className="row g-2">
            <div className="col-md-6"><label className="form-label small" htmlFor="u-name">Name</label><input id="u-name" className="form-control form-control-sm" value={edit.f.name} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, name: e.target.value } })} /></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="u-email">Email</label><input id="u-email" type="email" className="form-control form-control-sm" value={edit.f.email} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, email: e.target.value } })} /></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="u-pw">{edit.id ? "New password (leave blank to keep)" : "Password (min 10 chars)"}</label><input id="u-pw" type="password" className="form-control form-control-sm" value={edit.f.password} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, password: e.target.value } })} autoComplete="new-password" /></div>
            <div className="col-md-6"><label className="form-label small">Roles</label><div className="d-flex gap-3 pt-1">{(["ADMIN", "APPROVER", "USER"] as Role[]).map((r) => <div key={r} className="form-check"><input className="form-check-input" type="checkbox" id={`r-${r}`} checked={edit.f.roles.includes(r)} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, roles: e.target.checked ? [...edit.f.roles, r] : edit.f.roles.filter((x) => x !== r) } })} /><label className="form-check-label" htmlFor={`r-${r}`}>{humanize(r)}</label></div>)}</div></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="u-al">WhatsApp names</label><input id="u-al" className="form-control form-control-sm" value={edit.f.whatsapp_aliases} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, whatsapp_aliases: e.target.value } })} /></div>
            <div className="col-md-6"><label className="form-label small" htmlFor="u-jira">Jira account id</label><input id="u-jira" className="form-control form-control-sm" value={edit.f.jira_account_id} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, jira_account_id: e.target.value } })} /></div>
            <div className="col-12"><div className="form-check"><input className="form-check-input" type="checkbox" id="u-active" checked={edit.f.is_active} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, is_active: e.target.checked } })} /><label className="form-check-label" htmlFor="u-active">Active</label></div></div>
          </div>
        </Modal>
      )}
      {toast.node}
    </Card>
  );
}

function SettingsTab() {
  const s = useApi<{ settings: Record<string, unknown>; retention: { raw_import_days: number; report_days: number; audit_days: number }; ai: { provider: string; model: string; api_key_configured: boolean; external?: boolean }; jira_mode: string; job_mode: string; max_upload_bytes: number }>("/admin/settings");
  const act = useAction();
  const toast = useToast();
  const [ret, setRet] = useState<{ raw_import_days: number; report_days: number; audit_days: number } | null>(null);
  const r = ret ?? s.data?.retention ?? null;
  const save = async (key: string, value: unknown) => { const x = await act.run(() => api(`/admin/settings/${key}`, { method: "PUT", body: { value } })); if (x) { toast.show("Setting saved"); s.reload(); } };
  if (!s.data || !r) return <Spinner />;
  const failMode = String(s.data.settings["demo.jira_failure_mode"] ?? "none");
  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <Card title="Data retention" className="mb-3">
          <p className="small text-secondary">0 = keep forever. Official timesheet and approval records are never deleted automatically.</p>
          {[["raw_import_days", "Raw WhatsApp files (days)"], ["report_days", "Generated reports (days)"], ["audit_days", "Audit log (days)"]].map(([k, l]) => <div key={k} className="mb-2"><label className="form-label small mb-0" htmlFor={k}>{l}</label><input id={k} type="number" min={0} className="form-control form-control-sm" value={r[k as keyof typeof r]} onChange={(e) => setRet({ ...r, [k!]: Number(e.target.value) })} /></div>)}
          <ErrorAlert error={act.error} />
          <button className="btn btn-sm btn-primary mt-2" onClick={() => save("retention", r)} disabled={act.busy}>Save retention</button>
        </Card>
        {s.data.jira_mode === "demo" && <Card title="Demo controls">
          <label className="form-label small" htmlFor="fail">Jira demo failure simulation</label>
          <select id="fail" className="form-select form-select-sm mb-2" value={failMode} onChange={(e) => save("demo.jira_failure_mode", e.target.value)}><option value="none">None — demo Jira works normally</option><option value="next_create">Fail the next issue creation (retry scenario)</option><option value="always">Fail every Jira write</option></select>
          <div className="form-text">Only affects the built-in demo adapter. Use it to demonstrate Sync Errors and automatic retry.</div>
        </Card>}
      </div>
      <div className="col-lg-6">
        <Card title="Integrations (server configuration)">
          <dl className="row mb-0 small">
            <dt className="col-5">AI provider</dt><dd className="col-7">{s.data.ai.provider} {s.data.ai.external ? <span className="badge text-bg-success">Claude via MCP</span> : s.data.ai.api_key_configured ? <span className="badge text-bg-success">API key set</span> : <span className="badge text-bg-info">Demo (heuristic)</span>}<div className="text-secondary">Model: {s.data.ai.model}</div></dd>
            <dt className="col-5">Jira mode</dt><dd className="col-7">{s.data.jira_mode}</dd>
            <dt className="col-5">Job mode</dt><dd className="col-7">{s.data.job_mode}</dd>
            <dt className="col-5">Max upload</dt><dd className="col-7">{Math.round(s.data.max_upload_bytes / 1048576)} MB</dd>
          </dl>
          <p className="small text-secondary mt-3 mb-0">These come from <code>wrangler.jsonc</code> vars and secrets (<code>wrangler secret put ANTHROPIC_API_KEY</code>, <code>JIRA_OAUTH_CLIENT_ID</code>, …). See docs/deployment.md.</p>
        </Card>
      </div>
      {toast.node}
    </div>
  );
}

function AuditTab() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") ?? "1");
  const [f, setF] = useState({ entity_type: "", action: "", from: "", to: "" });
  const list = useApi<{ items: AuditLogDTO[]; total: number; page: number; page_size: number }>("/admin/audit", { page, ...f });
  return (
    <Card title="Audit log" className="p-0">
      <div className="p-3 border-bottom d-flex flex-wrap gap-2">
        <select className="form-select form-select-sm" style={{ width: 180 }} value={f.entity_type} onChange={(e) => setF({ ...f, entity_type: e.target.value })} aria-label="Entity"><option value="">All entities</option>{["timesheet", "import", "work_item", "jira_link", "jira_issue", "sync_job", "user", "project", "client", "settings", "jira_connection", "report", "session"].map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</select>
        <input className="form-control form-control-sm" style={{ width: 180 }} placeholder="Action contains…" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="Action" />
        <input type="date" className="form-control form-control-sm" style={{ width: 160 }} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From" />
        <input type="date" className="form-control form-control-sm" style={{ width: 160 }} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To" />
      </div>
      {!list.data ? <Spinner /> : <><div className="table-responsive"><table className="table table-sm align-middle mb-0 data-table"><thead><tr><th>When</th><th>Who</th><th>Entity</th><th>Action</th><th>Source</th><th>Details</th></tr></thead><tbody>{list.data.items.map((a) => <tr key={a.id}><td className="text-nowrap">{fmtDateTime(a.created_at)}</td><td>{a.actor_name ?? "System"}</td><td><span className="badge text-bg-light border">{a.entity_type}</span> <span className="small text-secondary">{a.entity_id.slice(0, 8)}</span></td><td>{humanize(a.action)}</td><td>{a.source}</td><td className="small">{a.reason && <div>Reason: {a.reason}</div>}{(a.before || a.after) && <details><summary className="text-primary" style={{ cursor: "pointer" }}>Before / after</summary><pre className="small mb-0" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ before: a.before, after: a.after }, null, 1)}</pre></details>}</td></tr>)}</tbody></table></div><div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => { const n = new URLSearchParams(sp); n.set("page", String(p)); setSp(n); }} /></div></>}
    </Card>
  );
}

function HealthTab() {
  const h = useApi<HealthDTO>("/admin/health", undefined, { poll: 30000 });
  if (h.error) return <ErrorAlert error={h.error} onRetry={h.reload} />;
  if (!h.data) return <Spinner />;
  const labels: Record<string, string> = { application: "Application", database: "Database", r2: "R2", queue: "Queue", ai: "AI", jira: "Jira" };
  return (
    <Card title={<>System health <StatusBadge value={h.data.status === "ok" ? "HEALTHY" : "DEGRADED"} className="ms-2" /></>} actions={<span className="small text-secondary">v{h.data.version}</span>}>
      <table className="table align-middle mb-0"><tbody>{Object.entries(h.data.checks).map(([k, v]) => <tr key={k}><td style={{ width: 160 }}><strong>{labels[k] ?? humanize(k)}</strong></td><td><StatusBadge value={v.status === "healthy" ? "HEALTHY" : v.status === "degraded" ? "DEGRADED" : "DEMO"} /></td><td className="small text-secondary">{v.detail}{v.last_ok_at && <div>Last successful connection: {fmtDateTime(v.last_ok_at)}</div>}</td></tr>)}</tbody></table>
    </Card>
  );
}
