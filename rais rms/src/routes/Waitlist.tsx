import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";
import type { WaitlistEntry } from "../../shared/types";

export function Waitlist() {
  const { outletId } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ guestName: "", guestPhone: "", partySize: 2, quotedWait: 15 });

  const waitlistQuery = useQuery({
    queryKey: ["waitlist", outletId],
    queryFn: () => api.get<WaitlistEntry[]>(`/api/waitlist/${outletId}`),
    enabled: !!outletId,
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/waitlist/${outletId}`, {
        guestName: form.guestName || undefined,
        guestPhone: form.guestPhone || undefined,
        partySize: Number(form.partySize),
        quotedWait: Number(form.quotedWait),
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, guestName: "", guestPhone: "" }));
      void queryClient.invalidateQueries({ queryKey: ["waitlist", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: WaitlistEntry["status"] }) =>
      api.patch(`/api/waitlist/${outletId}/${input.id}`, { status: input.status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["waitlist", outletId] }),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Waitlist</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">Add to waitlist</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Guest name</label>
                <input
                  className="form-control form-control-sm"
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small">Phone</label>
                <input
                  className="form-control form-control-sm"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col">
                  <label className="form-label small">Party size</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control form-control-sm"
                    value={form.partySize}
                    onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Quoted wait (min)</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control form-control-sm"
                    value={form.quotedWait}
                    onChange={(e) => setForm((f) => ({ ...f, quotedWait: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={createMutation.isPending}>
                Add
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Waiting</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Quoted wait</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(waitlistQuery.data ?? []).map((w) => (
                  <tr key={w.id}>
                    <td>{w.party_size}</td>
                    <td>{w.quoted_wait ?? "-"} min</td>
                    <td>
                      <span className="badge text-bg-warning text-dark">{w.status}</span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-success"
                          onClick={() => statusMutation.mutate({ id: w.id, status: "seated" })}
                        >
                          Seat
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => statusMutation.mutate({ id: w.id, status: "cancelled" })}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {waitlistQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-3">
                      Nobody waiting.
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
