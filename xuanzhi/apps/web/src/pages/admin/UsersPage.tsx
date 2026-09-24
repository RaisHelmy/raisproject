import { useState } from "react";
import type { PlanDTO, UserDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader, StatusBadge } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { useAuth } from "@/services/auth";
import { Modal, Pager, Field, fmtDate } from "@/components/ui";
import { useT } from "@/i18n";

type Row = UserDTO & { is_active: boolean; last_login_at: string | null; plan_code: string; plan_managed_by: string | null };
export default function UsersPage() {
  const { t, locale } = useT(); const toast = useToast(); const { user: me } = useAuth();
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const { data, reload } = useLoad<{ items: Row[]; total: number }>("/admin/users", { search, page, page_size: 25 });
  const plans = useLoad<PlanDTO[]>("/admin/plans").data ?? [];
  const [edit, setEdit] = useState<Row | null>(null); const [form, setForm] = useState({ name: "", role: "user", is_active: true, new_password: "", plan_id: "", email_verified: true });
  const open = (u: Row) => { setEdit(u); setForm({ name: u.name, role: u.role, is_active: u.is_active, new_password: "", plan_id: plans.find((p) => p.code === u.plan_code)?.id ?? "", email_verified: u.email_verified }); };
  const save = async () => {
    if (!edit) return;
    try {
      await api(`/admin/users/${edit.id}`, { method: "PATCH", body: { name: form.name, role: form.role !== edit.role ? form.role : undefined, is_active: form.is_active, new_password: form.new_password || undefined, email_verified: form.email_verified } });
      const plan = plans.find((p) => p.id === form.plan_id); if (plan && plan.code !== edit.plan_code) await api(`/admin/users/${edit.id}/plan`, { body: { plan_id: plan.id } });
      setEdit(null); reload(); toast.success(t("profile.saved"));
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <PageHeader title={t("admin.users")} subtitle={data ? `${data.total} accounts` : undefined} actions={<input className="form-control form-control-sm" placeholder={t("common.search")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />} />
      <div className="card"><div className="table-responsive"><table className="table table-hover mb-0 fs-14"><thead><tr><th>{t("common.name")}</th><th>{t("auth.email")}</th><th>Role</th><th>Plan</th><th>{t("common.status")}</th><th>Last login</th><th /></tr></thead>
        <tbody>{data?.items.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}{!u.email_verified && <i className="bi bi-envelope-exclamation ms-1 text-warning" title="unverified" />}</td><td><span className="badge badge-soft">{u.role}</span></td><td><span className="badge badge-cinnabar">{u.plan_code}</span></td><td><StatusBadge s={u.is_active ? "active" : "disabled"} /></td><td className="text-muted">{fmtDate(u.last_login_at, locale)}</td><td className="text-end"><button className="btn btn-ghost btn-sm" onClick={() => open(u)}><i className="bi bi-pencil" /></button></td></tr>)}</tbody></table></div></div>
      {data && <Pager page={page} pageSize={25} total={data.total} onPage={setPage} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.email ?? ""} footer={<><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>{t("common.cancel")}</button><button className="btn btn-primary btn-sm" onClick={save}>{t("common.save")}</button></>}>
        <Field label={t("common.name")}><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="row"><div className="col-6"><Field label="Role"><select className="form-select" value={form.role} disabled={me?.role !== "super_admin"} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">user</option><option value="admin">admin</option><option value="super_admin">super_admin</option></select></Field></div>
          <div className="col-6"><Field label="Plan"><select className="form-select" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div></div>
        <Field label="Reset password" hint="Leave blank to keep the current password."><input className="form-control" type="text" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="new password" /></Field>
        <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" id="ua" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><label className="form-check-label" htmlFor="ua">Active</label></div>
        <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="uv" checked={form.email_verified} onChange={(e) => setForm({ ...form, email_verified: e.target.checked })} /><label className="form-check-label" htmlFor="uv">Email verified</label></div>
      </Modal>
    </>
  );
}
