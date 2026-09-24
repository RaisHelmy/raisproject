import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { CONSENT_TEXTS } from "../consentText";

interface Job {
  id: string;
  type: string;
  status: string;
  paymentMethod: string;
  deliveryFeeMinor: number;
  createdAt: string;
}

const JOB_TYPES = ["food_order", "item_order", "fetch", "delivery", "ride"] as const;

export default function ClientDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [type, setType] = useState<(typeof JOB_TYPES)[number]>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gateway">("cash");
  const [feeRinggit, setFeeRinggit] = useState("10.00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCodModal, setShowCodModal] = useState(false);

  async function loadJobs() {
    try {
      const list = await api.get<Job[]>("/jobs/mine");
      setJobs(list);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function createJob() {
    setError(null);
    setBusy(true);
    try {
      const deliveryFeeMinor = Math.round(parseFloat(feeRinggit) * 100);
      await api.post("/jobs", {
        type,
        paymentMethod,
        deliveryFeeMinor,
        codConsentVersion: paymentMethod === "cash" ? "cod-checkout-v1" : undefined,
      });
      await loadJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create job");
    } finally {
      setBusy(false);
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    // Second required COD warning — shown every time cash is selected at
    // checkout, on top of the one-time anonymity opt-in warning.
    if (paymentMethod === "cash") {
      setShowCodModal(true);
      return;
    }
    createJob();
  }

  return (
    <div className="row g-4">
      <div className="col-md-5">
        <h3>Post a job</h3>
        <form onSubmit={onCreate} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value as never)}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Payment</label>
            <select
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as never)}
            >
              <option value="cash">Cash</option>
              <option value="gateway">Card / e-wallet (gateway)</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Fee offered (RM)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              min="0.01"
              value={feeRinggit}
              onChange={(e) => setFeeRinggit(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post job"}
          </button>
        </form>
        <p className="text-muted small mt-2">
          Need a recurring booking (ride to work, standing orders)? <Link to="/client/schedules">Set up a schedule</Link>.
        </p>
      </div>

      <div className="col-md-7">
        <h3>My jobs</h3>
        {jobs.length === 0 && <p className="text-muted">No jobs yet.</p>}
        <div className="list-group">
          {jobs.map((j) => (
            <Link
              key={j.id}
              to={`/client/jobs/${j.id}`}
              className="list-group-item list-group-item-action d-flex justify-content-between"
            >
              <span>
                {j.type} · <span className="badge text-bg-secondary">{j.status}</span>
              </span>
              <span>RM {(j.deliveryFeeMinor / 100).toFixed(2)}</span>
            </Link>
          ))}
        </div>
      </div>

      {showCodModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Paying cash on delivery</h5>
              </div>
              <div className="modal-body">
                <p>{CONSENT_TEXTS["cod-checkout-v1"]}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCodModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowCodModal(false);
                    createJob();
                  }}
                >
                  I understand — post job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
