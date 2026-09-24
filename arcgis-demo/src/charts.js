import { DAILY, CALLS, HOURLY, RESPONSE, INCIDENT_TYPES, INCIDENTS } from "./data.js";

const H = () => window.Highcharts;

export function setTheme() {
  H().setOptions({
    chart: { backgroundColor: "transparent", style: { fontFamily: "Segoe UI, system-ui, sans-serif" }, spacing: [10, 10, 10, 10] },
    title: { style: { color: "#e6f1ff", fontWeight: "700", fontSize: "14px" } },
    subtitle: { style: { color: "#8aa4c8" } },
    xAxis: { labels: { style: { color: "#8aa4c8" } }, lineColor: "#1d3b6b", tickColor: "#1d3b6b", gridLineColor: "#142a4f" },
    yAxis: { labels: { style: { color: "#8aa4c8" } }, gridLineColor: "#142a4f", title: { style: { color: "#8aa4c8" } } },
    legend: { itemStyle: { color: "#e6f1ff" }, itemHoverStyle: { color: "#34e5ff" } },
    tooltip: { backgroundColor: "#0b1730", borderColor: "#34e5ff", style: { color: "#e6f1ff" } },
    credits: { enabled: false },
    plotOptions: { series: { marker: { enabled: false } } },
    colors: ["#34e5ff", "#a26bff", "#ff9f1c", "#5ad35a", "#ff3b5c", "#ffd166"],
  });
}

export function trendChart(id, opts = {}) {
  H().chart(id, {
    chart: { type: "spline", height: opts.height || 320 },
    title: { text: opts.title ?? "Trend Kes Harian" },
    subtitle: { text: opts.subtitle ?? "IPD Cheras · 31 Jan – 8 Feb" },
    xAxis: { categories: DAILY.dates },
    yAxis: { title: { text: "Bil. Kes" }, min: 0 },
    series: DAILY.series.map((s) => ({ ...s, lineWidth: 3 })),
  });
}

export function callsPie(id) {
  H().chart(id, {
    chart: { type: "pie", height: 320 },
    title: { text: "Jenis Panggilan" },
    subtitle: { text: "1 Julai 2024 – 31 Julai 2024" },
    tooltip: { pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)" },
    plotOptions: { pie: { innerSize: "55%", borderColor: "#050b18", dataLabels: { enabled: true, format: "{point.name}: {point.y}", style: { color: "#e6f1ff", textOutline: "none" } } } },
    series: [{ name: "Panggilan", data: [
      { name: "Panggilan Sahih", y: CALLS.sahih, color: "#5ad35a" },
      { name: "Panggilan Palsu", y: CALLS.palsu, color: "#ff3b5c" },
    ] }],
  });
}

export function typeColumn(id) {
  const counts = INCIDENT_TYPES.map((t) => ({ name: t.name, y: INCIDENTS.filter((x) => x.code === t.code).length, color: t.color }));
  H().chart(id, {
    chart: { type: "column", height: 320 },
    title: { text: "Insiden Mengikut Jenis" },
    subtitle: { text: "Kes semasa dalam sistem" },
    xAxis: { type: "category" },
    yAxis: { title: { text: "Bil. Insiden" } },
    legend: { enabled: false },
    plotOptions: { column: { borderRadius: 4, borderWidth: 0, dataLabels: { enabled: true, style: { color: "#e6f1ff", textOutline: "none" } } } },
    series: [{ name: "Insiden", data: counts }],
  });
}

export function hourlyArea(id) {
  H().chart(id, {
    chart: { type: "areaspline", height: 320 },
    title: { text: "Panggilan Mengikut Jam" },
    subtitle: { text: "Purata 30 hari" },
    xAxis: { categories: HOURLY.map((_, h) => `${String(h).padStart(2, "0")}00`), tickInterval: 3 },
    yAxis: { title: { text: "Panggilan" } },
    legend: { enabled: false },
    plotOptions: { areaspline: { fillOpacity: .25, lineWidth: 3 } },
    series: [{ name: "Panggilan", data: HOURLY, color: "#34e5ff" }],
  });
}

export function responseBar(id) {
  H().chart(id, {
    chart: { type: "bar", height: 320 },
    title: { text: "Masa Tindak Balas" },
    subtitle: { text: "Peratus insiden mengikut tempoh sampai" },
    xAxis: { type: "category" },
    yAxis: { title: { text: "%" }, max: 50 },
    legend: { enabled: false },
    plotOptions: { bar: { borderRadius: 4, borderWidth: 0, colorByPoint: true, dataLabels: { enabled: true, format: "{y}%", style: { color: "#e6f1ff", textOutline: "none" } } } },
    series: [{ name: "Insiden", data: RESPONSE }],
  });
}

export function statusGauge(id, value, title) {
  H().chart(id, {
    chart: { type: "solidgauge", height: 200 },
    title: { text: title, style: { fontSize: "12px" } },
    pane: { center: ["50%", "70%"], size: "120%", startAngle: -90, endAngle: 90, background: { backgroundColor: "#142a4f", innerRadius: "60%", outerRadius: "100%", shape: "arc", borderWidth: 0 } },
    yAxis: { min: 0, max: 100, stops: [[.3, "#ff3b5c"], [.6, "#ffd166"], [.9, "#5ad35a"]], lineWidth: 0, tickWidth: 0, minorTickInterval: null, labels: { enabled: false } },
    tooltip: { enabled: false },
    plotOptions: { solidgauge: { dataLabels: { y: -20, borderWidth: 0, useHTML: true, format: '<span style="font-size:1.6rem;font-weight:800;color:#fff">{y}%</span>' } } },
    series: [{ data: [value] }],
  });
}
