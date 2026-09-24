import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Schedule {
  id: string;
  jobType: string;
  timeOfDay: string;
  status: string;
  deliveryFeeMinor: number;
  poolPreferred: boolean;
}

const DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function ClientSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [timeOfDay, setTimeOfDay] = useState("08:30");
  const [poolPreferred, setPoolPreferred] = useState(true);
  const [feeRinggit, setFeeRinggit] = useState("12.00");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setSchedules(await api.get<Schedule[]>("/schedules/mine"));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleDay(day: string) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/schedules", {
        jobType: "ride",
        daysOfWeek: days,
        timeOfDay,
        poolPreferred,
        deliveryFeeMinor: Math.round(parseFloat(feeRinggit) * 100),
        paymentMethod: "cash",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create schedule");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h3>Recurring ride (to work &amp; back)</h3>
        <form onSubmit={onCreate} className="card card-body">
          <label className="form-label">Days</label>
          <div className="mb-2 d-flex flex-wrap gap-2">
            {DAY_CODES.map((d) => (
              <div className="form-check form-check-inline" key={d}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`day-${d}`}
                  checked={days.includes(d)}
                  onChange={() => toggleDay(d)}
                />
                <label className="form-check-label" htmlFor={`day-${d}`}>
                  {d}
                </label>
              </div>
            ))}
          </div>
          <div className="mb-2">
            <label className="form-label">Time</label>
            <input
              type="time"
              className="form-control"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
            />
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="pool"
              checked={poolPreferred}
              onChange={(e) => setPoolPreferred(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="pool">
              Prefer pooled (shared) rides
            </label>
          </div>
          <div className="mb-2">
            <label className="form-label">Fee per ride (RM)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              value={feeRinggit}
              onChange={(e) => setFeeRinggit(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary">Create schedule</button>
        </form>
      </div>
      <div className="col-md-6">
        <h3>My schedules</h3>
        {schedules.length === 0 && <p className="text-muted">None yet.</p>}
        <ul className="list-group">
          {schedules.map((s) => (
            <li key={s.id} className="list-group-item">
              {s.jobType} at {s.timeOfDay} · RM {(s.deliveryFeeMinor / 100).toFixed(2)} ·{" "}
              <span className="badge text-bg-secondary">{s.status}</span>
              {s.poolPreferred && <span className="badge text-bg-info ms-1">pool preferred</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
