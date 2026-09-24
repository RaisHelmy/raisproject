import { useState } from "react";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { StatusBadge, PermissionBadge } from "@/components/StatusBadge";
import { Drawer, DangerConfirmation } from "@/components/Dialogs";
import { ALL_PERMISSIONS } from "@/domain/permissions";
import type { Permission } from "@/domain/types";
import { fmtDate, timeAgo } from "@/utils/format";

export function Users() {
  const { api, toast, can, session } = useApp();
  const { data, loading, error, reload } = useAsync(async () => ({ members: await api.platform.members(), roles: await api.platform.roles(), groups: await api.platform.groups() }), []);
  const [invite, setInvite] = useState(false);
  const [f, setF] = useState({ email: "", name: "", roleIds: ["role_developer"], groupIds: [] as string[] });
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const m = data.members.find((x) => x.id === edit);
  return <div><PageHeader title="Users" subtitle="Membership: INVITED → ACTIVE → SUSPENDED → REMOVED. Roles and groups drive permissions and approval routing." actions={can("user.invite") && <button className="btn btn-primary" onClick={() => setInvite(true)}><i className="bi bi-person-plus me-1" />Invite</button>} />
    <div className="panel"><div className="table-wrap"><table className="table-smcp"><thead><tr><th>User</th><th>Roles</th><th>Groups</th><th>Verification</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>{data.members.map((x) => <tr key={x.id}><td><div className="d-flex align-items-center gap-2"><span className="avatar sm">{x.user.avatarInitials}</span><div><div className="fw-semibold">{x.user.name}{x.userId === session?.user.id && <span className="text-secondary fw-normal small ms-1">(you)</span>}</div><div className="small text-secondary">{x.user.email}</div></div></div></td><td className="small">{x.roleNames.join(", ")}</td><td className="small">{x.groupNames.join(", ") || "—"}</td><td><StatusBadge status={x.user.verification.status} /></td><td><StatusBadge status={x.status} /></td><td className="small text-secondary">{fmtDate(x.createdAt, false)}</td><td>{can("role.manage") && <button className="btn btn-sm btn-outline-secondary" onClick={() => setEdit(x.id)}>Edit</button>}</td></tr>)}</tbody></table></div></div>
    <Drawer open={invite} onClose={() => setInvite(false)} title="Invite user" footer={<button className="btn btn-primary ms-auto" disabled={busy || !f.email} onClick={async () => { setBusy(true); try { await api.platform.invite(f); toast("Invitation sent (in-app; email adapter pending)", "success"); setInvite(false); reload(true); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }}>Send invite</button>}>
      <div className="mb-2"><label className="form-label">Email</label><input className="form-control" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div><div className="mb-2"><label className="form-label">Name</label><input className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="mb-2"><label className="form-label">Roles</label>{data.roles.map((r) => <div className="form-check" key={r.id}><input id={"r" + r.id} className="form-check-input" type="checkbox" checked={f.roleIds.includes(r.id)} onChange={(e) => setF({ ...f, roleIds: e.target.checked ? [...f.roleIds, r.id] : f.roleIds.filter((x) => x !== r.id) })} /><label className="form-check-label" htmlFor={"r" + r.id}>{r.name} <span className="text-secondary small">— {r.description}</span></label></div>)}</div>
      <div className="mb-2"><label className="form-label">Groups</label><div className="d-flex flex-wrap gap-1">{data.groups.map((g) => <button key={g.id} type="button" className={`btn btn-sm ${f.groupIds.includes(g.id) ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setF({ ...f, groupIds: f.groupIds.includes(g.id) ? f.groupIds.filter((x) => x !== g.id) : [...f.groupIds, g.id] })}>{g.name}</button>)}</div></div>
    </Drawer>
    <Drawer open={!!m} onClose={() => setEdit(null)} title={m ? `Edit ${m.user.name}` : ""}>{m && <div>
      <label className="form-label">Roles</label>{data.roles.map((r) => <div className="form-check" key={r.id}><input id={"e" + r.id} className="form-check-input" type="checkbox" checked={m.roleIds.includes(r.id)} onChange={async (e) => { try { await api.platform.updateMembership(m.id, { roleIds: e.target.checked ? [...m.roleIds, r.id] : m.roleIds.filter((x) => x !== r.id) }); reload(true); } catch (err) { toast(errorMessage(err), "error"); } }} /><label className="form-check-label" htmlFor={"e" + r.id}>{r.name}</label></div>)}
      <label className="form-label mt-3">Groups</label><div className="d-flex flex-wrap gap-1">{data.groups.map((g) => <button key={g.id} type="button" className={`btn btn-sm ${m.groupIds.includes(g.id) ? "btn-primary" : "btn-outline-secondary"}`} onClick={async () => { try { await api.platform.updateMembership(m.id, { groupIds: m.groupIds.includes(g.id) ? m.groupIds.filter((x) => x !== g.id) : [...m.groupIds, g.id] }); reload(true); } catch (err) { toast(errorMessage(err), "error"); } }}>{g.name}</button>)}</div>
      <label className="form-label mt-3">Status</label><div className="d-flex gap-1">{(["ACTIVE", "SUSPENDED", "REMOVED"] as const).map((s) => <button key={s} className={`btn btn-sm ${m.status === s ? "btn-primary" : s === "REMOVED" ? "btn-outline-danger" : "btn-outline-secondary"}`} disabled={!can("user.remove") && s === "REMOVED"} onClick={async () => { try { await api.platform.updateMembership(m.id, { status: s }); toast(`Membership ${s.toLowerCase()}`, "success"); reload(true); if (s === "REMOVED") setEdit(null); } catch (err) { toast(errorMessage(err), "error"); } }}>{s}</button>)}</div>
    </div>}</Drawer></div>;
}

export function Groups() {
  const { api, toast, can } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.platform.groups(), []);
  const [name, setName] = useState("");
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  return <div><PageHeader title="Groups" subtitle="Engineering, DevOps, QA, Security, Management, Support — plus custom groups. Groups can be approval targets and policy scopes." />
    <div className="row g-3"><div className="col-lg-8"><div className="panel">{(data ?? []).map((g) => <div key={g.id} className="list-row"><i className="bi bi-people text-secondary" /><div className="flex-grow-1"><div className="title">{g.name}{g.builtIn && <span className="status tone-neutral ms-2">built-in</span>}</div><div className="meta">{g.description ?? ""}{g.memberCount} member(s)</div></div></div>)}</div></div>
      {can("group.manage") && <div className="col-lg-4"><Panel title="New group"><input className="form-control mb-2" placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-primary" disabled={!name.trim()} onClick={async () => { try { await api.platform.saveGroup({ name }); setName(""); toast("Group created", "success"); reload(true); } catch (e) { toast(errorMessage(e), "error"); } }}>Create</button></Panel></div>}</div></div>;
}

export function Roles() {
  const { api, toast, can } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.platform.roles(), []);
  const [sel, setSel] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const [f, setF] = useState({ name: "", description: "", permissions: [] as Permission[] });
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  const role = (data ?? []).find((r) => r.id === sel);
  const groups = [...new Set(ALL_PERMISSIONS.map((p) => p.split(".")[0]))];
  return <div><PageHeader title="Roles" subtitle="Default roles plus custom roles with granular permissions. Authorization is enforced server-side; the UI only hides what you cannot do." actions={can("role.manage") && <button className="btn btn-primary" onClick={() => setCreate(true)}><i className="bi bi-plus-lg me-1" />Custom role</button>} />
    <div className="row g-3"><div className="col-lg-5"><div className="panel">{(data ?? []).map((r) => <button key={r.id} className={`list-row w-100 text-start border-0 bg-transparent${sel === r.id ? " fw-semibold" : ""}`} style={sel === r.id ? { background: "var(--smcp-accent-soft)" } : undefined} onClick={() => setSel(r.id)}><i className="bi bi-person-badge text-secondary" /><div className="flex-grow-1"><div className="title">{r.name}{r.builtIn && <span className="status tone-neutral ms-2">default</span>}</div><div className="meta">{r.description} · {r.permissions.length} permissions · {r.memberCount} member(s)</div></div></button>)}</div></div>
      <div className="col-lg-7">{role ? <Panel title={`${role.name} — permissions`}>{groups.map((g) => { const perms = role.permissions.filter((p) => p.startsWith(g + ".")); if (!perms.length) return null; return <div key={g} className="mb-2"><div className="small text-secondary text-uppercase">{g}</div><div className="d-flex flex-wrap gap-1">{perms.map((p) => <PermissionBadge key={p} permission={p} />)}</div></div>; })}</Panel> : <Panel><EmptyState icon="bi-person-badge" title="Select a role" /></Panel>}</div></div>
    <Drawer open={create} onClose={() => setCreate(false)} title="Custom role" wide footer={<button className="btn btn-primary ms-auto" disabled={busy || !f.name} onClick={async () => { setBusy(true); try { await api.platform.saveRole(f); toast("Role created", "success"); setCreate(false); reload(true); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }}>Create role</button>}>
      <div className="mb-2"><label className="form-label">Name</label><input className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div><div className="mb-3"><label className="form-label">Description</label><input className="form-control" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      {groups.map((g) => <div key={g} className="mb-2"><div className="small text-secondary text-uppercase">{g}</div><div className="d-flex flex-wrap gap-1">{ALL_PERMISSIONS.filter((p) => p.startsWith(g + ".")).map((p) => <button key={p} type="button" className={`btn btn-sm mono ${f.permissions.includes(p) ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setF({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] })}>{p}</button>)}</div></div>)}
    </Drawer></div>;
}

