import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppError } from "@raisai/shared";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(email, password, name);
      navigate("/create", { replace: true });
    } catch (err) {
      setError(err instanceof AppError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account. Your first image is free to try once you add balance.">
      <form onSubmit={onSubmit} noValidate>
        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Name</label>
          <input id="name" type="text" className="form-control" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Email</label>
          <input id="email" type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">Password</label>
          <input id="password" type="password" className="form-control" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div className="form-text">At least 8 characters.</div>
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-center text-secondary small mt-3 mb-0">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
