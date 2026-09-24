import { useState } from "react";
import type { CategoryDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { Modal, Field, Confirm } from "@/components/ui";
import { useT } from "@/i18n";

const empty = { code: "", name: "", name_zh: "", name_zh_tw: "", description: "", icon: "bi-book", sort_order: 100 };
export default function CategoriesPage() {
  const { t } = useT(); const toast = useToast(); const { data, reload } = useLoad<CategoryDTO[]>("/admin/knowledge/categories");
  const [edit, setEdit] = useState<{ id: string | null; form: typeof empty } | null>(null); const [del, setDel] = useState<CategoryDTO | null>(null);
  const save = async () => { if (!edit) return; try { const { code, ...rest } = edit.form; if (edit.id) await api(`/admin/knowledge/categories/${edit.id}`, { method: "PATCH", body: { ...rest, description: rest.description || null } }); else await api("/admin/knowledge/categories", { body: { code, ...rest, description: rest.description || null } }); setEdit(null); reload(); } catch (e) { toast.error((e as Error).message); } };
  const f = edit?.form;
  return (
    <>
      <PageHeader title={t("admin.categories")} actions={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ id: null, form: empty })}><i className="bi bi-plus-lg me-1" />{t("common.add")}</button>} />
      <div className="card"><div className="table-responsive"><table className="table table-hover mb-0 fs-14"><thead><tr><th>Icon</th><th>Code</th><th>Name</th><th>简体</th><th>繁體</th><th>Docs</th><th /></tr></thead>
        <tbody>{data?.map((c) => <tr key={c.id}><td><i className={`bi ${c.icon}`} /></td><td><code>{c.code}</code>{c.is_system && <span className="badge badge-soft ms-1">system</span>}</td><td>{c.name}</td><td>{c.name_zh}</td><td>{c.name_zh_tw}</td><td>{c.document_count ?? 0}</td><td className="text-end text-nowrap"><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ id: c.id, form: { code: c.code, name: c.name, name_zh: c.name_zh, name_zh_tw: c.name_zh_tw, description: c.description ?? "", icon: c.icon, sort_order: c.sort_order } })}><i className="bi bi-pencil" /></button>{!c.is_system && <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDel(c)}><i className="bi bi-trash" /></button>}</td></tr>)}</tbody></table></div></div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("common.edit") : t("common.add")} footer={<button className="btn btn-primary btn-sm" onClick={save}>{t("common.save")}</button>}>
        {f && <>
          {!edit?.id && <Field label="Code" hint="lowercase, underscores"><input className="form-control" value={f.code} onChange={(e) => setEdit({ ...edit!, form: { ...f, code: e.target.value } })} /></Field>}
          <Field label="Name (English)"><input className="form-control" value={f.name} onChange={(e) => setEdit({ ...edit!, form: { ...f, name: e.target.value } })} /></Field>
          <div className="row"><div className="col-6"><Field label="简体中文"><input className="form-control" value={f.name_zh} onChange={(e) => setEdit({ ...edit!, form: { ...f, name_zh: e.target.value } })} /></Field></div><div className="col-6"><Field label="繁體中文"><input className="form-control" value={f.name_zh_tw} onChange={(e) => setEdit({ ...edit!, form: { ...f, name_zh_tw: e.target.value } })} /></Field></div></div>
          <Field label="Description"><input className="form-control" value={f.description} onChange={(e) => setEdit({ ...edit!, form: { ...f, description: e.target.value } })} /></Field>
          <div className="row"><div className="col-6"><Field label="Icon (Bootstrap Icons class)"><input className="form-control" value={f.icon} onChange={(e) => setEdit({ ...edit!, form: { ...f, icon: e.target.value } })} /></Field></div><div className="col-6"><Field label="Sort order"><input type="number" className="form-control" value={f.sort_order} onChange={(e) => setEdit({ ...edit!, form: { ...f, sort_order: Number(e.target.value) } })} /></Field></div></div>
        </>}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("common.delete")} body={del?.name ?? ""} onConfirm={async () => { await api(`/admin/knowledge/categories/${del!.id}`, { method: "DELETE" }); reload(); }} />
    </>
  );
}
