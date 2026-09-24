import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";
import type { Area, RTable, ServiceShift } from "../../shared/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CANVAS_HEIGHT = 420;

export function FloorPlan() {
  const { outletId } = useOutlet();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [tableForm, setTableForm] = useState({ areaId: "", label: "", seatsMin: 2, seatsMax: 4 });
  const [serviceForm, setServiceForm] = useState({
    name: "",
    days: new Set<number>([1, 2, 3, 4, 5, 6]),
    startTime: "17:00",
    endTime: "22:00",
    turnMinutes: 90,
  });

  const areasQuery = useQuery({
    queryKey: ["areas", outletId],
    queryFn: () => api.get<Area[]>(`/api/outlets/${outletId}/areas`),
    enabled: !!outletId,
  });

  const tablesQuery = useQuery({
    queryKey: ["tables", outletId],
    queryFn: () => api.get<RTable[]>(`/api/outlets/${outletId}/tables`),
    enabled: !!outletId,
  });

  const servicesQuery = useQuery({
    queryKey: ["services", outletId],
    queryFn: () => api.get<ServiceShift[]>(`/api/outlets/${outletId}/services`),
    enabled: !!outletId,
  });

  const createArea = useMutation({
    mutationFn: () => api.post(`/api/outlets/${outletId}/areas`, { name: areaName }),
    onSuccess: () => {
      setAreaName("");
      void queryClient.invalidateQueries({ queryKey: ["areas", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const createTable = useMutation({
    mutationFn: () =>
      api.post(`/api/outlets/${outletId}/tables`, {
        areaId: tableForm.areaId,
        label: tableForm.label,
        seatsMin: Number(tableForm.seatsMin),
        seatsMax: Number(tableForm.seatsMax),
        x: 20 + Math.random() * 300,
        y: 20 + Math.random() * 260,
        combinable: true,
      }),
    onSuccess: () => {
      setTableForm((f) => ({ ...f, label: "" }));
      void queryClient.invalidateQueries({ queryKey: ["tables", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const createService = useMutation({
    mutationFn: () =>
      api.post(`/api/outlets/${outletId}/services`, {
        name: serviceForm.name,
        daysOfWeek: Array.from(serviceForm.days).sort(),
        startTime: serviceForm.startTime,
        endTime: serviceForm.endTime,
        turnTimeByPartySize: { default: Number(serviceForm.turnMinutes) },
      }),
    onSuccess: () => {
      setServiceForm((f) => ({ ...f, name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["services", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const moveTable = useMutation({
    mutationFn: (input: { id: string; x: number; y: number }) =>
      api.patch(`/api/outlets/${outletId}/tables/${input.id}`, { x: input.x, y: input.y }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tables", outletId] }),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const areas = areasQuery.data ?? [];
  const tables = tablesQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  function onAreaSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (areaName.trim()) createArea.mutate();
  }

  function onTableSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (tableForm.label.trim() && tableForm.areaId) createTable.mutate();
  }

  function onServiceSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (serviceForm.name.trim() && serviceForm.days.size > 0) createService.mutate();
  }

  function toggleDay(day: number) {
    setServiceForm((f) => {
      const next = new Set(f.days);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...f, days: next };
    });
  }

  function onDragStart(e: React.DragEvent<HTMLDivElement>, tableId: string) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    e.dataTransfer.setData("text/plain", tableId);
    e.dataTransfer.setData(
      "application/x-offset",
      JSON.stringify({ dx: e.clientX - rect.left, dy: e.clientY - rect.top }),
    );
  }

  function onCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const tableId = e.dataTransfer.getData("text/plain");
    if (!tableId || !canvasRef.current) return;
    const offset = JSON.parse(e.dataTransfer.getData("application/x-offset") || "{}");
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvasRect.width - 64, e.clientX - canvasRect.left - (offset.dx ?? 0)));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - 64, e.clientY - canvasRect.top - (offset.dy ?? 0)));
    moveTable.mutate({ id: tableId, x, y });
  }

  return (
    <div>
      <h1 className="h3 mb-4">Floor Plan</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3 mb-3">
            <h2 className="h6">Areas</h2>
            <ul className="list-group list-group-flush mb-2">
              {areas.map((a) => (
                <li className="list-group-item px-0" key={a.id}>
                  {a.name}
                </li>
              ))}
              {areas.length === 0 && <li className="list-group-item px-0 text-muted">No areas yet.</li>}
            </ul>
            <form onSubmit={onAreaSubmit} className="d-flex gap-2">
              <input
                className="form-control form-control-sm"
                placeholder="e.g. Patio"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
              <button className="btn btn-sm btn-primary" type="submit">
                Add
              </button>
            </form>
          </div>

          <div className="card rais-card p-3 mb-3">
            <h2 className="h6">New table</h2>
            <form onSubmit={onTableSubmit}>
              <div className="mb-2">
                <label className="form-label small">Area</label>
                <select
                  className="form-select form-select-sm"
                  value={tableForm.areaId}
                  onChange={(e) => setTableForm((f) => ({ ...f, areaId: e.target.value }))}
                >
                  <option value="">Select area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small">Label</label>
                <input
                  className="form-control form-control-sm"
                  value={tableForm.label}
                  onChange={(e) => setTableForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="T1"
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col">
                  <label className="form-label small">Min seats</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control form-control-sm"
                    value={tableForm.seatsMin}
                    onChange={(e) => setTableForm((f) => ({ ...f, seatsMin: Number(e.target.value) }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Max seats</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control form-control-sm"
                    value={tableForm.seatsMax}
                    onChange={(e) => setTableForm((f) => ({ ...f, seatsMax: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit">
                Add table
              </button>
            </form>
          </div>

          <div className="card rais-card p-3">
            <h2 className="h6">Services</h2>
            <ul className="list-group list-group-flush mb-2 small">
              {services.map((s) => (
                <li className="list-group-item px-0" key={s.id}>
                  <strong>{s.name}</strong> — {s.start_time}-{s.end_time}
                  <div className="text-muted">{s.days_of_week.map((d) => DAY_LABELS[d]).join(", ")}</div>
                </li>
              ))}
              {services.length === 0 && <li className="list-group-item px-0 text-muted">No services yet.</li>}
            </ul>
            <form onSubmit={onServiceSubmit}>
              <div className="mb-2">
                <label className="form-label small">Name</label>
                <input
                  className="form-control form-control-sm"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Dinner"
                />
              </div>
              <div className="mb-2 d-flex gap-1 flex-wrap">
                {DAY_LABELS.map((label, day) => (
                  <button
                    type="button"
                    key={day}
                    className={`btn btn-sm ${serviceForm.days.has(day) ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => toggleDay(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="row g-2 mb-2">
                <div className="col">
                  <label className="form-label small">Start</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={serviceForm.startTime}
                    onChange={(e) => setServiceForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">End</label>
                  <input
                    type="time"
                    className="form-control form-control-sm"
                    value={serviceForm.endTime}
                    onChange={(e) => setServiceForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">Default turn time (minutes)</label>
                <input
                  type="number"
                  min={15}
                  className="form-control form-control-sm"
                  value={serviceForm.turnMinutes}
                  onChange={(e) => setServiceForm((f) => ({ ...f, turnMinutes: Number(e.target.value) }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit">
                Add service
              </button>
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">
              Layout <small className="text-muted fw-normal">— drag tables to rearrange</small>
            </h2>
            <div
              ref={canvasRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onCanvasDrop}
              style={{ position: "relative", height: CANVAS_HEIGHT, background: "#f1f3f5", borderRadius: 8 }}
            >
              {tables.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  className="table-seat position-absolute d-flex flex-column align-items-center justify-content-center bg-white border rounded shadow-sm"
                  style={{ left: t.x, top: t.y, width: 64, height: 64 }}
                  title={`${t.label}: ${t.seats_min}-${t.seats_max} seats`}
                >
                  <strong>{t.label}</strong>
                  <small className="text-muted">
                    {t.seats_min}-{t.seats_max}
                  </small>
                </div>
              ))}
              {tables.length === 0 && (
                <div className="text-muted position-absolute top-50 start-50 translate-middle">
                  No tables yet — add one on the left.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
