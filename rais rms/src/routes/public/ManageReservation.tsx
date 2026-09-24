import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../../lib/api";

interface ReservationDetail {
  reservation: {
    id: string;
    starts_at: number;
    party_size: number;
    status: string;
  };
  guestName: string | null;
}

export function ManageReservation() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const query = useQuery({
    queryKey: ["public-reservation", tenantSlug, id, token],
    queryFn: () => api.get<ReservationDetail>(`/api/public/${tenantSlug}/reservations/${id}`, { token }),
    enabled: !!tenantSlug && !!id && !!token,
  });

  const manage = useMutation({
    mutationFn: (body: { action: "cancel" | "reschedule"; startsAt?: number }) =>
      api.post(`/api/public/${tenantSlug}/reservations/${id}/manage?token=${encodeURIComponent(token)}`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["public-reservation", tenantSlug, id, token] }),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong"),
  });

  if (!token) return <div className="container py-5">Missing link token.</div>;
  if (query.isError) return <div className="container py-5">This reservation link is invalid or expired.</div>;

  const reservation = query.data?.reservation;

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="h4 mb-3">Your reservation</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {reservation && (
        <div className="card rais-card p-4">
          <p>
            <strong>{query.data?.guestName}</strong> — party of {reservation.party_size}
          </p>
          <p>{new Date(reservation.starts_at).toLocaleString()}</p>
          <p>
            Status: <span className="text-capitalize">{reservation.status}</span>
          </p>

          {reservation.status === "booked" && (
            <>
              <hr />
              <p className="small text-muted mb-2">Reschedule</p>
              <div className="row g-2 mb-2">
                <div className="col">
                  <input type="date" className="form-control form-control-sm" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div className="col">
                  <input type="time" className="form-control form-control-sm" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
              </div>
              <button
                className="btn btn-outline-primary btn-sm w-100 mb-2"
                disabled={!newDate || !newTime}
                onClick={() => manage.mutate({ action: "reschedule", startsAt: new Date(`${newDate}T${newTime}:00`).getTime() })}
              >
                Reschedule
              </button>
              <button className="btn btn-outline-danger btn-sm w-100" onClick={() => manage.mutate({ action: "cancel" })}>
                Cancel reservation
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
