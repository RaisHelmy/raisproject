import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";
import { DepositModal } from "../components/DepositModal";
import type { Reservation, ReservationStatus, RTable } from "../../shared/types";

const STATUS_BADGE: Record<ReservationStatus, string> = {
  booked: "text-bg-primary",
  seated: "text-bg-info",
  completed: "text-bg-success",
  no_show: "text-bg-danger",
  cancelled: "text-bg-secondary",
};

export function Reservations() {
  const { outletId, outlets } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [depositFor, setDepositFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    date: new Date().toISOString().slice(0, 10),
    time: "19:00",
    partySize: 2,
  });

  const currency = outlets.find((o) => o.id === outletId)?.currency ?? "USD";

  const reservationsQuery = useQuery({
    queryKey: ["reservations", outletId],
    queryFn: () => api.get<Reservation[]>(`/api/reservations/${outletId}`, { pageSize: 100 }),
    enabled: !!outletId,
  });

  const tablesQuery = useQuery({
    queryKey: ["tables", outletId],
    queryFn: () => api.get<RTable[]>(`/api/outlets/${outletId}/tables`),
    enabled: !!outletId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const startsAt = new Date(`${form.date}T${form.time}:00`).getTime();
      return api.post(`/api/reservations/${outletId}`, {
        guestName: form.guestName || undefined,
        guestPhone: form.guestPhone || undefined,
        startsAt,
        partySize: Number(form.partySize),
        source: "widget",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", outletId] });
      setForm((f) => ({ ...f, guestName: "", guestPhone: "" }));
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed to create"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: ReservationStatus }) =>
      api.patch(`/api/reservations/${outletId}/${input.id}`, { status: input.status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reservations", outletId] }),
  });

  const assignTablesMutation = useMutation({
    mutationFn: (input: { id: string; tableIds: string[] }) =>
      api.patch(`/api/reservations/${outletId}/${input.id}`, { tableIds: input.tableIds }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reservations", outletId] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const tables = tablesQuery.data ?? [];

  return (
    <div>
      <h1 className="h3 mb-4">Reservations</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New reservation</h2>
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
              <div className="mb-3">
                <label className="form-label small">Party size</label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm"
                  value={form.partySize}
                  onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Booking…" : "Book reservation"}
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Upcoming</h2>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Party</th>
                    <th>Table(s)</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(reservationsQuery.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.starts_at).toLocaleString()}</td>
                      <td>{r.party_size}</td>
                      <td>
                        <select
                          multiple
                          size={1}
                          className="form-select form-select-sm"
                          style={{ minWidth: 110 }}
                          value={r.table_ids}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                            assignTablesMutation.mutate({ id: r.id, tableIds: selected });
                          }}
                        >
                          {tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {r.status === "booked" && (
                            <>
                              <button
                                className="btn btn-outline-success"
                                onClick={() => statusMutation.mutate({ id: r.id, status: "seated" })}
                              >
                                Seat
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => statusMutation.mutate({ id: r.id, status: "no_show" })}
                              >
                                No-show
                              </button>
                              <button
                                className="btn btn-outline-secondary"
                                onClick={() => statusMutation.mutate({ id: r.id, status: "cancelled" })}
                              >
                                Cancel
                              </button>
                              <button className="btn btn-outline-primary" onClick={() => setDepositFor(r.id)}>
                                $
                              </button>
                            </>
                          )}
                          {r.status === "seated" && (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => statusMutation.mutate({ id: r.id, status: "completed" })}
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reservationsQuery.data?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted text-center py-3">
                        No reservations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {depositFor && outletId && (
        <DepositModal
          outletId={outletId}
          reservationId={depositFor}
          currency={currency}
          onClose={() => setDepositFor(null)}
          onSuccess={() => setDepositFor(null)}
        />
      )}
    </div>
  );
}
