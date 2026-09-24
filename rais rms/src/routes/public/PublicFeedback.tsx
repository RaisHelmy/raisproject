import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiClientError } from "../../lib/api";

const CATEGORIES: { key: "ambiance" | "service" | "value" | "food"; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "service", label: "Service" },
  { key: "ambiance", label: "Ambiance" },
  { key: "value", label: "Value" },
];

export function PublicFeedback() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.post(`/api/public/${tenantSlug}/reservations/${id}/feedback?token=${encodeURIComponent(token)}`, {
        scores,
        comment: comment || undefined,
      }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Could not submit feedback"),
  });

  if (done) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h1 className="h4">Thank you!</h1>
        <p className="text-muted">We appreciate you taking the time.</p>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="h4 mb-3">How was your visit?</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card rais-card p-4">
        {CATEGORIES.map((cat) => (
          <div className="mb-3" key={cat.key}>
            <label className="form-label small">{cat.label}</label>
            <div className="d-flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${scores[cat.key] === n ? "btn-warning" : "btn-outline-warning"}`}
                  onClick={() => setScores((s) => ({ ...s, [cat.key]: n }))}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="mb-3">
          <label className="form-label small">Anything else?</label>
          <textarea className="form-control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <button
          className="btn btn-primary w-100"
          disabled={Object.keys(scores).length === 0 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          Submit feedback
        </button>
      </div>
    </div>
  );
}
