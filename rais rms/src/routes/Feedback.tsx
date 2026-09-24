import { useQuery } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api } from "../lib/api";

interface FeedbackRow {
  id: string;
  scores: { ambiance?: number; service?: number; value?: number; food?: number } | null;
  comment: string | null;
  is_private: boolean;
  routed_to_public: boolean;
  created_at: number;
}

function average(scores: FeedbackRow["scores"]): string {
  if (!scores) return "-";
  const values = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return "-";
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

export function Feedback() {
  const { outletId } = useOutlet();

  const feedbackQuery = useQuery({
    queryKey: ["feedback", outletId],
    queryFn: () => api.get<FeedbackRow[]>(`/api/outlets/${outletId}/feedback`),
    enabled: !!outletId,
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const items = feedbackQuery.data ?? [];
  const priv = items.filter((i) => i.is_private);
  const pub = items.filter((i) => !i.is_private);

  return (
    <div>
      <h1 className="h3 mb-4">Guest Feedback</h1>
      <div className="row g-3">
        <div className="col-md-6">
          <div className="card rais-card p-3 h-100">
            <h2 className="h6 text-danger">Needs attention ({priv.length})</h2>
            <p className="text-muted small">Average score below 4/5 — kept private, not funneled to public reviews.</p>
            {priv.map((f) => (
              <div key={f.id} className="border rounded p-2 mb-2">
                <div className="d-flex justify-content-between">
                  <strong>{average(f.scores)} / 5</strong>
                  <small className="text-muted">{new Date(f.created_at).toLocaleDateString()}</small>
                </div>
                {f.comment && <p className="mb-0 small">{f.comment}</p>}
              </div>
            ))}
            {priv.length === 0 && <p className="text-muted small">Nothing here.</p>}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card rais-card p-3 h-100">
            <h2 className="h6 text-success">Happy guests ({pub.length})</h2>
            <p className="text-muted small">Average score 4+/5 — funneled toward a public review link.</p>
            {pub.map((f) => (
              <div key={f.id} className="border rounded p-2 mb-2">
                <div className="d-flex justify-content-between">
                  <strong>{average(f.scores)} / 5</strong>
                  <small className="text-muted">{new Date(f.created_at).toLocaleDateString()}</small>
                </div>
                {f.comment && <p className="mb-0 small">{f.comment}</p>}
              </div>
            ))}
            {pub.length === 0 && <p className="text-muted small">Nothing here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
