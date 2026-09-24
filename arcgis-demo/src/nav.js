import { OPERATOR } from "./data.js";

const LINKS = [
  ["index.html", "Home", "bi-house-door"],
  ["incident.html", "Insiden", "bi-exclamation-triangle"],
  ["resources.html", "Sumber", "bi-car-front"],
  ["analytics.html", "Analitik", "bi-graph-up"],
  ["live-map.html", "Live Map", "bi-globe-americas"],
];

export function renderNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  const el = document.getElementById("nav");
  if (!el) return;
  el.innerHTML = `
  <nav class="navbar navbar-expand-lg sticky-top">
    <div class="container-fluid px-3">
      <a class="navbar-brand brand" href="index.html"><i class="bi bi-shield-fill-check me-2" style="color:var(--cyan)"></i>SHIELD <span>Command</span></a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navLinks"><i class="bi bi-list" style="color:#fff;font-size:1.4rem"></i></button>
      <div class="collapse navbar-collapse" id="navLinks">
        <ul class="navbar-nav me-auto">
          ${LINKS.map(([href, label, icon]) => `<li class="nav-item mx-1"><a class="nav-link ${page === href ? "active" : ""}" href="${href}"><i class="bi ${icon} me-1"></i>${label}</a></li>`).join("")}
        </ul>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted small d-none d-md-inline" id="navClock"></span>
          <a class="icon-btn" href="#" title="Notifikasi"><i class="bi bi-bell-fill"></i></a>
          <a class="icon-btn" href="#" title="Mesej"><i class="bi bi-send-fill"></i></a>
          <a class="icon-btn" href="#" title="Log keluar"><i class="bi bi-box-arrow-right"></i></a>
        </div>
      </div>
    </div>
  </nav>`;
  tickClock();
  setInterval(tickClock, 1000);
}

function tickClock() {
  const d = new Date();
  const hrs = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")} HRS`;
  const day = d.toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.querySelectorAll("[data-clock]").forEach((e) => (e.textContent = hrs));
  document.querySelectorAll("[data-date]").forEach((e) => (e.textContent = day));
  const n = document.getElementById("navClock");
  if (n) n.textContent = `${day} · ${hrs}`;
}

export function renderOperator() {
  const el = document.getElementById("operator");
  if (!el) return;
  const initials = OPERATOR.name.split(" ").filter((w) => /^[A-Z]/.test(w) && w !== "bin").slice(1, 3).map((w) => w[0]).join("");
  el.innerHTML = `
    <div class="operator">
      <div class="avatar">${initials}</div>
      <div>
        <h5>${OPERATOR.name}</h5>
        <div class="muted">${OPERATOR.id} · ${OPERATOR.station} ${OPERATOR.role}</div>
        <span class="badge-status st-Aktif mt-1 d-inline-block">Aktif</span>
      </div>
    </div>`;
}

export function renderFooter() {
  const el = document.getElementById("footer");
  if (el) el.innerHTML = `<div class="footer-bar">SHIELD COMPUTER AIDED SYSTEM · PDRM/IPKKL/IPDCHERAS/${OPERATOR.id} · Demo build · Powered by ArcGIS Maps SDK for JavaScript</div>`;
}

export const badge = (s) => `<span class="badge-status st-${s.split(" ")[0]}">${s}</span>`;
export const prio = (p) => `<span class="badge-status pr-${p}">${p}</span>`;
