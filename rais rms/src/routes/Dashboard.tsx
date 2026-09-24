import { useQuery } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api } from "../lib/api";
import { CoversChart } from "../charts/CoversChart";
import { NoShowChart } from "../charts/NoShowChart";

interface CoversByDay {
  day: string;
  covers: number;
  reservations: number;
}

interface NoShowStats {
  total: number;
  noShows: number;
  rate: number;
}

interface GuestStats {
  newGuests: number;
  repeatGuests: number;
}

function rangeLast30Days() {
  const to = Date.now();
  const from = to - 30 * 24 * 60 * 60 * 1000;
  return { from, to };
}

export function Dashboard() {
  const { outletId } = useOutlet();
  const { from, to } = rangeLast30Days();

  const covers = useQuery({
    queryKey: ["analytics", "covers", outletId, from, to],
    queryFn: () => api.get<CoversByDay[]>(`/api/analytics/${outletId}/covers`, { from, to }),
    enabled: !!outletId,
  });

  const noShows = useQuery({
    queryKey: ["analytics", "no-shows", outletId, from, to],
    queryFn: () => api.get<NoShowStats>(`/api/analytics/${outletId}/no-shows`, { from, to }),
    enabled: !!outletId,
  });

  const guests = useQuery({
    queryKey: ["analytics", "guests", outletId, from, to],
    queryFn: () => api.get<GuestStats>(`/api/analytics/${outletId}/guests`, { from, to }),
    enabled: !!outletId,
  });

  if (!outletId) {
    return <p className="text-muted">Create an outlet to see analytics.</p>;
  }

  const totalCovers = (covers.data ?? []).reduce((sum, d) => sum + d.covers, 0);
  const totalReservations = (covers.data ?? []).reduce((sum, d) => sum + d.reservations, 0);

  return (
    <div>
      <h1 className="h3 mb-4">Dashboard</h1>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card rais-card p-3">
            <div className="text-muted small">Covers (30d)</div>
            <div className="fs-3 fw-bold">{totalCovers}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card rais-card p-3">
            <div className="text-muted small">Reservations (30d)</div>
            <div className="fs-3 fw-bold">{totalReservations}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card rais-card p-3">
            <div className="text-muted small">No-show rate</div>
            <div className="fs-3 fw-bold">{((noShows.data?.rate ?? 0) * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card rais-card p-3">
            <div className="text-muted small">New vs repeat guests</div>
            <div className="fs-5 fw-bold">
              {guests.data?.newGuests ?? 0} / {guests.data?.repeatGuests ?? 0}
            </div>
          </div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <CoversChart
              categories={(covers.data ?? []).map((d) => d.day)}
              data={(covers.data ?? []).map((d) => d.covers)}
            />
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <NoShowChart
              noShows={noShows.data?.noShows ?? 0}
              completed={(noShows.data?.total ?? 0) - (noShows.data?.noShows ?? 0)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
