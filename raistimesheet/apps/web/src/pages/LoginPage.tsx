import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/services/auth";
import { ApiError } from "@/services/api";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to={loc.state?.from ?? "/"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); nav(loc.state?.from ?? "/", { replace: true }); } catch (err) { setError(err instanceof ApiError ? err.message : "Sign-in failed."); } finally { setBusy(false); }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: "linear-gradient(160deg, #0f2740 0%, #1f4e79 60%, #2b6cb0 100%)" }}>
      <div className="card shadow-lg" style={{ width: "100%", maxWidth: 420 }}>
        <div className="card-body p-4 p-md-5">
          <div className="d-flex align-items-center gap-2 mb-4"><span className="brand-mark"><i className="bi bi-stopwatch" /></span><span className="h5 mb-0 fw-bold">Rais Timesheet</span></div>
          <h1 className="h4 mb-1">Sign in</h1>
          <p className="text-secondary mb-4">Turn your WhatsApp work history into approved, auditable timesheets.</p>
          <form onSubmit={submit} noValidate>
            <div className="mb-3"><label htmlFor="email" className="form-label">Email</label><input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></div>
            <div className="mb-3"><label htmlFor="password" className="form-label">Password</label><input id="password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            <button className="btn btn-primary w-100" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Sign in</button>
          </form>
        </div>
      </div>
    </div>
  );
}
