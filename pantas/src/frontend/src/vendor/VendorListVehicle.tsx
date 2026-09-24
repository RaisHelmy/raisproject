import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Vehicle {
  id: string;
  brand: string;
  model: string;
}

interface Listing {
  id: string;
  vehicleId: string;
  dailyRateMinor: number;
  declaredDepositMinor: number | null;
  active: boolean;
}

/**
 * Trevo-style P2P rental: any user (vendor included) can register a
 * vehicle and list it for rent to runners or other vendors. Deposit is
 * declared only — collected directly between owner and renter, never held
 * by Pantas (see CLAUDE.md "Vehicle rental (peer-to-peer)").
 */
export default function VendorListVehicle() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [dailyRateRinggit, setDailyRateRinggit] = useState("80.00");
  const [depositRinggit, setDepositRinggit] = useState("300.00");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [v, l] = await Promise.all([
        api.get<Vehicle[]>("/vehicles"),
        api.get<Listing[]>("/rentals/listings"),
      ]);
      setVehicles(v);
      setListings(l);
      if (v[0]) setVehicleId(v[0].id);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function registerVehicle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/vehicles", { vehicleType: "car", brand, model, plateNumber });
      setBrand("");
      setModel("");
      setPlateNumber("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register vehicle");
    }
  }

  async function createListing(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicleId) {
      setError("Register a vehicle first");
      return;
    }
    try {
      await api.post("/rentals/listings", {
        vehicleId,
        dailyRateMinor: Math.round(parseFloat(dailyRateRinggit) * 100),
        declaredDepositMinor: depositRinggit ? Math.round(parseFloat(depositRinggit) * 100) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create listing");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h4>1. Register the vehicle</h4>
        <form onSubmit={registerVehicle} className="card card-body mb-3">
          <div className="row">
            <div className="col mb-2">
              <label className="form-label">Brand</label>
              <input className="form-control" value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
            <div className="col mb-2">
              <label className="form-label">Model</label>
              <input className="form-control" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>
          <div className="mb-2">
            <label className="form-label">Plate number</label>
            <input className="form-control" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required />
          </div>
          <button className="btn btn-outline-primary">Register vehicle</button>
        </form>

        <h4>2. List it for rent</h4>
        <form onSubmit={createListing} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Vehicle</label>
            <select className="form-select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">Daily rate (RM)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              value={dailyRateRinggit}
              onChange={(e) => setDailyRateRinggit(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Deposit you'll collect directly from the renter (RM)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              value={depositRinggit}
              onChange={(e) => setDepositRinggit(e.target.value)}
            />
            <div className="form-text">
              Pantas never holds this — it's an attestation only, collected and returned between you and
              the renter.
            </div>
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary">List for rent</button>
        </form>
      </div>

      <div className="col-md-6">
        <h4>My listings</h4>
        <ul className="list-group">
          {listings.map((l) => (
            <li key={l.id} className="list-group-item">
              RM {(l.dailyRateMinor / 100).toFixed(2)}/day
              {l.declaredDepositMinor && ` · deposit RM ${(l.declaredDepositMinor / 100).toFixed(2)}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
