import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Vehicle {
  id: string;
  vehicleType: string;
  brand: string;
  model: string;
  segment: string | null;
  leatherSeats: boolean;
  aircondCondition: string | null;
  active: boolean;
}

export default function RunnerVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car">("car");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [segment, setSegment] = useState("sedan");
  const [seatCount, setSeatCount] = useState(4);
  const [leatherSeats, setLeatherSeats] = useState(false);
  const [aircondCondition, setAircondCondition] = useState("good");
  const [engineCc, setEngineCc] = useState(150);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setVehicles(await api.get<Vehicle[]>("/vehicles"));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: Record<string, unknown> = { vehicleType, brand, model, plateNumber };
      if (vehicleType === "car") {
        Object.assign(body, { segment, seatCount, leatherSeats, aircondCondition });
      } else {
        Object.assign(body, { engineCc });
      }
      await api.post("/vehicles", body);
      setBrand("");
      setModel("");
      setPlateNumber("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register vehicle");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h4>Register a vehicle</h4>
        <form onSubmit={onCreate} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Type</label>
            <select className="form-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as never)}>
              <option value="car">Car</option>
              <option value="motorcycle">Motorcycle</option>
            </select>
          </div>
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

          {vehicleType === "car" ? (
            <>
              <div className="row">
                <div className="col mb-2">
                  <label className="form-label">Segment</label>
                  <select className="form-select" value={segment} onChange={(e) => setSegment(e.target.value)}>
                    {["hatchback", "sedan", "suv", "mpv", "pickup", "van"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col mb-2">
                  <label className="form-label">Seats</label>
                  <input
                    type="number"
                    className="form-control"
                    value={seatCount}
                    onChange={(e) => setSeatCount(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="mb-2">
                <label className="form-label">Aircond condition</label>
                <select
                  className="form-select"
                  value={aircondCondition}
                  onChange={(e) => setAircondCondition(e.target.value)}
                >
                  {["excellent", "good", "fair", "poor"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="leather"
                  checked={leatherSeats}
                  onChange={(e) => setLeatherSeats(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="leather">
                  Leather seats
                </label>
              </div>
            </>
          ) : (
            <div className="mb-2">
              <label className="form-label">Engine (cc)</label>
              <input
                type="number"
                className="form-control"
                value={engineCc}
                onChange={(e) => setEngineCc(Number(e.target.value))}
              />
            </div>
          )}
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary">Register</button>
        </form>
      </div>

      <div className="col-md-6">
        <h4>My vehicles</h4>
        <ul className="list-group">
          {vehicles.map((v) => (
            <li key={v.id} className="list-group-item">
              {v.brand} {v.model} ({v.vehicleType})
              {v.segment && <span className="text-muted"> · {v.segment}</span>}
              {v.leatherSeats && <span className="badge text-bg-light ms-1">leather</span>}
              {v.aircondCondition && <span className="badge text-bg-light ms-1">aircond: {v.aircondCondition}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
