import { useEffect, useState } from "react";
import type { OrganizationDTO } from "@xuanzhi/shared-types";
import { api, ApiError } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT } from "@/i18n";
import { useToast } from "@/services/toast";
import { Chart } from "@/components/Charts";
import { Modal, fmtDate } from "@/components/ui";
import { UpgradeDialog } from "@/components/UpgradeDialog";

interface ApiKey { id: string; name: string; key_prefix: string; last_used_at: string | null; created_at: string }
export default function SettingsPage() {
  const { t, locale } = useT(); const toast = useToast(); const { me, refresh } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]); const [keyName, setKeyName] = useState(""); const [newKey, setNewKey] = useState<string | null>(null); const [upgrade, setUpgrade] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationDTO[]>([]); const [orgName, setOrgName] = useState(""); const [members, setMembers] = useState<{ org: OrganizationDTO; list: { user_id: string; email: string; name: string; role: string }[] } | null>(null); const [memberEmail, setMemberEmail] = useState("");
  const [usage, setUsage] = useState<{ day: string; requests: number; tokens: number }[]>([]);
  const load = () => { api<ApiKey[]>("/account/api-keys").then((r) => setKeys(r.data)).catch(() => undefined); api<OrganizationDTO[]>("/account/organizations").then((r) => setOrgs(r.data)).catch(() => undefined); api<{ daily: typeof usage }>("/account/usage").then((r) => setUsage(r.data.daily)).catch(() => undefined); };
  useEffect(load, []);
  const createKey = async () => { try { const r = await api<{ key: string }>("/account/api-keys", { body: { name: keyName || "Key" } }); setNewKey(r.data.key); setKeyName(""); load(); } catch (e) { if (e instanceof ApiError && e.code === "UPGRADE_REQUIRED") setUpgrade(true); else toast.error((e as Error).message); } };
  const openMembers = async (org: OrganizationDTO) => { const r = await api<{ user_id: string; email: string; name: string; role: string }[]>(`/account/organizations/${org.id}/members`); setMembers({ org, list: r.data }); };
  return (
    <div className="xz-page" style={{ maxWidth: 860 }}>
      <h1 className="h2 mb-3">{t("settings.title")}</h1>
      <div className="card p-4 mb-3"><h2 className="h5">{t("settings.usage")}</h2><Chart type="column" height={200} categories={usage.map((u) => u.day.slice(5))} series={[{ name: t("sub.messages"), data: usage.map((u) => u.requests) }]} /></div>
      <div className="card p-4 mb-3"><h2 className="h5 mb-1">{t("settings.api_keys")}</h2><p className="text-muted fs-14">{t("settings.api_keys_body")}</p>
        <div className="d-flex gap-2 mb-3"><input className="form-control" placeholder={t("settings.key_name")} value={keyName} onChange={(e) => setKeyName(e.target.value)} /><button className="btn btn-outline-primary text-nowrap" onClick={createKey}>{t("settings.create_key")}</button></div>
        {keys.length > 0 && <table className="table table-sm fs-14 mb-0"><thead><tr><th>{t("common.name")}</th><th>Prefix</th><th>{t("common.created")}</th><th /></tr></thead><tbody>{keys.map((k) => <tr key={k.id}><td>{k.name}</td><td><code>{k.key_prefix}…</code></td><td>{fmtDate(k.created_at, locale)}</td><td className="text-end"><button className="btn btn-link btn-sm text-danger p-0" onClick={async () => { await api(`/account/api-keys/${k.id}`, { method: "DELETE" }); load(); }}>{t("settings.revoke")}</button></td></tr>)}</tbody></table>}
      </div>
      <div className="card p-4 mb-3"><h2 className="h5 mb-3">{t("settings.organizations")}</h2>
        {orgs.map((o) => <div key={o.id} className="d-flex align-items-center gap-2 border rounded p-2 mb-2"><i className="bi bi-building text-faint" /><span className="fw-medium">{o.name}</span><span className="badge badge-soft">{o.role}</span>{o.plan_code && <span className="badge badge-cinnabar">{o.plan_code}</span>}<button className="btn btn-ghost btn-sm ms-auto" onClick={() => openMembers(o)}>{t("settings.members")} ({o.member_count})</button></div>)}
        <div className="d-flex gap-2"><input className="form-control" placeholder={t("common.name")} value={orgName} onChange={(e) => setOrgName(e.target.value)} /><button className="btn btn-outline-primary text-nowrap" onClick={async () => { try { await api("/account/organizations", { body: { name: orgName } }); setOrgName(""); load(); await refresh(); } catch (e) { toast.error((e as Error).message); } }}>{t("settings.create_org")}</button></div>
      </div>
      {me && <div className="card p-4"><h2 className="h5 mb-2">{t("settings.linked")}</h2><div className="text-muted fs-14">{me.features.auth_method === "session" ? "Session" : "API key"} · {me.user.email}</div></div>}
      <Modal open={!!newKey} onClose={() => setNewKey(null)} title={t("settings.create_key")} size="sm"><p className="fs-14 text-muted">Copy this key now. It will not be shown again.</p><code className="d-block p-2 border rounded user-select-all" style={{ wordBreak: "break-all" }}>{newKey}</code></Modal>
      <Modal open={!!members} onClose={() => setMembers(null)} title={members?.org.name ?? ""}>
        {members && <>{members.list.map((m) => <div key={m.user_id} className="d-flex align-items-center gap-2 py-1 border-bottom fs-14"><span>{m.name}</span><span className="text-muted">{m.email}</span><span className="badge badge-soft ms-auto">{m.role}</span>{m.role !== "owner" && <button className="btn btn-link btn-sm text-danger p-0" onClick={async () => { await api(`/account/organizations/${members.org.id}/members/${m.user_id}`, { method: "DELETE" }); openMembers(members.org); }}><i className="bi bi-x" /></button>}</div>)}
          <div className="d-flex gap-2 mt-3"><input className="form-control" placeholder="email@example.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} /><button className="btn btn-outline-primary text-nowrap" onClick={async () => { try { await api(`/account/organizations/${members.org.id}/members`, { body: { email: memberEmail } }); setMemberEmail(""); openMembers(members.org); } catch (e) { toast.error((e as Error).message); } }}>{t("settings.add_member")}</button></div></>}
      </Modal>
      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} requiredPlan="enterprise" />
    </div>
  );
}
