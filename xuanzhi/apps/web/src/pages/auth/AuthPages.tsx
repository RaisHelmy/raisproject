import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, API_BASE } from "@/services/api";
import { useAuth } from "@/services/auth";
import { useT } from "@/i18n";
import { usePrefs } from "@/services/prefs";
import { useToast } from "@/services/toast";

function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container py-5" style={{ maxWidth: 440 }}>
      <div className="text-center mb-4"><span className="xz-seal lg">玄</span><h1 className="h3 mt-3 mb-0">{title}</h1></div>
      <div className="card p-4">{children}</div>
      {footer && <div className="text-center text-muted fs-14 mt-3">{footer}</div>}
    </div>
  );
}
function OAuthButtons({ redirect }: { redirect: string }) {
  const { t } = useT(); const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => { api<{ oauth: string[] }>("/auth/providers").then((r) => setProviders(r.data.oauth)).catch(() => setProviders([])); }, []);
  if (!providers.length) return null;
  const icons: Record<string, string> = { google: "bi-google", apple: "bi-apple", microsoft: "bi-microsoft" };
  return (
    <><div className="d-flex align-items-center gap-2 my-3 text-faint fs-13"><hr className="flex-grow-1" />{t("auth.or")}<hr className="flex-grow-1" /></div>
      <div className="d-grid gap-2">{providers.map((p) => <a key={p} className="btn btn-outline-secondary" href={`${API_BASE}/api/auth/oauth/${p}/start?redirect_to=${encodeURIComponent(redirect)}`}><i className={`bi ${icons[p]} me-2`} />{t(`auth.${p}` as never)}</a>)}</div></>
  );
}

export function LoginPage() {
  const { t } = useT(); const { login } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams(); const toast = useToast();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const redirect = sp.get("redirect") ?? "/app";
  useEffect(() => { const e = sp.get("error"); if (e) toast.error(e); }, [sp, toast]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await login(email, password); nav(redirect); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } };
  return (
    <Card title={t("auth.login")} footer={<>{t("auth.no_account")} <Link to="/register">{t("nav.register")}</Link></>}>
      <form onSubmit={submit}>
        <div className="mb-3"><label className="form-label fs-14">{t("auth.email")}</label><input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></div>
        <div className="mb-3"><div className="d-flex justify-content-between"><label className="form-label fs-14">{t("auth.password")}</label><Link to="/forgot-password" className="fs-13">{t("auth.forgot")}</Link></div><input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
        <button className="btn btn-primary w-100" disabled={busy}>{t("auth.submit_login")}</button>
      </form>
      <OAuthButtons redirect={redirect} />
    </Card>
  );
}
export function RegisterPage() {
  const { t } = useT(); const { register } = useAuth(); const nav = useNavigate(); const toast = useToast(); const { locale } = usePrefs();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await register(name, email, password, locale); nav("/app/onboarding"); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } };
  return (
    <Card title={t("auth.register")} footer={<>{t("auth.have_account")} <Link to="/login">{t("nav.login")}</Link></>}>
      <form onSubmit={submit}>
        <div className="mb-3"><label className="form-label fs-14">{t("auth.name")}</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus /></div>
        <div className="mb-3"><label className="form-label fs-14">{t("auth.email")}</label><input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="mb-3"><label className="form-label fs-14">{t("auth.password")}</label><input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" /><div className="form-text">{t("auth.password_hint")}</div></div>
        <button className="btn btn-primary w-100" disabled={busy}>{t("auth.submit_register")}</button>
        <p className="text-faint fs-13 mt-3 mb-0">{t("auth.terms")}</p>
      </form>
      <OAuthButtons redirect="/app/onboarding" />
    </Card>
  );
}
export function ForgotPage() {
  const { t } = useT(); const toast = useToast(); const [email, setEmail] = useState(""); const [done, setDone] = useState<null | boolean>(null);
  const submit = async (e: FormEvent) => { e.preventDefault(); try { const r = await api<{ email_configured: boolean }>("/auth/forgot-password", { body: { email } }); setDone(r.data.email_configured); } catch (err) { toast.error((err as Error).message); } };
  return (
    <Card title={t("auth.forgot_title")} footer={<Link to="/login">{t("nav.login")}</Link>}>
      {done === true ? <div className="alert alert-success fs-14 mb-0">{t("auth.forgot_sent")}</div> : done === false ? <div className="alert alert-warning fs-14 mb-0">{t("auth.forgot_not_configured")}</div> : (
        <form onSubmit={submit}><p className="text-muted fs-14">{t("auth.forgot_body")}</p><input type="email" className="form-control mb-3" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /><button className="btn btn-primary w-100">{t("auth.send_link")}</button></form>
      )}
    </Card>
  );
}
export function ResetPage() {
  const { t } = useT(); const toast = useToast(); const [sp] = useSearchParams(); const [password, setPassword] = useState(""); const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api("/auth/reset-password", { body: { token: sp.get("token") ?? "", password } }); setDone(true); } catch (err) { toast.error((err as Error).message); } };
  return (
    <Card title={t("auth.reset_title")} footer={<Link to="/login">{t("nav.login")}</Link>}>
      {done ? <div className="alert alert-success fs-14 mb-0">{t("auth.reset_done")}</div> : <form onSubmit={submit}><input type="password" className="form-control mb-1" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus /><div className="form-text mb-3">{t("auth.password_hint")}</div><button className="btn btn-primary w-100">{t("auth.set_password")}</button></form>}
    </Card>
  );
}
export function VerifyPage() {
  const { t } = useT(); const [sp] = useSearchParams(); const { refresh } = useAuth(); const [state, setState] = useState<"pending" | "ok" | "fail">("pending");
  useEffect(() => { api("/auth/verify", { body: { token: sp.get("token") ?? "" } }).then(() => { setState("ok"); void refresh(); }).catch(() => setState("fail")); }, [sp, refresh]);
  return <Card title={state === "pending" ? t("auth.verify_title") : state === "ok" ? t("auth.verify_done") : t("auth.verify_failed")} footer={<Link to="/app">{t("nav.chats")}</Link>}><div className="text-center"><i className={`bi ${state === "ok" ? "bi-check-circle" : state === "fail" ? "bi-x-circle" : "bi-hourglass-split"} fs-1`} style={{ color: state === "fail" ? "var(--xz-cinnabar)" : "var(--xz-jade)" }} /></div></Card>;
}
