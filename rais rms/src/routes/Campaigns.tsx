import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../lib/api";

interface CampaignRow {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  trigger: "birthday" | "winback" | "top_spender" | "manual";
  status: "draft" | "active" | "paused" | "archived";
  subject: string | null;
  body: string;
}

export function Campaigns() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    trigger: "manual" as CampaignRow["trigger"],
    subject: "",
    body: "",
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api.get<CampaignRow[]>("/api/campaigns"),
  });

  const createCampaign = useMutation({
    mutationFn: () => api.post("/api/campaigns", { channel: "email", ...form }),
    onSuccess: () => {
      setForm({ trigger: "manual", subject: "", body: "" });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: CampaignRow["status"] }) =>
      api.patch(`/api/campaigns/${input.id}/status`, { status: input.status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.body.trim()) createCampaign.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Marketing Campaigns</h1>
      <p className="text-muted small">
        Automated triggers (birthday / winback / top spender) fire daily once activated — a scheduled caller hits{" "}
        <code>/api/cron/campaigns</code>. Manual campaigns send to a guest list from this page.
      </p>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New campaign (email)</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Trigger</label>
                <select
                  className="form-select form-select-sm"
                  value={form.trigger}
                  onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value as CampaignRow["trigger"] }))}
                >
                  <option value="manual">Manual send</option>
                  <option value="birthday">Birthday</option>
                  <option value="winback">Win-back (90d inactive)</option>
                  <option value="top_spender">Top spender</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small">Subject</label>
                <input
                  className="form-control form-control-sm"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">Body (HTML)</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit">
                Create draft
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Campaigns</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Trigger</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(campaignsQuery.data ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="text-capitalize">{c.trigger.replace("_", " ")}</td>
                    <td>{c.subject ?? "-"}</td>
                    <td>
                      <span
                        className={`badge ${c.status === "active" ? "text-bg-success" : "text-bg-secondary"} text-capitalize`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="text-end">
                      {c.status === "active" ? (
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => statusMutation.mutate({ id: c.id, status: "paused" })}>
                          Pause
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-outline-success" onClick={() => statusMutation.mutate({ id: c.id, status: "active" })}>
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {campaignsQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-3">
                      No campaigns yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
