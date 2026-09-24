import { useState } from "react";
import type { ModeDTO, PromptDTO, PromptVersionDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { Modal, Field, fmtDate } from "@/components/ui";
import { useT } from "@/i18n";

interface Detail { id: string; code: string; name: string; description: string | null; active_version_id: string | null; built_in_default: string | null; versions: PromptVersionDTO[] }
type ModeRow = ModeDTO & { prompt_id: string | null };
const emptyMode = { code: "", name: "", name_zh: "", name_zh_tw: "", description: "", description_zh: "", description_zh_tw: "", icon: "bi-stars", prompt_id: "", knowledge_filter: "", is_advanced: false, is_active: true, sort_order: 10 };

export default function PromptsPage() {
  const { t, locale } = useT(); const toast = useToast(); const [tab, setTab] = useState<"prompts" | "modes">("prompts");
  const { data, reload } = useLoad<PromptDTO[]>("/admin/prompts"); const modes = useLoad<ModeRow[]>("/admin/modes");
  const [detail, setDetail] = useState<Detail | null>(null); const [content, setContent] = useState(""); const [notes, setNotes] = useState(""); const [viewing, setViewing] = useState<PromptVersionDTO | null>(null);
  const [create, setCreate] = useState(false); const [np, setNp] = useState({ code: "", name: "", description: "", content: "" });
  const [modeEdit, setModeEdit] = useState<{ id: string | null; form: typeof emptyMode } | null>(null);
  const open = async (p: PromptDTO) => { const r = await api<Detail>(`/admin/prompts/${p.id}`); setDetail(r.data); const active = r.data.versions.find((v) => v.is_active); setContent(active?.content ?? r.data.built_in_default ?? ""); setNotes(""); setViewing(null); };
  const publish = async () => { if (!detail) return; try { await api(`/admin/prompts/${detail.id}/versions`, { body: { content, notes: notes || null, activate: true } }); toast.success("Published as new active version"); await open({ id: detail.id } as PromptDTO); reload(); } catch (e) { toast.error((e as Error).message); } };
  const rollback = async (v: PromptVersionDTO) => { if (!detail) return; await api(`/admin/prompts/${detail.id}/activate/${v.id}`, { body: {} }); toast.success(`Version ${v.version} is now active`); await open({ id: detail.id } as PromptDTO); reload(); };
  const saveMode = async () => { if (!modeEdit) return; try { const f = modeEdit.form; const body = { ...f, prompt_id: f.prompt_id || null, knowledge_filter: f.knowledge_filter.split(",").map((s) => s.trim()).filter(Boolean) }; if (modeEdit.id) { const { code, ...rest } = body; void code; await api(`/admin/modes/${modeEdit.id}`, { method: "PATCH", body: rest }); } else await api("/admin/modes", { body }); setModeEdit(null); modes.reload(); } catch (e) { toast.error((e as Error).message); } };
  const mf = modeEdit?.form;
  return (
    <>
      <PageHeader title={t("admin.prompts")} subtitle="System prompts are versioned; the active version is used immediately. Modes = prompt + knowledge filter, not separate LLMs." actions={<ul className="nav nav-pills"><li className="nav-item"><button className={`nav-link ${tab === "prompts" ? "active" : ""}`} onClick={() => setTab("prompts")}>Prompts</button></li><li className="nav-item"><button className={`nav-link ${tab === "modes" ? "active" : ""}`} onClick={() => setTab("modes")}>AI Modes</button></li></ul>} />
      {tab === "prompts" ? (
        <div className="row g-3">
          <div className="col-lg-4"><div className="card"><div className="list-group list-group-flush">{data?.map((p) => <button key={p.id} className={`list-group-item list-group-item-action ${detail?.id === p.id ? "active" : ""}`} style={{ background: detail?.id === p.id ? "var(--xz-cinnabar-soft)" : "transparent", color: "inherit" }} onClick={() => open(p)}><div className="d-flex justify-content-between"><span className="fw-medium">{p.name}</span><span className="badge badge-soft">v{p.active_version ?? "—"}</span></div><div className="text-muted fs-13"><code>{p.code}</code> · {p.version_count} versions</div></button>)}</div><div className="p-2 border-top"><button className="btn btn-outline-primary btn-sm w-100" onClick={() => setCreate(true)}><i className="bi bi-plus-lg me-1" />New prompt</button></div></div></div>
          <div className="col-lg-8">{detail ? (
            <div className="card p-3">
              <div className="d-flex align-items-center gap-2 mb-2"><h5 className="mb-0">{detail.name}</h5><code className="fs-13">{detail.code}</code><span className="text-muted fs-13 ms-auto">{detail.description}</span></div>
              <textarea className="form-control font-monospace fs-13" rows={16} value={viewing ? viewing.content : content} readOnly={!!viewing} onChange={(e) => setContent(e.target.value)} />
              {viewing ? <div className="d-flex gap-2 mt-2"><span className="text-muted fs-13 align-self-center">Viewing version {viewing.version} (read-only)</span><button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setViewing(null)}>Back to editor</button>{!viewing.is_active && <button className="btn btn-primary btn-sm" onClick={() => rollback(viewing)}>Activate this version (rollback)</button>}</div>
                : <div className="d-flex gap-2 mt-2 align-items-center"><input className="form-control form-control-sm" placeholder="Change notes" value={notes} onChange={(e) => setNotes(e.target.value)} /><button className="btn btn-primary btn-sm text-nowrap" onClick={publish}>Publish new version</button></div>}
              <div className="fw-medium mt-4 mb-1">Versions</div>
              <table className="table table-sm fs-13 mb-0"><tbody>{detail.versions.map((v) => <tr key={v.id} className={v.is_active ? "table-active" : ""}><td>v{v.version}{v.is_active && <span className="badge badge-jade ms-1">Active</span>}</td><td className="text-muted">{v.notes}</td><td className="text-muted">{fmtDate(v.created_at, locale)}</td><td className="text-end"><button className="btn btn-link btn-sm p-0 me-2" onClick={() => setViewing(v)}>View</button>{!v.is_active && <button className="btn btn-link btn-sm p-0" onClick={() => rollback(v)}>Rollback</button>}</td></tr>)}</tbody></table>
            </div>
          ) : <div className="text-muted p-4">Select a prompt to edit its versions.</div>}</div>
        </div>
      ) : (
        <>
          <div className="mb-2"><button className="btn btn-primary btn-sm" onClick={() => setModeEdit({ id: null, form: emptyMode })}><i className="bi bi-plus-lg me-1" />{t("common.add")}</button></div>
          <div className="card"><div className="table-responsive"><table className="table table-hover mb-0 fs-14"><thead><tr><th /><th>Mode</th><th>Code</th><th>Prompt</th><th>Knowledge filter</th><th>Advanced</th><th>Active</th><th /></tr></thead>
            <tbody>{modes.data?.map((m) => <tr key={m.id}><td><i className={`bi ${m.icon}`} /></td><td>{m.name} <span className="text-muted">{m.name_zh}</span></td><td><code>{m.code}</code></td><td className="fs-13">{data?.find((p) => p.id === m.prompt_id)?.name ?? "—"}</td><td>{m.knowledge_filter.map((k) => <span key={k} className="badge badge-soft me-1">{k}</span>)}</td><td>{m.is_advanced ? "Pro" : "—"}</td><td>{m.is_active ? "✓" : "—"}</td><td className="text-end"><button className="btn btn-ghost btn-sm" onClick={() => setModeEdit({ id: m.id, form: { code: m.code, name: m.name, name_zh: m.name_zh, name_zh_tw: m.name_zh_tw, description: m.description, description_zh: m.description_zh, description_zh_tw: m.description_zh_tw, icon: m.icon, prompt_id: m.prompt_id ?? "", knowledge_filter: m.knowledge_filter.join(", "), is_advanced: m.is_advanced, is_active: m.is_active, sort_order: m.sort_order } })}><i className="bi bi-pencil" /></button></td></tr>)}</tbody></table></div></div>
        </>
      )}
      <Modal open={create} onClose={() => setCreate(false)} title="New prompt" size="lg" footer={<button className="btn btn-primary btn-sm" onClick={async () => { try { await api("/admin/prompts", { body: { ...np, description: np.description || null } }); setCreate(false); reload(); } catch (e) { toast.error((e as Error).message); } }}>{t("common.create")}</button>}>
        <div className="row"><div className="col-6"><Field label="Code"><input className="form-control" value={np.code} onChange={(e) => setNp({ ...np, code: e.target.value })} placeholder="mode_bazi" /></Field></div><div className="col-6"><Field label={t("common.name")}><input className="form-control" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></Field></div></div>
        <Field label="Description"><input className="form-control" value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} /></Field><Field label="Content"><textarea className="form-control font-monospace fs-13" rows={10} value={np.content} onChange={(e) => setNp({ ...np, content: e.target.value })} /></Field>
      </Modal>
      <Modal open={!!modeEdit} onClose={() => setModeEdit(null)} title={modeEdit?.id ? t("common.edit") : t("common.add")} size="lg" footer={<button className="btn btn-primary btn-sm" onClick={saveMode}>{t("common.save")}</button>}>
        {mf && <>
          <div className="row"><div className="col-4">{!modeEdit?.id && <Field label="Code"><input className="form-control" value={mf.code} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, code: e.target.value } })} /></Field>}</div><div className="col-4"><Field label="Icon"><input className="form-control" value={mf.icon} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, icon: e.target.value } })} /></Field></div><div className="col-4"><Field label="Sort"><input type="number" className="form-control" value={mf.sort_order} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, sort_order: Number(e.target.value) } })} /></Field></div></div>
          <div className="row">{(["name", "name_zh", "name_zh_tw"] as const).map((k) => <div key={k} className="col-4"><Field label={k}><input className="form-control" value={mf[k]} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, [k]: e.target.value } })} /></Field></div>)}</div>
          <div className="row">{(["description", "description_zh", "description_zh_tw"] as const).map((k) => <div key={k} className="col-4"><Field label={k}><input className="form-control" value={mf[k]} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, [k]: e.target.value } })} /></Field></div>)}</div>
          <div className="row"><div className="col-6"><Field label="System prompt"><select className="form-select" value={mf.prompt_id} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, prompt_id: e.target.value } })}><option value="">—</option>{data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div><div className="col-6"><Field label="Knowledge filter (category codes, comma)"><input className="form-control" value={mf.knowledge_filter} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, knowledge_filter: e.target.value } })} placeholder="iching, chinese_philosophy" /></Field></div></div>
          <div className="d-flex gap-3"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="madv" checked={mf.is_advanced} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, is_advanced: e.target.checked } })} /><label className="form-check-label" htmlFor="madv">Advanced (Pro+)</label></div><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="mact" checked={mf.is_active} onChange={(e) => setModeEdit({ ...modeEdit!, form: { ...mf, is_active: e.target.checked } })} /><label className="form-check-label" htmlFor="mact">Active</label></div></div>
        </>}
      </Modal>
    </>
  );
}
