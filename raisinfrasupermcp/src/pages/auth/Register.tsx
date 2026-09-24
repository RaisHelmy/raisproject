import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { AuthSide } from "./Login";

export default function Register() {
  const { api, setSession } = useApp();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", organizationName: "", organizationType: "PERSONAL" as "PERSONAL" | "COMPANY" });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(undefined); try { setSession(await api.auth.register({ ...form, organizationName: form.organizationName || `${form.name} (Personal)` })); nav("/"); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } };
  return <div className="auth-wrap"><AuthSide /><div className="auth-form"><div className="panel"><div className="panel-body p-4">
    <h2 className="fs-4 mb-1">Create your organization</h2><p className="text-secondary mb-3">Anyone can register as Personal or Company. Both are organizations; you can belong to several.</p>
    {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <div className="mb-3"><label className="form-label">Organization type</label><div className="d-flex gap-2">{(["PERSONAL", "COMPANY"] as const).map((t) => <button type="button" key={t} className={`btn flex-fill ${form.organizationType === t ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => set("organizationType", t)}><i className={`bi ${t === "PERSONAL" ? "bi-person" : "bi-building"} me-1`} />{t === "PERSONAL" ? "Personal" : "Company"}</button>)}</div><div className="form-text">{form.organizationType === "PERSONAL" ? "Approvals default to automatic. Free plan: 1 agent, 1 environment, 5 active Changes." : "Approval routing, RBAC and verification. Starts on Free; upgrade any time."}</div></div>
      {form.organizationType === "COMPANY" && <div className="mb-3"><label className="form-label">Company name</label><input className="form-control" value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} required /></div>}
      <div className="mb-3"><label className="form-label">Your name</label><input className="form-control" value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
      <div className="mb-3"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required autoComplete="username" /></div>
      <div className="mb-3"><label className="form-label">Password</label><input className="form-control" type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} required autoComplete="new-password" /><div className="form-text">At least 8 characters. Stored as PBKDF2-SHA256.</div></div>
      <button className="btn btn-primary w-100" disabled={busy}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}Create organization</button>
    </form>
    <div className="mt-3 small text-secondary">Already registered? <Link to="/login">Sign in</Link></div>
  </div></div></div></div>;
}
