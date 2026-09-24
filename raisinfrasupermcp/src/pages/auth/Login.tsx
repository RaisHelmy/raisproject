import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { DEMO } from "@/domain/seed/demo";

export function AuthSide() {
  return <div className="auth-side"><div style={{ maxWidth: 460 }}>
    <div className="d-flex align-items-center gap-2 mb-4"><span className="logo" style={{ width: 34, height: 34, borderRadius: 9, background: "#1e293b", display: "grid", placeItems: "center", color: "#38bdf8" }}><i className="bi bi-lightning-charge-fill" /></span><span className="fw-bold text-white" style={{ letterSpacing: "-.02em" }}>SUPER MCP</span></div>
    <h1>Tell Super MCP what you want to change.</h1>
    <p className="fs-5 mt-3" style={{ color: "#94a3b8" }}>It plans, governs, executes, validates, heals, and learns.</p>
    <div className="pipeline mt-4" aria-hidden>{["ASK", "UNDERSTAND", "CREATE CHANGE", "PLAN → JIRA → DEVELOP → GIT → CI/CD → TEST", "POLICY → APPROVAL", "DEPLOY → LIVE VALIDATION → UAT → CLOSE", "RECORD → ANALYZE → OPTIMIZE → FEWER AI CALLS"].map((s, i) => <div key={s}>{i > 0 && <div className="arrow">↓</div>}<span className={`node ${i === 4 ? "hot" : i === 6 ? "ai" : ""}`} style={{ background: "#1e293b", color: "#cbd5e1" }}>{s}</span></div>)}</div>
    <p className="mt-4 small" style={{ color: "#64748b" }}>AI = brain · Task Engine = hands · Agent = execution · Policy = immune system · Telemetry = memory · Optimization = learning loop.</p>
  </div></div>;
}

export default function Login() {
  const { api, setSession } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("ahmad@abc.example");
  const [password, setPassword] = useState(api.mode === "DEMO" ? DEMO.password : "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(undefined); try { setSession(await api.auth.login(email, password)); nav("/"); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } };
  const quick = async (id: string) => { setBusy(true); try { setSession(await api.auth.demoLogin(id)); nav("/"); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } };
  return <div className="auth-wrap"><AuthSide /><div className="auth-form"><div className="panel"><div className="panel-body p-4">
    <h2 className="fs-4 mb-1">Sign in</h2><p className="text-secondary mb-3">Autonomous Software Engineering & IT Operations Platform</p>
    {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
    <form onSubmit={submit}><div className="mb-3"><label className="form-label" htmlFor="email">Email</label><input id="email" className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></div>
      <div className="mb-3"><label className="form-label" htmlFor="pw">Password</label><input id="pw" className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
      <button className="btn btn-primary w-100" disabled={busy}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}Sign in</button></form>
    {api.mode === "DEMO" && <div className="mt-4"><div className="panel-title mb-2">Demo users (ABC Sdn Bhd)</div><div className="d-grid gap-2">
      {[{ id: DEMO.users.ahmad, n: "Ahmad Razak", r: "Organization Owner" }, { id: DEMO.users.sarah, n: "Sarah Lim", r: "Security Admin" }, { id: DEMO.users.daniel, n: "Daniel Tan", r: "DevOps + Developer" }].map((u) => <button key={u.id} className="btn btn-outline-secondary text-start d-flex align-items-center gap-2" onClick={() => quick(u.id)} disabled={busy}><span className="avatar sm">{u.n.split(" ").map((p) => p[0]).join("")}</span><span>{u.n}<span className="text-secondary small ms-2">{u.r}</span></span><i className="bi bi-arrow-right ms-auto" /></button>)}
    </div><div className="small text-secondary mt-2">Password for all demo users: <code>{DEMO.password}</code></div></div>}
    <div className="mt-3 small text-secondary">No account? <Link to="/register">Register a personal or company organization</Link> · <Link to="/pricing">Pricing</Link></div>
  </div></div></div></div>;
}
