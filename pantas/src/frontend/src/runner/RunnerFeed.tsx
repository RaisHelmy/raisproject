import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { CONSENT_TEXTS } from "../consentText";

interface Job {
  id: string;
  type: string;
  status: string;
  paymentMethod: string;
  deliveryFeeMinor: number;
}

export default function RunnerFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tollAckJobId, setTollAckJobId] = useState<string | null>(null);
  const [offerAmounts, setOfferAmounts] = useState<Record<string, string>>({});
  const [seeAnonymousCod, setSeeAnonymousCod] = useState(false);
  const [showCodOptInModal, setShowCodOptInModal] = useState(false);

  async function load() {
    try {
      setJobs(await api.get<Job[]>("/jobs/feed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmClaim(jobId: string) {
    setError(null);
    try {
      await api.post(`/jobs/${jobId}/claim`, { tollAcknowledgementVersion: "runner-toll-v1" });
      setTollAckJobId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not claim job");
    }
  }

  async function submitOffer(jobId: string) {
    setError(null);
    const amount = offerAmounts[jobId];
    if (!amount) return;
    try {
      await api.post("/offers", {
        jobId,
        proposedFeeMinor: Math.round(parseFloat(amount) * 100),
        tollAcknowledgementVersion: "runner-toll-v1",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit offer");
    }
  }

  async function onToggleAnonymousCod(checked: boolean) {
    if (checked) {
      setShowCodOptInModal(true);
      return;
    }
    await api.post("/auth/cod-preference", { autoRejectAnonymousCod: true });
    setSeeAnonymousCod(false);
    await load();
  }

  async function confirmCodOptIn() {
    await api.post("/auth/cod-preference", {
      autoRejectAnonymousCod: false,
      consentVersion: "runner-anonymous-cod-v1",
    });
    setSeeAnonymousCod(true);
    setShowCodOptInModal(false);
    await load();
  }

  return (
    <div>
      <h3>Open jobs</h3>
      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="anonCod"
          checked={seeAnonymousCod}
          onChange={(e) => onToggleAnonymousCod(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="anonCod">
          Show anonymous cash-on-delivery jobs (off by default — non-payment loss is yours if you opt in)
        </label>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {jobs.length === 0 && <p className="text-muted">Nothing open right now.</p>}
      <div className="list-group">
        {jobs.map((j) => (
          <div key={j.id} className="list-group-item">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <Link to={`/runner/jobs/${j.id}`}>{j.type}</Link> ·{" "}
                <span className="badge text-bg-secondary">{j.paymentMethod}</span> · RM{" "}
                {(j.deliveryFeeMinor / 100).toFixed(2)}
              </div>
              <div className="d-flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  className="form-control form-control-sm"
                  style={{ width: 110 }}
                  placeholder="Counter RM"
                  value={offerAmounts[j.id] ?? ""}
                  onChange={(e) => setOfferAmounts((s) => ({ ...s, [j.id]: e.target.value }))}
                />
                <button className="btn btn-sm btn-outline-primary" onClick={() => submitOffer(j.id)}>
                  Counter-offer
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setTollAckJobId(j.id)}>
                  Claim
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tollAckJobId && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Before you claim</h5>
              </div>
              <div className="modal-body">
                <p>{CONSENT_TEXTS["runner-toll-v1"]}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setTollAckJobId(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => confirmClaim(tollAckJobId)}>
                  I understand — claim job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCodOptInModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Opting in to anonymous COD jobs</h5>
              </div>
              <div className="modal-body">
                <p>{CONSENT_TEXTS["runner-anonymous-cod-v1"]}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCodOptInModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={confirmCodOptIn}>
                  I understand — opt in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
