import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/services/auth";
import { api } from "@/services/api";
import { useApi, useAction } from "@/hooks/useApi";
import { Card, ErrorAlert, PageHeader, useToast } from "@/components/ui";
import { fmtDateTime } from "@/services/format";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const act = useAction();
  const pw = useAction();
  const tok = useAction();
  const toast = useToast();
  const [f, setF] = useState({ name: "", timezone: "Asia/Kuala_Lumpur", aliases: "", jira_account_id: "" });
  const [p, setP] = useState({ current: "", next: "", confirm: "" });
  const tokens = useApi<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/auth/api-tokens");
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [tokenName, setTokenName] = useState("MCP");
  useEffect(() => { if (user) setF({ name: user.name, timezone: user.timezone, aliases: user.whatsapp_aliases.join(", "), jira_account_id: user.jira_account_id ?? "" }); }, [user]);

  const save = async (e: FormEvent) => { e.preventDefault(); const r = await act.run(() => api("/auth/profile", { method: "PATCH", body: { name: f.name, timezone: f.timezone, whatsapp_aliases: f.aliases.split(",").map((s) => s.trim()).filter(Boolean), jira_account_id: f.jira_account_id || null } })); if (r) { toast.show("Profile saved"); await refresh(); } };
  const changePw = async (e: FormEvent) => { e.preventDefault(); if (p.next !== p.confirm) { toast.show("New passwords don't match", "danger"); return; } const r = await pw.run(() => api("/auth/change-password", { body: { current_password: p.current, new_password: p.next } })); if (r) { toast.show("Password changed"); setP({ current: "", next: "", confirm: "" }); } };
  const createToken = async () => { const r = await tok.run(() => api<{ id: string; token: string }>("/auth/api-tokens", { body: { name: tokenName } })); if (r) { setNewToken({ name: tokenName, token: r.data.token }); tokens.reload(); } };
  const revoke = async (id: string) => { await tok.run(() => api(`/auth/api-tokens/${id}`, { method: "DELETE" })); tokens.reload(); };

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your name, WhatsApp identity and Jira account drive how work is attributed to you." />
      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Identity" className="mb-3">
            <form onSubmit={save}>
              <div className="mb-3"><label className="form-label" htmlFor="name">Name</label><input id="name" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
              <div className="mb-3"><label className="form-label" htmlFor="aliases">WhatsApp names</label><input id="aliases" className="form-control" value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} placeholder="Rais, Rais Helmy" /><div className="form-text">Comma-separated. The assistant treats messages from these senders as your work.</div></div>
              <div className="mb-3"><label className="form-label" htmlFor="jira">Jira account id</label><input id="jira" className="form-control" value={f.jira_account_id} onChange={(e) => setF({ ...f, jira_account_id: e.target.value })} placeholder="e.g. 5b10ac8d82e05b22cc7d4ef5" /><div className="form-text">Used for “My tasks”, assignee matching and default assignment when creating Jira issues.</div></div>
              <div className="mb-3"><label className="form-label" htmlFor="tz">Timezone</label><select id="tz" className="form-select" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{["Asia/Kuala_Lumpur", "Asia/Singapore", "Asia/Jakarta", "Asia/Bangkok", "Asia/Dubai", "Europe/London", "UTC"].map((z) => <option key={z}>{z}</option>)}</select></div>
              <ErrorAlert error={act.error} />
              <button className="btn btn-primary" disabled={act.busy}>Save profile</button>
              <div className="small text-secondary mt-3">Email: {user?.email} · Roles: {user?.roles.join(", ")}</div>
            </form>
          </Card>
          <Card title="Change password">
            <form onSubmit={changePw}>
              <div className="mb-2"><label className="form-label small" htmlFor="cur">Current password</label><input id="cur" type="password" className="form-control form-control-sm" value={p.current} onChange={(e) => setP({ ...p, current: e.target.value })} autoComplete="current-password" required /></div>
              <div className="row g-2 mb-3"><div className="col"><label className="form-label small" htmlFor="new">New password</label><input id="new" type="password" className="form-control form-control-sm" value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} minLength={10} autoComplete="new-password" required /></div><div className="col"><label className="form-label small" htmlFor="conf">Confirm</label><input id="conf" type="password" className="form-control form-control-sm" value={p.confirm} onChange={(e) => setP({ ...p, confirm: e.target.value })} autoComplete="new-password" required /></div></div>
              <ErrorAlert error={pw.error} />
              <button className="btn btn-outline-primary btn-sm" disabled={pw.busy}>Change password</button>
            </form>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="API tokens (MCP & integrations)">
            <p className="small text-secondary">Personal tokens let the Python MCP server and other tools act as you. Tokens are shown once.</p>
            {newToken && <div className="alert alert-success"><div className="fw-semibold">Token “{newToken.name}” created — copy it now</div><code className="d-block text-break mt-1">{newToken.token}</code><button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => navigator.clipboard?.writeText(newToken.token)}>Copy</button></div>}
            <div className="input-group input-group-sm mb-3"><input className="form-control" value={tokenName} onChange={(e) => setTokenName(e.target.value)} aria-label="Token name" /><button className="btn btn-primary" onClick={createToken} disabled={tok.busy || !tokenName}>Create token</button></div>
            <ErrorAlert error={tok.error} />
            {tokens.data?.length ? <ul className="list-group list-group-flush">{tokens.data.map((t) => <li key={t.id} className="list-group-item d-flex justify-content-between align-items-center px-0"><div><strong>{t.name}</strong><div className="small text-secondary">Created {fmtDateTime(t.created_at)} · last used {t.last_used_at ? fmtDateTime(t.last_used_at) : "never"}</div></div><button className="btn btn-sm btn-outline-danger" onClick={() => revoke(t.id)}>Revoke</button></li>)}</ul> : <div className="small text-secondary">No tokens yet.</div>}
          </Card>
        </div>
      </div>
      {toast.node}
    </div>
  );
}
