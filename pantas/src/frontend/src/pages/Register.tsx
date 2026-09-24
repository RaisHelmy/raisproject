import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api";
import { CONSENT_TEXTS } from "../consentText";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"purchaser" | "runner" | "vendor">("purchaser");
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onAnonymousToggle(checked: boolean) {
    if (checked) {
      setShowConsentModal(true);
      setConsentTicked(false);
    } else {
      setAnonymousMode(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        realName,
        phone,
        password,
        role,
        anonymousMode,
        consentVersion: anonymousMode ? "anonymity-v1" : undefined,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <h2>Register</h2>
        <form onSubmit={onSubmit} className="mt-3">
          <div className="mb-3">
            <label className="form-label">Full name</label>
            <input className="form-control" value={realName} onChange={(e) => setRealName(e.target.value)} required />
            <div className="form-text">Always stored, even in anonymous mode — masking is display-only.</div>
          </div>
          <div className="mb-3">
            <label className="form-label">Phone</label>
            <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              minLength={8}
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">I want to register as a</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="purchaser">Purchaser</option>
              <option value="runner">Runner</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="anon"
              checked={anonymousMode}
              onChange={(e) => onAnonymousToggle(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="anon">
              Operate anonymously toward other users
            </label>
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary w-100" disabled={busy}>
            {busy ? "Registering…" : "Register"}
          </button>
        </form>
        <p className="mt-3 text-muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>

      {showConsentModal && (
        <div className="modal d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Before you go anonymous</h5>
              </div>
              <div className="modal-body">
                <p>{CONSENT_TEXTS["anonymity-v1"]}</p>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="ack"
                    checked={consentTicked}
                    onChange={(e) => setConsentTicked(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="ack">
                    I understand
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowConsentModal(false);
                    setAnonymousMode(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!consentTicked}
                  onClick={() => {
                    setAnonymousMode(true);
                    setShowConsentModal(false);
                  }}
                >
                  Continue anonymously
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
