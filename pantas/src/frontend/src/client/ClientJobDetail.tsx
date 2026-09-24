import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api";

interface Job {
  id: string;
  status: string;
  deliveryFeeMinor: number;
  paymentMethod: string;
  runnerUserId: string | null;
}

interface Offer {
  id: string;
  runnerUserId: string;
  proposedFeeMinor: number;
  status: string;
  message: string | null;
}

export default function ClientJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(5);

  async function load() {
    if (!id) return;
    try {
      const [j, o] = await Promise.all([
        api.get<Job>(`/jobs/${id}`),
        api.get<Offer[]>(`/offers/for-job/${id}`),
      ]);
      setJob(j);
      setOffers(o);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (!job) return error ? <div className="alert alert-danger">{error}</div> : <p>Loading…</p>;

  return (
    <div>
      <h3>Job {job.id.slice(0, 8)}</h3>
      <p>
        Status: <span className="badge text-bg-secondary">{job.status}</span> · RM{" "}
        {(job.deliveryFeeMinor / 100).toFixed(2)} ({job.paymentMethod})
      </p>
      {error && <div className="alert alert-danger">{error}</div>}

      {job.status === "posted" && (
        <>
          <h5>Counter-offers from runners</h5>
          {offers.filter((o) => o.status === "pending").length === 0 && (
            <p className="text-muted">No offers yet.</p>
          )}
          <ul className="list-group mb-3">
            {offers
              .filter((o) => o.status === "pending")
              .map((o) => (
                <li key={o.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>
                    RM {(o.proposedFeeMinor / 100).toFixed(2)} — runner {o.runnerUserId.slice(0, 8)}
                    {o.message && <em className="text-muted"> "{o.message}"</em>}
                  </span>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => act(() => api.post(`/offers/${o.id}/accept`))}
                  >
                    Accept
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {job.status === "delivered" && (
        <button className="btn btn-primary" onClick={() => act(() => api.post(`/jobs/${id}/settle`))}>
          Confirm receipt &amp; settle
        </button>
      )}

      {["draft", "posted", "claimed"].includes(job.status) && (
        <button
          className="btn btn-outline-danger ms-2"
          onClick={() => act(() => api.post(`/jobs/${id}/cancel`, { reason: "purchaser cancelled" }))}
        >
          Cancel job
        </button>
      )}

      {job.status === "settled" && job.runnerUserId && (
        <div className="card card-body mt-3">
          <h6>Rate this runner</h6>
          <div className="d-flex gap-2 align-items-center">
            <select
              className="form-select w-auto"
              value={ratingScore}
              onChange={(e) => setRatingScore(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} star{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <button
              className="btn btn-outline-primary"
              onClick={() =>
                act(() =>
                  api.post("/ratings", {
                    jobId: id,
                    rateeUserId: job.runnerUserId,
                    score: ratingScore,
                  }),
                )
              }
            >
              Submit rating
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
