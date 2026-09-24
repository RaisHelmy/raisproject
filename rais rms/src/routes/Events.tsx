import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";

interface TicketEventRow {
  id: string;
  name: string;
  starts_at: number;
  price_minor: number;
  currency: string;
  capacity: number;
}

export function Events() {
  const { outletId, outlets } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", date: "", time: "19:00", price: "50.00", capacity: 20 });

  const currency = outlets.find((o) => o.id === outletId)?.currency ?? "USD";

  const eventsQuery = useQuery({
    queryKey: ["events", outletId],
    queryFn: () => api.get<TicketEventRow[]>(`/api/outlets/${outletId}/events`),
    enabled: !!outletId,
  });

  const createEvent = useMutation({
    mutationFn: () =>
      api.post(`/api/outlets/${outletId}/events`, {
        name: form.name,
        startsAt: new Date(`${form.date}T${form.time}:00`).getTime(),
        priceMinor: Math.round(Number(form.price) * 100),
        currency,
        capacity: Number(form.capacity),
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["events", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim() && form.date) createEvent.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Events &amp; Experiences</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New event</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Name</label>
                <input
                  className="form-control form-control-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Chef's Table"
                />
              </div>
              <div className="row g-2 mb-2">
                <div className="col">
                  <label className="form-label small">Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Time</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="row g-2 mb-3">
                <div className="col">
                  <label className="form-label small">Price ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control form-control-sm"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={createEvent.isPending}>
                Create event
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Upcoming events</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>When</th>
                  <th>Price</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {(eventsQuery.data ?? []).map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.name}</td>
                    <td>{new Date(ev.starts_at).toLocaleString()}</td>
                    <td>
                      {(ev.price_minor / 100).toFixed(2)} {ev.currency}
                    </td>
                    <td>{ev.capacity}</td>
                  </tr>
                ))}
                {eventsQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-3">
                      No events yet.
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
