import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { JiraConnectionDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ConfirmModal, ErrorAlert, KeyValue, PageHeader, Spinner, StatusBadge, useToast } from "@/components/ui";
import { fmtDateTime } from "@/services/format";
import { useAuth } from "@/services/auth";

export default function JiraConnectionPage() {
  // `refresh` re-fetches /auth/me, which is what feeds the "Demo mode"
  // banner's `demo.jira` flag in AppLayout. Connecting/disconnecting Jira
  // changes that flag server-side, but the auth context is otherwise only
  // loaded once on mount — without this the banner keeps claiming Jira is
  // in demo mode until the user does a full page reload.
  const { isAdmin, refresh: refreshAuth } = useAuth();
  const [sp] = useSearchParams();
  const c = useApi<JiraConnectionDTO & { oauth_available: boolean }>("/jira/connection");
  const act = useAction();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState({ site_url: "", email: "", api_token: "" });
  const [showToken, setShowToken] = useState(false);
  const test = async () => { const r = await act.run(() => api<{ ok: boolean; error: string | null; demo: boolean; account: { display_name: string } | null }>("/jira/connection/test", { body: {} })); if (r) { toast.show(r.data.ok ? `Connection healthy${r.data.demo ? " (demo adapter)" : ` · ${r.data.account?.display_name}`}` : `Connection failed: ${r.data.error}`, r.data.ok ? "success" : "danger"); c.reload(); } };
  const sync = async () => { const r = await act.run(() => api<{ issues: number }>("/jira/sync", { body: {} })); if (r) { toast.show(`Synchronised ${r.data.issues} issues`); c.reload(); } };
  const disconnect = async () => { const r = await act.run(() => api("/jira/connection/disconnect", { body: {} })); setConfirm(false); if (r) { toast.show("Disconnected. Demo mode is now active.", "info"); c.reload(); void refreshAuth(); } };
  const connectToken = async () => { const r = await act.run(() => api("/jira/connection/api-token", { body: form })); if (r) { toast.show("Jira connected"); setForm({ site_url: "", email: "", api_token: "" }); c.reload(); void refreshAuth(); } };
  const startOauth = async () => { const r = await act.run(() => api<{ url: string }>("/jira/oauth/start")); if (r) window.location.href = r.data.url; };
  if (c.error) return <ErrorAlert error={c.error} onRetry={c.reload} />;
  if (!c.data) return <Spinner />;
  const d = c.data;
  const err = sp.get("error");
  return (
    <div>
      <PageHeader title="Jira Connection" subtitle="The server talks to Jira on your behalf. Credentials never reach the browser." actions={<><button className="btn btn-outline-secondary" onClick={test} disabled={act.busy || !isAdmin}>Test connection</button><button className="btn btn-outline-primary" onClick={sync} disabled={act.busy}>Sync now</button>{d.configured && isAdmin && <button className="btn btn-outline-danger" onClick={() => setConfirm(true)}>Disconnect</button>}</>} />
      {sp.get("connected") === "1" && <div className="alert alert-success">Jira connected successfully.</div>}
      {err && <div className="alert alert-danger">Jira connection failed ({err.replace(/_/g, " ")}). Please try again.</div>}
      <ErrorAlert error={act.error} />
      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Jira">
            {d.demo_mode && <div className="alert alert-info py-2"><i className="bi bi-info-circle me-1" /><strong>Jira connection is not configured.</strong> Demo mode is active — issues live in the built-in demo adapter and nothing is sent to a real Jira site.</div>}
            <KeyValue items={[{ label: "Status", value: <><StatusBadge value={d.status} />{d.status === "HEALTHY" && <span className="ms-2">Connected ✓</span>}</> }, { label: "Account", value: d.account_name ?? "—" }, { label: "Site", value: d.site_url ?? "—" }, { label: "Auth", value: d.auth_type ?? "—" }, { label: "Projects", value: d.project_keys.join(", ") || "None configured" }, { label: "Last sync", value: fmtDateTime(d.last_sync_at) }, { label: "Last healthy", value: fmtDateTime(d.last_successful_connection_at) }, ...(d.last_error ? [{ label: "Last error", value: <span className="text-danger">{d.last_error}</span> }] : [])]} />
          </Card>
        </div>
        {isAdmin && (
          <div className="col-lg-6">
            <Card title="Connect Jira Cloud" className="mb-3">
              <p className="small text-secondary">Recommended: OAuth 2.0. Requires <code>JIRA_OAUTH_CLIENT_ID</code> and <code>JIRA_OAUTH_CLIENT_SECRET</code> secrets on the server.</p>
              <button className="btn btn-primary" onClick={startOauth} disabled={!d.oauth_available || act.busy}><i className="bi bi-shield-check me-1" />Connect with Atlassian OAuth</button>
              {!d.oauth_available && <div className="form-text">OAuth is not configured on the server. Use an API token below, or see docs/jira.md.</div>}
            </Card>
            <Card title="Or use an API token">
              <div className="mb-2"><label className="form-label small" htmlFor="site">Site URL</label><input id="site" className="form-control form-control-sm" placeholder="https://your-site.atlassian.net" value={form.site_url} onChange={(e) => setForm({ ...form, site_url: e.target.value })} /></div>
              <div className="mb-2"><label className="form-label small" htmlFor="email">Atlassian email</label><input id="email" type="email" className="form-control form-control-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="mb-3"><label className="form-label small" htmlFor="tok">API token</label><div className="input-group input-group-sm"><input id="tok" type={showToken ? "text" : "password"} className="form-control" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} autoComplete="off" /><button className="btn btn-outline-secondary" type="button" onClick={() => setShowToken((s) => !s)}>{showToken ? "Hide" : "Show"}</button></div><div className="form-text">Stored encrypted (AES-256-GCM). Never returned to the browser again.</div></div>
              <button className="btn btn-outline-primary" onClick={connectToken} disabled={act.busy || !form.site_url || !form.email || !form.api_token}>Connect with API token</button>
            </Card>
          </div>
        )}
      </div>
      <ConfirmModal open={confirm} title="Disconnect Jira?" tone="danger" confirmLabel="Disconnect" onConfirm={disconnect} onClose={() => setConfirm(false)} busy={act.busy} body={<p>Stored credentials will be deactivated and the application will fall back to demo mode. Existing links and audit records are kept.</p>} />
      {toast.node}
    </div>
  );
}
