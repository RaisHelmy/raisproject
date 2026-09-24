import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api";

interface Job {
  id: string;
  status: string;
  type: string;
  deliveryFeeMinor: number;
  paymentMethod: string;
}

const NEXT_STEP: Record<string, { label: string; path: string } | undefined> = {
  claimed: { label: "Mark picked up", path: "picked-up" },
  picked_up: { label: "Mark in transit", path: "in-transit" },
  in_transit: { label: "Mark delivered", path: "delivered" },
};

export default function RunnerJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sosSent, setSosSent] = useState(false);

  async function load() {
    if (!id) return;
    try {
      setJob(await api.get<Job>(`/jobs/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function advance() {
    if (!id || !job) return;
    const step = NEXT_STEP[job.status];
    if (!step) return;
    setError(null);
    try {
      await api.post(`/jobs/${id}/${step.path}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update job");
    }
  }

  async function triggerSos() {
    if (!id) return;
    try {
      await api.post("/sos/trigger", { jobId: id });
      setSosSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not trigger SOS");
    }
  }

  async function reportNonPayment() {
    if (!id || !job) return;
    const amount = prompt("Amount not paid (RM)?", (job.deliveryFeeMinor / 100).toFixed(2));
    if (!amount) return;
    try {
      const result = await api.post<{ suspended: boolean }>(`/jobs/${id}/report-non-payment`, {
        amountMinor: Math.round(parseFloat(amount) * 100),
      });
      alert(
        result.suspended
          ? "Reported. This purchaser has been auto-suspended for repeated non-payment."
          : "Reported — tracked against the purchaser's account.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report non-payment");
    }
  }

  if (!job) return error ? <div className="alert alert-danger">{error}</div> : <p>Loading…</p>;
  const step = NEXT_STEP[job.status];

  return (
    <div>
      <h3>
        {job.type} job {job.id.slice(0, 8)}
      </h3>
      <p>
        Status: <span className="badge text-bg-secondary">{job.status}</span> · RM{" "}
        {(job.deliveryFeeMinor / 100).toFixed(2)}
      </p>
      {error && <div className="alert alert-danger">{error}</div>}
      {step && (
        <button className="btn btn-primary me-2" onClick={advance}>
          {step.label}
        </button>
      )}
      <button className="btn btn-danger" onClick={triggerSos} disabled={sosSent}>
        {sosSent ? "SOS sent — admin notified" : "🆘 Emergency SOS"}
      </button>
      {job.paymentMethod === "cash" && ["delivered", "settled"].includes(job.status) && (
        <button className="btn btn-outline-danger ms-2" onClick={reportNonPayment}>
          Report non-payment
        </button>
      )}
    </div>
  );
}
