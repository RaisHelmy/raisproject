import { useState } from "react";
import type { PlanDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { Modal, Field } from "@/components/ui";
import { useT } from "@/i18n";

export default function PlansPage() {
  const { t } = useT(); const toast = useToast(); const { data, reload } = useLoad<PlanDTO[]>("/admin/plans");
  const [edit, setEdit] = useState<PlanDTO | null>(null); const [features, setFeatures] = useState("");
  const set = (k: keyof PlanDTO, v: unknown) => edit && setEdit({ ...edit, [k]: v });
  const num = (v: string) => (v === "" ? null : Number(v));
  const save = async () => { if (!edit) return; try { const { id, code, ...rest } = edit; void code; await api(`/admin/plans/${id}`, { method: "PATCH", body: { ...rest, features: features.split("\n").map((s) => s.trim()).filter(Boolean) } }); setEdit(null); reload(); toast.success(t("profile.saved")); } catch (e) { toast.error((e as Error).message); } };
  return (
    <>
      <PageHeader title={t("admin.plans")} subtitle="Prices, limits and feature flags are configuration. Model availability is set on the Models page." />
      <div className="row g-3">{data?.map((p) => (
        <div key={p.id} className="col-md-6 col-xl-3"><div className="card p-3 h-100"><div className="d-flex align-items-center"><h5 className="mb-0">{p.name}</h5>{!p.is_active && <span className="badge badge-soft ms-2">inactive</span>}<button className="btn btn-ghost btn-sm ms-auto" onClick={() => { setEdit(p); setFeatures(p.features.join("\n")); }}><i className="bi bi-pencil" /></button></div>
          <div className="xz-price">{p.code === "enterprise" ? "Custom" : `$${p.price_monthly}`}<span className="fs-6 text-muted fw-normal">{p.code === "enterprise" ? "" : "/mo"}</span></div>
          <table className="table table-sm fs-13 mb-2"><tbody><tr><td className="text-muted">Messages/day</td><td className="text-end">{p.message_limit_daily ?? "∞"}</td></tr><tr><td className="text-muted">Knowledge searches/day</td><td className="text-end">{p.knowledge_search_limit_daily ?? "∞"}</td></tr><tr><td className="text-muted">Context</td><td className="text-end">{Math.round(p.context_window_tokens / 1000)}k</td></tr><tr><td className="text-muted">Uploads/day</td><td className="text-end">{p.allow_file_upload ? p.max_upload_files_per_day : "—"}</td></tr><tr><td className="text-muted">Conversations</td><td className="text-end">{p.max_conversations ?? "∞"}</td></tr></tbody></table>
          <div className="d-flex flex-wrap gap-1">{p.allow_advanced_modes && <span className="badge badge-soft">advanced modes</span>}{p.allow_premium_knowledge && <span className="badge badge-soft">premium knowledge</span>}{p.allow_api_access && <span className="badge badge-soft">API</span>}{p.stripe_price_id && <span className="badge badge-jade">stripe</span>}</div></div></div>
      ))}</div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""} size="lg" footer={<><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>{t("common.cancel")}</button><button className="btn btn-primary btn-sm" onClick={save}>{t("common.save")}</button></>}>
        {edit && <>
          <div className="row"><div className="col-md-6"><Field label={t("common.name")}><input className="form-control" value={edit.name} onChange={(e) => set("name", e.target.value)} /></Field></div><div className="col-md-3"><Field label="Price / month"><input type="number" step="0.01" className="form-control" value={edit.price_monthly} onChange={(e) => set("price_monthly", Number(e.target.value))} /></Field></div><div className="col-md-3"><Field label="Currency"><input className="form-control" value={edit.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field></div></div>
          <Field label="Description"><input className="form-control" value={edit.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="row"><div className="col-6 col-md-3"><Field label="Messages/day (blank = ∞)"><input type="number" className="form-control" value={edit.message_limit_daily ?? ""} onChange={(e) => set("message_limit_daily", num(e.target.value))} /></Field></div><div className="col-6 col-md-3"><Field label="Knowledge searches/day"><input type="number" className="form-control" value={edit.knowledge_search_limit_daily ?? ""} onChange={(e) => set("knowledge_search_limit_daily", num(e.target.value))} /></Field></div><div className="col-6 col-md-3"><Field label="Context tokens"><input type="number" className="form-control" value={edit.context_window_tokens} onChange={(e) => set("context_window_tokens", Number(e.target.value))} /></Field></div><div className="col-6 col-md-3"><Field label="Uploads/day"><input type="number" className="form-control" value={edit.max_upload_files_per_day} onChange={(e) => set("max_upload_files_per_day", Number(e.target.value))} /></Field></div></div>
          <div className="row"><div className="col-6 col-md-3"><Field label="Max conversations"><input type="number" className="form-control" value={edit.max_conversations ?? ""} onChange={(e) => set("max_conversations", num(e.target.value))} /></Field></div><div className="col-6 col-md-3"><Field label="Priority"><input type="number" className="form-control" value={edit.priority} onChange={(e) => set("priority", Number(e.target.value))} /></Field></div><div className="col-md-6"><Field label="Stripe price id"><input className="form-control" value={edit.stripe_price_id ?? ""} onChange={(e) => set("stripe_price_id", e.target.value || null)} placeholder="price_…" /></Field></div></div>
          <div className="d-flex flex-wrap gap-3 mb-3">{(["allow_file_upload", "allow_advanced_modes", "allow_premium_knowledge", "allow_api_access", "is_active"] as const).map((k) => <div key={k} className="form-check form-switch"><input className="form-check-input" type="checkbox" id={k} checked={edit[k]} onChange={(e) => set(k, e.target.checked)} /><label className="form-check-label" htmlFor={k}>{k.replace(/_/g, " ")}</label></div>)}</div>
          <Field label="Features (one per line, shown on the pricing page)"><textarea className="form-control" rows={5} value={features} onChange={(e) => setFeatures(e.target.value)} /></Field>
        </>}
      </Modal>
    </>
  );
}
