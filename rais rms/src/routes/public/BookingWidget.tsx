import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiClientError } from "../../lib/api";

interface PublicOutlet {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}
interface AvailabilitySlot {
  startsAt: number;
  serviceId: string;
  serviceName: string;
  remainingCapacity: number;
}

export function BookingWidget() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [outletId, setOutletId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partySize, setPartySize] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [confirmation, setConfirmation] = useState<{ manageUrl: string; startsAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outletsQuery = useQuery({
    queryKey: ["public-outlets", tenantSlug],
    queryFn: () => api.get<PublicOutlet[]>(`/api/public/${tenantSlug}/outlets`),
    enabled: !!tenantSlug,
  });

  const activeOutletId = outletId ?? outletsQuery.data?.[0]?.id ?? null;

  const availabilityQuery = useQuery({
    queryKey: ["availability", tenantSlug, activeOutletId, date, partySize],
    queryFn: () =>
      api.get<AvailabilitySlot[]>(`/api/public/${tenantSlug}/outlets/${activeOutletId}/availability`, {
        date,
        partySize,
      }),
    enabled: !!tenantSlug && !!activeOutletId,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post<{ manageUrl: string; reservation: { starts_at: number } }>(
        `/api/public/${tenantSlug}/outlets/${activeOutletId}/reservations`,
        {
          guestName: guest.name,
          guestEmail: guest.email || undefined,
          guestPhone: guest.phone || undefined,
          startsAt: selectedSlot,
          partySize,
        },
      ),
    onSuccess: (data) => setConfirmation({ manageUrl: data.manageUrl, startsAt: data.reservation.starts_at }),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Could not book — please try another time"),
  });

  const outlet = outletsQuery.data?.find((o) => o.id === activeOutletId);

  if (confirmation) {
    return (
      <div className="container py-5" style={{ maxWidth: 480 }}>
        <div className="card rais-card p-4 text-center">
          <h1 className="h4">You're booked!</h1>
          <p className="text-muted">{new Date(confirmation.startsAt).toLocaleString()}</p>
          <a className="btn btn-outline-primary btn-sm mt-2" href={confirmation.manageUrl}>
            Manage this reservation
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 560 }}>
      <h1 className="h3 mb-4">Reserve a table</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card rais-card p-4">
        {outletsQuery.data && outletsQuery.data.length > 1 && (
          <div className="mb-3">
            <label className="form-label">Location</label>
            <select className="form-select" value={activeOutletId ?? ""} onChange={(e) => setOutletId(e.target.value)}>
              {outletsQuery.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row g-2 mb-3">
          <div className="col">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col">
            <label className="form-label">Party size</label>
            <input
              type="number"
              min={1}
              className="form-control"
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            />
          </div>
        </div>

        <label className="form-label">Available times</label>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {(availabilityQuery.data ?? []).map((slot) => (
            <button
              key={slot.startsAt}
              type="button"
              className={`btn btn-sm ${selectedSlot === slot.startsAt ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setSelectedSlot(slot.startsAt)}
            >
              {new Date(slot.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </button>
          ))}
          {availabilityQuery.isSuccess && availabilityQuery.data.length === 0 && (
            <p className="text-muted small mb-0">No availability for that date/party size.</p>
          )}
        </div>

        {selectedSlot && (
          <>
            <hr />
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input className="form-control" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} />
            </div>
            <div className="row g-2 mb-3">
              <div className="col">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={guest.email}
                  onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                />
              </div>
              <div className="col">
                <label className="form-label">Phone</label>
                <input
                  className="form-control"
                  value={guest.phone}
                  onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="btn btn-primary w-100"
              disabled={!guest.name.trim() || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
            >
              {bookMutation.isPending ? "Booking…" : `Confirm for ${partySize} at ${outlet?.name ?? ""}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
