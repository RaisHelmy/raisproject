import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../lib/api";
import type { Guest } from "../../shared/types";

interface GuestVisit {
  id: string;
  outlet_id: string;
  starts_at: number;
  party_size: number;
  status: string;
}
interface GuestNote {
  id: string;
  note: string;
  created_at: number;
}
interface LoyaltyAccount {
  points_balance: number;
  tier: string;
}

function GuestDetail({ guestId, onClose }: { guestId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");

  const guestQuery = useQuery({
    queryKey: ["guest", guestId],
    queryFn: () => api.get<Guest & { tags: string[] }>(`/api/guests/${guestId}`),
  });
  const visitsQuery = useQuery({
    queryKey: ["guest-visits", guestId],
    queryFn: () => api.get<GuestVisit[]>(`/api/guests/${guestId}/visits`),
  });
  const notesQuery = useQuery({
    queryKey: ["guest-notes", guestId],
    queryFn: () => api.get<GuestNote[]>(`/api/guests/${guestId}/notes`),
  });
  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", guestId],
    queryFn: () => api.get<LoyaltyAccount>(`/api/loyalty/${guestId}`),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/api/guests/${guestId}/notes`, { note: noteText }),
    onSuccess: () => {
      setNoteText("");
      void queryClient.invalidateQueries({ queryKey: ["guest-notes", guestId] });
    },
  });

  const guest = guestQuery.data;

  return (
    <div
      className="position-fixed top-0 end-0 h-100 bg-white shadow p-4"
      style={{ width: 420, overflowY: "auto", zIndex: 1040 }}
    >
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h2 className="h5 mb-0">{guest?.name}</h2>
          <div className="text-muted small">
            {guest?.email} {guest?.phone && `· ${guest.phone}`}
          </div>
        </div>
        <button className="btn-close" onClick={onClose} aria-label="Close" />
      </div>

      {guest && guest.tags.length > 0 && (
        <div className="mb-3">
          {guest.tags.map((t) => (
            <span key={t} className="badge text-bg-info me-1">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="card rais-card p-2 mb-3">
        <div className="d-flex justify-content-between">
          <span className="small text-muted">Loyalty</span>
          <span className="text-capitalize small">{loyaltyQuery.data?.tier}</span>
        </div>
        <div className="fs-4 fw-bold">{loyaltyQuery.data?.points_balance ?? 0} pts</div>
      </div>

      <h3 className="h6">Visit history</h3>
      <ul className="list-group list-group-flush mb-3">
        {(visitsQuery.data ?? []).map((v) => (
          <li key={v.id} className="list-group-item px-0 d-flex justify-content-between small">
            <span>{new Date(v.starts_at).toLocaleDateString()}</span>
            <span>{v.party_size} guests</span>
            <span className="text-capitalize">{v.status}</span>
          </li>
        ))}
        {visitsQuery.data?.length === 0 && <li className="list-group-item px-0 text-muted small">No visits yet.</li>}
      </ul>

      <h3 className="h6">Notes</h3>
      <ul className="list-group list-group-flush mb-2">
        {(notesQuery.data ?? []).map((n) => (
          <li key={n.id} className="list-group-item px-0 small">
            {n.note}
            <div className="text-muted">{new Date(n.created_at).toLocaleString()}</div>
          </li>
        ))}
        {notesQuery.data?.length === 0 && <li className="list-group-item px-0 text-muted small">No notes yet.</li>}
      </ul>
      <form
        className="d-flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (noteText.trim()) addNote.mutate();
        }}
      >
        <input
          className="form-control form-control-sm"
          placeholder="Add a note…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
        <button className="btn btn-sm btn-primary" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}

export function Guests() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const guestsQuery = useQuery({
    queryKey: ["guests", search],
    queryFn: () => api.get<Guest[]>("/api/guests", { pageSize: 50, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/api/guests", {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        marketingConsent: false,
      }),
    onSuccess: () => {
      setForm({ name: "", email: "", phone: "" });
      void queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim()) createMutation.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Guest CRM</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New guest</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Name</label>
                <input
                  className="form-control form-control-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label small">Email</label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">Phone</label>
                <input
                  className="form-control form-control-sm"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={createMutation.isPending}>
                Add guest
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h6 mb-0">All guests</h2>
              <input
                className="form-control form-control-sm"
                style={{ width: 220 }}
                placeholder="Search name/email/phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {(guestsQuery.data ?? []).map((g) => (
                  <tr key={g.id} role="button" onClick={() => setSelectedGuestId(g.id)}>
                    <td>{g.name}</td>
                    <td>{g.email ?? "-"}</td>
                    <td>{g.phone ?? "-"}</td>
                  </tr>
                ))}
                {guestsQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-muted text-center py-3">
                      No guests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedGuestId && <GuestDetail guestId={selectedGuestId} onClose={() => setSelectedGuestId(null)} />}
    </div>
  );
}
