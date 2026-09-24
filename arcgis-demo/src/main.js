import { renderNav, renderOperator, renderFooter, badge, prio } from "./nav.js";
import { INCIDENTS, RESOURCES, KPI, INCIDENT_TYPES } from "./data.js";
import { createMap } from "./map.js";
import * as charts from "./charts.js";

renderNav();
renderOperator();
renderFooter();
if (window.Highcharts) charts.setTheme();

const page = document.body.dataset.page;
const $ = (s) => document.querySelector(s);
const html = (el, s) => { if (el) el.innerHTML = s; };

// ------------------------------------------------------------ HOME
async function home() {
  html($("#kpiActive"), KPI.active);
  html($("#kpi24"), KPI.last24h);
  html($("#kpi7"), KPI.last7d.toLocaleString());
  html($("#kpiRes"), RESOURCES.filter((r) => r.status !== "Gantung").length);

  const m = await createMap("map");
  window.__map = m;

  $("#heatToggle").addEventListener("change", (e) => m.setHeatmap(e.target.checked));
  $("#resToggle").addEventListener("change", (e) => m.showResources(e.target.checked));

  const list = $("#resourceList");
  const draw = (q = "") => {
    const rows = RESOURCES.filter((r) => r.callsign.toLowerCase().includes(q.toLowerCase()));
    html(list, rows.map((r) => `
      <div class="resource-card" data-cs="${r.callsign}">
        <div><i class="bi bi-car-front-fill me-2" style="color:var(--cyan)"></i><span class="cs">${r.callsign}</span>
          <div class="small text-muted"><span class="dot" style="background:${{ Ronda: "#5ad35a", Standby: "#ffd166", Aktif: "#37b6ff", Pasif: "#a26bff", Gantung: "#8aa4c8" }[r.status]}"></span>${r.status} · ${r.vehicle}</div></div>
        <div class="d-flex gap-1"><span class="icon-btn" title="Lokasi"><i class="bi bi-geo-alt-fill"></i></span><span class="icon-btn" title="Kamera"><i class="bi bi-camera-video-fill"></i></span></div>
      </div>`).join(""));
  };
  draw();
  $("#csSearch").addEventListener("input", (e) => draw(e.target.value));
  list.addEventListener("click", (e) => { const c = e.target.closest(".resource-card"); if (c) m.openResource(c.dataset.cs); });

  const active = INCIDENTS.filter((x) => x.status === "Aktif").slice(0, 8);
  html($("#activeTable"), active.map((x) => `
    <tr data-id="${x.id}" style="cursor:pointer">
      <td>${x.time}</td><td class="fw-bold">${x.id}</td><td>${prio(x.priority)}</td><td>${x.type}</td><td>${x.callsign}</td>
    </tr>`).join(""));
  $("#activeTable").addEventListener("click", (e) => { const r = e.target.closest("tr"); if (r) m.openIncident(r.dataset.id); });

  charts.trendChart("miniTrend", { height: 220, title: "Trend Kes 7 Hari", subtitle: null });
}

// ------------------------------------------------------------ INCIDENT
async function incident() {
  let current = INCIDENTS[0];
  let filter = "Semua";
  let q = "";
  const listEl = $("#incidentList");
  let m = null;

  const drawList = () => {
    const rows = INCIDENTS.filter((x) => (filter === "Semua" || x.status === filter) && (x.id.includes(q) || x.type.toLowerCase().includes(q.toLowerCase()) || x.place.toLowerCase().includes(q.toLowerCase())));
    html($("#incidentCount"), `${rows.length} INSIDEN`);
    html(listEl, rows.map((x) => `
      <div class="incident-item ${x.id === current.id ? "active" : ""}" data-id="${x.id}">
        <div class="id">${x.id}</div>
        <div class="meta">Kod ${x.code} (${x.type}) · ${x.place}</div>
        <div class="mt-1">${badge(x.status)}</div>
      </div>`).join("") || `<div class="p-3 text-muted">Tiada insiden</div>`);
  };

  const drawDetail = () => {
    const x = current;
    const set = (id, v) => html($(id), v);
    set("#dId", x.id); set("#dStatus", badge(x.status)); set("#dCode", `${x.code} · ${x.type}`); set("#dSub", x.subtype);
    set("#dDate", x.date); set("#dTime", x.time); set("#dPlace", `${x.place}, Kuala Lumpur`); set("#dLat", x.lat.toFixed(6)); set("#dLon", x.lon.toFixed(6));
    set("#dCall", x.callsign); set("#dOfficer", x.officer); set("#dCaller", x.caller); set("#dPrio", prio(x.priority)); set("#dDesc", x.desc);
    const stage = { Aktif: 3, "Separuh Selesai": 4, Selesai: 5, Tutup: 5 }[x.status] || 3;
    const steps = ["Terima insiden", "Utus insiden", "Call sign terima", "Call sign tiba di lokasi", "Terima laporan akhir"];
    html($("#timeline"), steps.map((s, i) => `
      ${i ? `<div class="link ${i < stage ? "done" : ""}">${i < stage ? `<span>${[2, 1, 6, 12][i - 1]} minit</span>` : ""}</div>` : ""}
      <div class="step ${i < stage ? "done" : ""}">${s}</div>`).join(""));
    m?.goTo(x.lon, x.lat, 16);
  };

  drawList(); drawDetail();
  listEl.addEventListener("click", (e) => {
    const it = e.target.closest(".incident-item"); if (!it) return;
    current = INCIDENTS.find((x) => x.id === it.dataset.id); drawList(); drawDetail();
  });
  document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); filter = b.dataset.filter; drawList();
  }));
  $("#incSearch").addEventListener("input", (e) => { q = e.target.value; drawList(); });
  $("#btnLocate").addEventListener("click", () => m?.openIncident(current.id));
  m = await createMap("miniMap", { zoom: 15, legend: false, incidents: INCIDENTS, resources: [] });
  m.goTo(current.lon, current.lat, 16);
}

