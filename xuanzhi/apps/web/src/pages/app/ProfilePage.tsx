import { useEffect, useState, type FormEvent } from "react";
import type { Locale, Theme, ResponseStyle } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useAppData } from "@/services/appdata";
import { useT, LOCALE_LABELS, pickName } from "@/i18n";
import { usePrefs } from "@/services/prefs";
import { useToast } from "@/services/toast";
import { Confirm, Field } from "@/components/ui";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, refresh, logout } = useAuth(); const { models, modes } = useAppData(); const { t, locale } = useT(); const prefs = usePrefs(); const toast = useToast(); const nav = useNavigate();
  const [form, setForm] = useState({ name: "", avatar_url: "", locale: "en" as Locale, theme: "system" as Theme, default_model_id: "", default_mode_id: "", response_style: "balanced" as ResponseStyle, memory_enabled: true, history_enabled: true });
  const [pw, setPw] = useState({ current_password: "", new_password: "" }); const [confirm, setConfirm] = useState<"history" | "account" | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) setForm({ name: user.name, avatar_url: user.avatar_url ?? "", locale: user.locale, theme: user.theme, default_model_id: user.default_model_id ?? "", default_mode_id: user.default_mode_id ?? "", response_style: user.response_style, memory_enabled: user.memory_enabled, history_enabled: user.history_enabled }); }, [user]);
  const save = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await api("/account/profile", { method: "PATCH", body: { ...form, avatar_url: form.avatar_url || null, default_model_id: form.default_model_id || null, default_mode_id: form.default_mode_id || null } }); prefs.setLocale(form.locale); prefs.setTheme(form.theme); await refresh(); toast.success(t("profile.saved")); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } };
  const changePw = async (e: FormEvent) => { e.preventDefault(); try { await api("/auth/change-password", { body: pw }); setPw({ current_password: "", new_password: "" }); toast.success(t("profile.password_changed")); } catch (err) { toast.error((err as Error).message); } };
  return (
    <div className="xz-page" style={{ maxWidth: 760 }}>
      <h1 className="h2 mb-3">{t("profile.title")}</h1>
      <form onSubmit={save}>
        <div className="card p-4 mb-3">
          <div className="row"><div className="col-md-6"><Field label={t("profile.name")}><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div><div className="col-md-6"><Field label={t("profile.email")}><input className="form-control" value={user?.email ?? ""} disabled /></Field></div></div>
          <Field label={t("profile.avatar")}><input className="form-control" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://" /></Field>
          <div className="row"><div className="col-md-6"><Field label={t("profile.language")}><select className="form-select" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })}>{(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}</select></Field></div>
            <div className="col-md-6"><Field label={t("profile.theme")}><select className="form-select" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as Theme })}><option value="system">{t("profile.theme.system")}</option><option value="light">{t("profile.theme.light")}</option><option value="dark">{t("profile.theme.dark")}</option></select></Field></div></div>
        </div>
        <div className="card p-4 mb-3"><h2 className="h5 mb-3">{t("profile.ai")}</h2>
          <div className="row"><div className="col-md-6"><Field label={t("profile.default_model")}><select className="form-select" value={form.default_model_id} onChange={(e) => setForm({ ...form, default_model_id: e.target.value })}><option value="">{t("profile.none")}</option>{models.filter((m) => m.available).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field></div>
            <div className="col-md-6"><Field label={t("profile.default_mode")}><select className="form-select" value={form.default_mode_id} onChange={(e) => setForm({ ...form, default_mode_id: e.target.value })}><option value="">{t("profile.none")}</option>{modes.filter((m) => m.available !== false).map((m) => <option key={m.id} value={m.id}>{pickName(m, locale)}</option>)}</select></Field></div></div>
          <Field label={t("profile.style")}><select className="form-select" value={form.response_style} onChange={(e) => setForm({ ...form, response_style: e.target.value as ResponseStyle })}>{(["balanced", "concise", "detailed", "scholarly"] as const).map((s) => <option key={s} value={s}>{t(`profile.style.${s}`)}</option>)}</select></Field>
        </div>
        <div className="card p-4 mb-3"><h2 className="h5 mb-3">{t("profile.privacy")}</h2>
          <div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" id="hist" checked={form.history_enabled} onChange={(e) => setForm({ ...form, history_enabled: e.target.checked })} /><label className="form-check-label" htmlFor="hist">{t("profile.history")}</label></div>
          <div className="form-check form-switch mb-3"><input className="form-check-input" type="checkbox" id="mem" checked={form.memory_enabled} onChange={(e) => setForm({ ...form, memory_enabled: e.target.checked })} /><label className="form-check-label" htmlFor="mem">{t("profile.memory")}</label></div>
          <div className="text-muted fs-14 mb-2">{t("profile.data")}</div>
          <div className="d-flex gap-2 flex-wrap"><button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirm("history")}>{t("profile.clear_history")}</button><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setConfirm("account")}>{t("profile.delete_account")}</button></div>
        </div>
        <button className="btn btn-primary" disabled={busy}>{t("profile.save")}</button>
      </form>
      <form onSubmit={changePw} className="card p-4 mt-4"><h2 className="h5 mb-3">{t("profile.password")}</h2>
        <div className="row"><div className="col-md-6"><Field label={t("profile.current_password")}><input type="password" className="form-control" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} autoComplete="current-password" /></Field></div><div className="col-md-6"><Field label={t("profile.new_password")} hint={t("auth.password_hint")}><input type="password" className="form-control" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} minLength={8} autoComplete="new-password" required /></Field></div></div>
        <button className="btn btn-outline-primary align-self-start">{t("profile.password")}</button>
      </form>
      <Confirm open={confirm === "history"} onClose={() => setConfirm(null)} danger title={t("profile.clear_history")} body={t("chat.delete_confirm")} onConfirm={async () => { await api("/account/history", { method: "DELETE" }); toast.success(t("profile.saved")); window.location.reload(); }} />
      <Confirm open={confirm === "account"} onClose={() => setConfirm(null)} danger title={t("profile.delete_account")} body={t("chat.delete_confirm")} onConfirm={async () => { try { await api("/account", { method: "DELETE" }); await logout(); nav("/"); } catch (e) { toast.error((e as Error).message); } }} />
    </div>
  );
}
