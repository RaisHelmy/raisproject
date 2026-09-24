import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { api } from "../../lib/api";

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="onboard-wrap">
      <div className="onboard-card" style={{ maxWidth: 440 }}>
        <div className="ob-brand">Rais Fintech</div>
        {children}
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-warn" role="alert" style={{ marginBottom: 16 }}>
      <span aria-hidden>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref = params.get("ref") ?? undefined;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(name, email, password, ref);
      navigate("/welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1 className="ob-title" style={{ fontSize: 26 }}>Create your account</h1>
      <p className="ob-sub">
        Manage your wealth today. Protect your family tomorrow.
      </p>
      {ref && (
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <span aria-hidden>🎁</span>
          <span>
            You were invited by a friend (code <strong>{ref}</strong>). You'll start with a
            <strong> 100-point welcome bonus</strong>, and they'll be rewarded too.
          </span>
        </div>
      )}
      <form onSubmit={submit} className="mt-24">
        <FormError message={error} />
        <div className="field">
          <label htmlFor="su-name">Full name</label>
          <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="su-email">Email</label>
          <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <div className="hint">We'll send a verification link to this address.</div>
        </div>
        <div className="field">
          <label htmlFor="su-pass">Password</label>
          <input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <div className="hint">At least 8 characters.</div>
        </div>
        <button className="btn btn-gold" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Creating your account…" : "Create Account"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1 className="ob-title" style={{ fontSize: 26 }}>Welcome back</h1>
      <p className="ob-sub">Sign in to your financial workspace.</p>
      <form onSubmit={submit} className="mt-24">
        <FormError message={error} />
        <div className="field">
          <label htmlFor="li-email">Email</label>
          <input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="li-pass">Password</label>
          <input id="li-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>
        New to Rais Fintech? <Link to="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { refresh, user } = useAuth();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    api
      .post("/auth/verify", { token })
      .then(async () => {
        setStatus("ok");
        await refresh();
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token, refresh]);

  return (
    <AuthFrame>
      {status === "working" && (
        <>
          <h1 className="ob-title" style={{ fontSize: 26 }}>Verifying…</h1>
          <p className="ob-sub">One moment while we confirm your email address.</p>
        </>
      )}
      {status === "ok" && (
        <>
          <h1 className="ob-title" style={{ fontSize: 26 }}>✓ Email verified</h1>
          <p className="ob-sub">
            Your account is confirmed and protected. You can continue setting up your
            workspace.
          </p>
          <div className="mt-24">
            <Link className="btn btn-gold" to={user ? "/" : "/login"}>
              {user ? "Go to Dashboard" : "Sign In"}
            </Link>
          </div>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="ob-title" style={{ fontSize: 26 }}>Verification didn't work</h1>
          <p className="ob-sub">{message}</p>
          <p className="muted" style={{ marginTop: 14 }}>
            Your account is safe. You can request a fresh link from the banner on your
            dashboard after signing in.
          </p>
          <div className="mt-24">
            <Link className="btn btn-primary" to="/login">Back to Sign In</Link>
          </div>
        </>
      )}
    </AuthFrame>
  );
}