// ------------------------------------------------------------ RESOURCES
async function resources() {
  const counts = {};
  RESOURCES.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
  html($("#resKpis"), ["Ronda", "Standby", "Aktif", "Pasif", "Gantung"].map((s) => `
    <div class="col-6 col-md"><div class="kpi kpi-grey"><div class="label">${s}</div><div class="sub">Unit</div><div class="value">${counts[s] || 0}</div></div></div>`).join(""));

  const tbody = $("#resTable");
  let m = null;
  let q = "";
  const draw = () => {
    const rows = RESOURCES.filter((r) => r.callsign.toLowerCase().includes(q.toLowerCase()) || r.officer.toLowerCase().includes(q.toLowerCase()));
    html(tbody, rows.map((r) => `
      <tr data-cs="${r.callsign}" style="cursor:pointer">
        <td><i class="bi bi-caret-down-fill me-2" style="color:var(--cyan)"></i>${r.since} [12/06/2024]</td>
        <td class="fw-bold">${r.callsign}</td><td>${r.officer}</td><td>${r.station}</td><td>${r.vehicle}</td>
        <td><select class="form-select form-select-sm w-auto" data-cs="${r.callsign}">${["Ronda", "Standby", "Aktif", "Pasif", "Gantung"].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td class="text-end"><span class="icon-btn"><i class="bi bi-info-circle"></i></span> <span class="icon-btn"><i class="bi bi-camera-video-fill"></i></span> <span class="icon-btn"><i class="bi bi-send-fill"></i></span></td>
      </tr>`).join(""));
  };
  draw();
  $("#resSearch").addEventListener("input", (e) => { q = e.target.value; draw(); });
  tbody.addEventListener("click", (e) => { if (e.target.closest("select")) return; const r = e.target.closest("tr"); if (r) m?.openResource(r.dataset.cs); });
  tbody.addEventListener("change", (e) => {
    if (!e.target.matches("select")) return;
    const r = RESOURCES.find((x) => x.callsign === e.target.dataset.cs);
    r.status = e.target.value;
    const g = m?.resources.graphics.find((g) => g.attributes.callsign === r.callsign);
    if (g) { g.attributes.status = r.status; g.symbol = { ...g.symbol.toJSON(), type: "simple-marker", style: "square", color: { Ronda: "#5ad35a", Standby: "#ffd166", Aktif: "#37b6ff", Pasif: "#a26bff", Gantung: "#8aa4c8" }[r.status] }; }
  });
  m = await createMap("resMap", { zoom: 12, legend: false, incidents: [] });
}

// ------------------------------------------------------------ ANALYTICS
function analytics() {
  html($("#kpiActive"), KPI.active);
  html($("#kpi24"), KPI.last24h);
  html($("#kpi7"), KPI.last7d.toLocaleString());
  html($("#kpiMpv"), KPI.mpv);
  html($("#kpiPatrol"), KPI.patrol);
  charts.trendChart("trend");
  charts.callsPie("pie");
  charts.typeColumn("types");
  charts.hourlyArea("hourly");
  charts.responseBar("response");
  charts.statusGauge("g1", 92, "Kadar Tindak Balas < 10 min");
  charts.statusGauge("g2", 78, "Kes Diselesaikan Bulan Ini");
  charts.statusGauge("g3", 64, "Penggunaan Sumber");
  html($("#typeLegend"), INCIDENT_TYPES.map((t) => `<span class="me-3"><span class="dot d-inline-block rounded-circle me-1" style="width:10px;height:10px;background:${t.color}"></span>Kod ${t.code} ${t.name}</span>`).join(""));
}

Promise.resolve(({ home, incident, resources, analytics })[page]?.()).catch((e) => console.error(e));
