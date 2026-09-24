import { useState } from "react";
import type { OrganizationDTO, PlanDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { Modal, Pager, Field } from "@/components/ui";
import { useT } from "@/i18n";

type Row = OrganizationDTO & { owner_email: string };
export default function OrganizationsPage() {
  const { t } = useT(); const toast = useToast(); const [page, setPage] = useState(1); const [search, setSearch] = useState("");
  const { data, reload } = useLoad<{ items: Row[]; total: number }>("/admin/organizations", { search, page, page_size: 25 }); const plans = useLoad<PlanDTO[]>("/admin/plans").data ?? [];
  const [create, setCreate] = useState(false); const [form, setForm] = useState({ name: "", slug: "", owner_email: "", plan_id: "" });
  const [members, setMembers] = useState<{ org: Row; list: { user_id: string; email: string; name: string; role: string }[] } | null>(null); const [memberEmail, setMemberEmail] = useState(""); const [memberRole, setMemberRole] = useState("member");
  const openMembers = async (org: Row) => { const r = await api<{ user_id: string; email: string; name: string; role: string }[]>(`/admin/organizations/${org.id}/members`); setMembers({ org, list: r.data }); };
  return (
    <>
      <PageHeader title={t("admin.organizations")} actions={<><input className="form-control form-control-sm" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn btn-primary btn-sm text-nowrap" onClick={() => setCreate(true)}><i className="bi bi-plus-lg me-1" />{t("common.create")}</button></>} />
      <div className="card"><div className="table-responsive"><table className="table table-hover mb-0 fs-14"><thead><tr><th>{t("common.name")}</th><th>Slug</th><th>Owner</th><th>Plan</th><th>Members</th><th /></tr></thead>
        <tbody>{data?.items.map((o) => <tr key={o.id}><td>{o.name}</td><td className="text-muted">{o.slug}</td><td>{o.owner_email}</td><td><select className="form-select form-select-sm w-auto" value={plans.find((p) => p.code === o.plan_code)?.id ?? ""} onChange={async (e) => { await api(`/admin/organizations/${o.id}`, { method: "PATCH", body: { plan_id: e.target.value || null } }); reload(); toast.success(t("profile.saved")); }}><option value="">{t("common.none")}</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td>{o.member_count}</td><td className="text-end"><button className="btn btn-ghost btn-sm" onClick={() => openMembers(o)}><i className="bi bi-people" /></button></td></tr>)}</tbody></table></div></div>
      {data && <Pager page={page} pageSize={25} total={data.total} onPage={setPage} />}
      <Modal open={create} onClose={() => setCreate(false)} title={t("settings.create_org")} footer={<button className="btn btn-primary btn-sm" onClick={async () => { try { await api("/admin/organizations", { body: { ...form, plan_id: form.plan_id || null } }); setCreate(false); reload(); } catch (e) { toast.error((e as Error).message); } }}>{t("common.create")}</button>}>
        <Field label={t("common.name")}><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></Field>
        <Field label="Slug"><input className="form-control" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Owner email"><input className="form-control" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} /></Field>
        <Field label="Plan"><select className="form-select" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}><option value="">{t("common.none")}</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </Modal>
      <Modal open={!!members} onClose={() => setMembers(null)} title={members?.org.name ?? ""}>
        {members && <>{members.list.map((m) => <div key={m.user_id} className="d-flex align-items-center gap-2 py-1 border-bottom fs-14"><span>{m.name}</span><span className="text-muted">{m.email}</span><span className="badge badge-soft ms-auto">{m.role}</span><button className="btn btn-link btn-sm text-danger p-0" onClick={async () => { await api(`/admin/organizations/${members.org.id}/members/${m.user_id}`, { method: "DELETE" }); openMembers(members.org); }}><i className="bi bi-x" /></button></div>)}
          <div className="d-flex gap-2 mt-3"><input className="form-control" placeholder="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} /><select className="form-select w-auto" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}><option value="member">member</option><option value="admin">admin</option><option value="owner">owner</option></select><button className="btn btn-outline-primary text-nowrap" onClick={async () => { try { await api(`/admin/organizations/${members.org.id}/members`, { body: { email: memberEmail, role: memberRole } }); setMemberEmail(""); openMembers(members.org); reload(); } catch (e) { toast.error((e as Error).message); } }}>{t("common.add")}</button></div></>}
      </Modal>
    </>
  );
}
