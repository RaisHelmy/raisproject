import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";

interface StaffUser {
  id: string;
  name: string;
  email: string;
}
interface ShiftRow {
  id: string;
  user_id: string;
  starts_at: number;
  ends_at: number;
  role: string;
}

export function Schedule() {
  const { outletId } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ userId: "", date: new Date().toISOString().slice(0, 10), start: "09:00", end: "17:00", role: "server" });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<StaffUser[]>("/api/users"),
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", outletId],
    queryFn: () => api.get<ShiftRow[]>(`/api/outlets/${outletId}/shifts`),
    enabled: !!outletId,
  });

  const createShift = useMutation({
    mutationFn: () =>
      api.post(`/api/outlets/${outletId}/shifts`, {
        userId: form.userId,
        startsAt: new Date(`${form.date}T${form.start}:00`).getTime(),
        endsAt: new Date(`${form.date}T${form.end}:00`).getTime(),
        role: form.role,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shifts", outletId] }),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const deleteShift = useMutation({
    mutationFn: (shiftId: string) => api.del(`/api/outlets/${outletId}/shifts/${shiftId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shifts", outletId] }),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const users = usersQuery.data ?? [];
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.userId) createShift.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Staff Schedule</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New shift</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Staff member</label>
                <select
                  className="form-select form-select-sm"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small">Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="row g-2 mb-2">
                <div className="col">
                  <label className="form-label small">Start</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">End</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={form.end}
                    onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">Role for this shift</label>
                <input
                  className="form-control form-control-sm"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={createShift.isPending}>
                Schedule shift
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Upcoming shifts</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>When</th>
                  <th>Role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(shiftsQuery.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{userName(s.user_id)}</td>
                    <td>
                      {new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleTimeString()}
                    </td>
                    <td className="text-capitalize">{s.role}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteShift.mutate(s.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {shiftsQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-3">
                      No shifts scheduled.
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
