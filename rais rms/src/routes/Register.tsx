import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function Register() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenantName: "",
    tenantSlug: "",
    ownerName: "",
    ownerEmail: "",
    password: "",
    outletName: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: "USD",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/register", form);
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="d-flex justify-content-center align-items-center py-5 bg-light min-vh-100">
      <div className="card rais-card p-4" style={{ width: 480 }}>
        <h1 className="h4 mb-3">Create your restaurant</h1>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="row g-2 mb-2">
            <div className="col">
              <label className="form-label">Restaurant / group name</label>
              <input
                className="form-control"
                value={form.tenantName}
                onChange={(e) => update("tenantName", e.target.value)}
                required
              />
            </div>
            <div className="col">
              <label className="form-label">URL slug</label>
              <input
                className="form-control"
                value={form.tenantSlug}
                onChange={(e) => update("tenantSlug", e.target.value.toLowerCase())}
                placeholder="my-restaurant"
                required
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="form-label">First outlet name</label>
            <input
              className="form-control"
              value={form.outletName}
              onChange={(e) => update("outletName", e.target.value)}
              required
            />
          </div>
          <div className="row g-2 mb-2">
            <div className="col">
              <label className="form-label">Currency</label>
              <input
                className="form-control"
                value={form.currency}
                maxLength={3}
                onChange={(e) => update("currency", e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="col">
              <label className="form-label">Timezone</label>
              <input
                className="form-control"
                value={form.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                required
              />
            </div>
          </div>
          <hr />
          <div className="mb-2">
            <label className="form-label">Your name</label>
            <input
              className="form-control"
              value={form.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              required
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Your email</label>
            <input
              type="email"
              className="form-control"
              value={form.ownerEmail}
              onChange={(e) => update("ownerEmail", e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={form.password}
              minLength={8}
              onChange={(e) => update("password", e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create restaurant"}
          </button>
        </form>
        <div className="text-center mt-3 small">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
