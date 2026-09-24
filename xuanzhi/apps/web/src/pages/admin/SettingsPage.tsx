import { useState } from "react";
import { useLoad, PageHeader } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { useT } from "@/i18n";

interface Settings { settings: { key: string; value: unknown; updated_at: string }[]; env: { embedding_model: string; job_mode: string; web_origin: string; stripe: boolean; email: boolean; oauth: { google: boolean; microsoft: boolean; apple: boolean }; encryption_key: boolean } }
export default function AdminSettingsPage() {
  const { t } = useT(); const toast = useToast(); const { data, reload } = useLoad<Settings>("/admin/settings"); const [key, setKey] = useState(""); const [value, setValue] = useState("");
  const save = async (k: string, v: string) => { try { let parsed: unknown; try { parsed = JSON.parse(v); } catch { parsed = v; } await api(`/admin/settings/${k}`, { method: "PUT", body: { value: parsed } }); reload(); toast.success(t("profile.saved")); } catch (e) { toast.error((e as Error).message); } };
  const Flag = ({ ok, label }: { ok: boolean; label: string }) => <span className={`badge ${ok ? "badge-jade" : "badge-soft"} me-1`}><i className={`bi ${ok ? "bi-check2" : "bi-dash"} me-1`} />{label}</span>;
  return (
    <>
      <PageHeader title={t("admin.settings")} />
      {data && <>
        <div className="card p-3 mb-3"><div className="fw-medium mb-2">Deployment</div>
          <table className="table table-sm fs-14 mb-2"><tbody><tr><td className="text-muted">Embedding model</td><td><code>{data.env.embedding_model}</code></td></tr><tr><td className="text-muted">Job mode</td><td>{data.env.job_mode}</td></tr><tr><td className="text-muted">Web origin</td><td>{data.env.web_origin}</td></tr></tbody></table>
          <div><Flag ok={data.env.encryption_key} label="ENCRYPTION_KEY" /><Flag ok={data.env.stripe} label="Stripe" /><Flag ok={data.env.email} label="Email (Resend)" /><Flag ok={data.env.oauth.google} label="Google OAuth" /><Flag ok={data.env.oauth.microsoft} label="Microsoft OAuth" /><Flag ok={data.env.oauth.apple} label="Apple OAuth" /></div>
          <div className="text-muted fs-13 mt-2">Secrets are set with <code>wrangler secret put</code>; they are never stored in or exposed through the database.</div>
        </div>
        <div className="card p-3"><div className="fw-medium mb-2">System settings</div>
          <table className="table table-sm fs-14"><thead><tr><th>Key</th><th>Value (JSON)</th><th /></tr></thead><tbody>{data.settings.map((s) => <SettingRow key={s.key} k={s.key} v={JSON.stringify(s.value)} onSave={save} />)}</tbody></table>
          <div className="d-flex gap-2"><input className="form-control form-control-sm" placeholder="key.name" value={key} onChange={(e) => setKey(e.target.value)} /><input className="form-control form-control-sm" placeholder='value (JSON, e.g. "text", 5, true)' value={value} onChange={(e) => setValue(e.target.value)} /><button className="btn btn-outline-primary btn-sm text-nowrap" onClick={() => save(key, value)}>{t("common.add")}</button></div>
        </div>
      </>}
    </>
  );
}
function SettingRow({ k, v, onSave }: { k: string; v: string; onSave: (k: string, v: string) => void }) { const [val, setVal] = useState(v); return <tr><td><code>{k}</code></td><td><input className="form-control form-control-sm font-monospace" value={val} onChange={(e) => setVal(e.target.value)} /></td><td className="text-end"><button className="btn btn-ghost btn-sm" disabled={val === v} onClick={() => onSave(k, val)}><i className="bi bi-check2" /></button></td></tr>; }
