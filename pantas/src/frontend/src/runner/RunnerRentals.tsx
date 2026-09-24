import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Listing {
  id: string;
  ownerUserId: string;
  vehicleId: string;
  dailyRateMinor: number;
  declaredDepositMinor: number | null;
}

interface Booking {
  id: string;
  listingId: string;
  status: string;
  totalFeeMinor: number;
}

export default function RunnerRentals() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, { start: string; end: string }>>({});

  async function load() {
    try {
      const [l, b] = await Promise.all([
        api.get<Listing[]>("/rentals/listings"),
        api.get<Booking[]>("/rentals/bookings/mine"),
      ]);
      setListings(l);
      setBookings(b);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function book(listing: Listing) {
    setError(null);
    const d = dates[listing.id];
    if (!d?.start || !d?.end) {
      setError("Pick start and end dates first");
      return;
    }
    const days = Math.max(
      1,
      Math.round((new Date(d.end).getTime() - new Date(d.start).getTime()) / 86400000),
    );
    try {
      await api.post("/rentals/bookings", {
        listingId: listing.id,
        startDate: d.start,
        endDate: d.end,
        totalFeeMinor: listing.dailyRateMinor * days,
        paymentMethod: "cash",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not book");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-7">
        <h4>Vehicles available to rent</h4>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <div className="list-group">
          {listings.map((l) => (
            <div key={l.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  RM {(l.dailyRateMinor / 100).toFixed(2)}/day
                  {l.declaredDepositMinor && (
                    <span className="text-muted">
                      {" "}
                      · deposit RM {(l.declaredDepositMinor / 100).toFixed(2)} (collected directly by owner,
                      not via Pantas)
                    </span>
                  )}
                </div>
              </div>
              <div className="d-flex gap-2 mt-2">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  onChange={(e) =>
                    setDates((s) => ({ ...s, [l.id]: { ...s[l.id], start: e.target.value } as never }))
                  }
                />
                <input
                  type="date"
                  className="form-control form-control-sm"
                  onChange={(e) =>
                    setDates((s) => ({ ...s, [l.id]: { ...s[l.id], end: e.target.value } as never }))
                  }
                />
                <button className="btn btn-sm btn-primary" onClick={() => book(l)}>
                  Request booking
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-md-5">
        <h4>My bookings</h4>
        <ul className="list-group">
          {bookings.map((b) => (
            <li key={b.id} className="list-group-item">
              RM {(b.totalFeeMinor / 100).toFixed(2)} · <span className="badge text-bg-secondary">{b.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