export function Verification() {
  const { api, toast, session, refreshSession, can } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.platform.organization(), []);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const req = async (kind: "ORGANIZATION" | "USER", provider: string) => { setBusy(true); try { await api.platform.requestVerification(kind, provider); toast("Verification requested — status PENDING", "success"); reload(true); refreshSession(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  const V = ({ v }: { v: { status: string; provider?: string; reference?: string; requestedAt?: string; reviewedAt?: string } }) => <dl className="kv"><dt>Status</dt><dd><StatusBadge status={v.status} /></dd><dt>Provider</dt><dd>{v.provider ?? "—"}</dd><dt>Reference</dt><dd className="mono">{v.reference ?? "—"}</dd><dt>Requested</dt><dd>{v.requestedAt ? fmtDate(v.requestedAt) : "—"}</dd><dt>Reviewed</dt><dd>{v.reviewedAt ? fmtDate(v.reviewedAt) : "—"}</dd></dl>;
  return <div><PageHeader title="Verification" subtitle="Personal and company verification are modelled separately. Only provider, reference, status and timestamps are stored — no identity documents." />
    <div className="row g-3"><div className="col-lg-6"><Panel title={`Organization — ${data.name} (${data.type.toLowerCase()})`}><V v={data.verification} />{data.verification.status !== "VERIFIED" && data.verification.status !== "PENDING" && can("organization.manage") && <button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => req("ORGANIZATION", data.type === "COMPANY" ? "SSM" : "email")}>Request {data.type === "COMPANY" ? "company (SSM)" : "personal"} verification</button>}<div className="small text-secondary mt-2"><StatusBadge status="COMING_SOON" label="Provider integration" /> Verification providers are Phase 4; requests are recorded and reviewed manually today.</div></Panel></div>
      <div className="col-lg-6"><Panel title={`You — ${session?.user.name}`}><V v={session!.user.verification} />{session?.user.verification.status !== "VERIFIED" && session?.user.verification.status !== "PENDING" && <button className="btn btn-outline-secondary btn-sm mt-2" disabled={busy} onClick={() => req("USER", "email")}>Verify my identity</button>}</Panel></div></div></div>;
}

export function Settings() {
  const { api, toast, session, refreshSession } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.platform.organization(), []);
  const [busy, setBusy] = useState(false);
  const [danger, setDanger] = useState(false);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const save = async (patch: Parameters<typeof api.platform.updateOrganization>[0]) => { setBusy(true); try { await api.platform.updateOrganization(patch); toast("Settings saved", "success"); reload(true); refreshSession(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  return <div><PageHeader title="Organization settings" subtitle={`${data.name} · ${data.type.toLowerCase()} · plan ${data.planId} · created ${fmtDate(data.createdAt, false)}`} />
    <div className="row g-3"><div className="col-lg-6"><Panel title="General"><label className="form-label">Name</label><div className="input-group mb-3"><input className="form-control" defaultValue={data.name} id="orgname" /><button className="btn btn-outline-secondary" disabled={busy} onClick={() => save({ name: (document.getElementById("orgname") as HTMLInputElement).value })}>Save</button></div>
      <label className="form-label">Approval mode</label><div className="d-flex gap-2">{(["AUTOMATIC", "ROUTED"] as const).map((m) => <button key={m} className={`btn flex-fill ${data.approvalMode === m ? "btn-primary" : "btn-outline-secondary"}`} disabled={busy} onClick={() => save({ approvalMode: m })}>{m === "AUTOMATIC" ? "Fully automatic" : "Approval level routing"}</button>)}</div><div className="form-text">Automatic never bypasses platform policies (production deployment, migration, deletion, credentials still require approval). Personal organizations default to automatic.</div></Panel></div>
      <div className="col-lg-6"><Panel title="Data retention (days)"><div className="row g-2">{(Object.entries(data.retention) as [keyof typeof data.retention, number][]).map(([k, v]) => <div className="col-6" key={k}><label className="form-label small">{k.replace(/([A-Z])/g, " $1").replace(/Days$/, "").trim()}</label><input className="form-control form-control-sm" type="number" defaultValue={v} id={"ret-" + k} /></div>)}</div><button className="btn btn-outline-secondary btn-sm mt-3" disabled={busy} onClick={() => save({ retention: Object.fromEntries(Object.keys(data.retention).map((k) => [k, Number((document.getElementById("ret-" + k) as HTMLInputElement).value)])) as unknown as typeof data.retention })}>Save retention</button><div className="form-text">Configurable defaults, not legal requirements. Aggregated analytics are kept long-term.</div></Panel></div>
      <div className="col-lg-6"><Panel title="Danger zone"><p className="small text-secondary">Deleting the organization schedules removal after the audit retention period, exports remain available until then. Requires typed confirmation.</p><button className="btn btn-outline-danger" onClick={() => setDanger(true)} disabled={!session?.actor.isOwner}>Delete organization…</button></Panel></div></div>
    <DangerConfirmation open={danger} title={`Delete ${data.name}`} phrase={`DELETE ${data.name.toUpperCase()}`} facts={[{ label: "What will be deleted", value: "All changes, tasks, agents, telemetry and members" }, { label: "Retention hold", value: `${data.retention.auditLogDays} days (audit policy)` }, { label: "Backup", value: "Export everything from Data → My Data first" }, { label: "Rollback", value: "Possible during the retention hold" }, { label: "Risk", value: <StatusBadge status="CRITICAL" /> }]} busy={busy} onCancel={() => setDanger(false)} onConfirm={async (typed) => { setBusy(true); try { const r = await api.platform.requestDeletion(typed); toast(`Deletion scheduled for ${fmtDate(r.scheduledFor, false)}`, "info"); setDanger(false); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }} confirmLabel="Schedule deletion" />
    <div className="small text-secondary mt-3">Last updated {timeAgo(data.updatedAt)}</div></div>;
}
