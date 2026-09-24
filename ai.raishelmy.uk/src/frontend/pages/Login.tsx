import { useState, type FormEvent } from "react";
import { api } from "../api";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(new URLSearchParams(location.search).get("error") === "sso" ? "Suite SSO token was invalid or expired. Sign in with the password instead." : null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api("/auth/login", { method: "POST", json: { password } }); onLogin(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <form className="card mt-5" onSubmit={submit} autoComplete="off">
        <div className="card-body p-4">
          <div className="small text-secondary fw-bold mb-1">RAISHELMY.UK / AI GATEWAY</div>
          <h4 className="mb-1">Sign in</h4>
          <p className="text-secondary small">Manage AI credentials, budgets and usage for every app.</p>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <input className="form-control mb-3" type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          <button className="btn btn-primary w-100" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
          <div className="text-secondary small mt-3">Or open this app from <a href="https://saas.raishelmy.uk/admin">saas.raishelmy.uk/admin</a> to sign in automatically.</div>
        </div>
      </form>
    </div>
  );
}
