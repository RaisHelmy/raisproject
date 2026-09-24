// Mock operational data for the demo (IPD Cheras / Kuala Lumpur)
export const OPERATOR = {
  name: "Lans Koporal Abu Bakar bin Ali",
  id: "R12345",
  station: "IPD CHERAS",
  role: "OPERATOR",
};

export const INCIDENT_TYPES = [
  { code: 1, name: "Kecemasan", color: "#ff3b5c" },
  { code: 2, name: "Jenayah", color: "#ff9f1c" },
  { code: 3, name: "Gangguan Awam", color: "#ffd166" },
  { code: 4, name: "Kemalangan", color: "#4cc9f0" },
  { code: 5, name: "Lain-lain", color: "#8ac926" },
];

const SUBTYPES = {
  1: ["Kebakaran", "Serangan Bersenjata", "Rompakan Bersenjata"],
  2: ["Pecah Rumah", "Ragut", "Curi Kenderaan", "Samun"],
  3: ["Pergaduhan", "Gangguan Bunyi", "Perhimpunan Haram"],
  4: ["Kemalangan Jalan Raya", "Langgar Lari"],
  5: ["Orang Hilang", "Panggilan Palsu", "Bantuan Awam"],
};

const PLACES = [
  ["Bukit Bintang", 3.1466, 101.7115],
  ["Chow Kit", 3.1636, 101.6977],
  ["Kampung Baru", 3.1653, 101.7057],
  ["KLCC", 3.1579, 101.7123],
  ["Pudu", 3.1362, 101.7124],
  ["Cheras", 3.1042, 101.7286],
  ["Taman Connaught", 3.0846, 101.7423],
  ["Bandar Tun Razak", 3.0862, 101.7159],
  ["Salak South", 3.1018, 101.7025],
  ["Ampang", 3.1492, 101.7627],
  ["Wangsa Maju", 3.2036, 101.7376],
  ["Setapak", 3.1955, 101.7143],
  ["Brickfields", 3.1284, 101.6844],
  ["Bangsar", 3.1284, 101.6714],
  ["Titiwangsa", 3.1793, 101.7038],
];

// deterministic pseudo random so the demo looks the same every load
let seed = 20240612;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) {
  return arr[Math.floor(rnd() * arr.length)];
}

const CALLSIGNS = ["KL321", "KL404", "KL413", "KL566", "KL213", "SL131", "SL140", "KL229", "KL230", "KL245", "SL122", "KL320", "SL444"];
const OFFICERS = ["KPL ABU BAKAR", "SJN MUNIF", "KPL YAAKOB", "L/KPL KAHAR", "SJN ARGABAN", "KPL RAZAK", "L/KPL HAFIZ", "KPL SITI"];
const STATUSES = ["Aktif", "Aktif", "Aktif", "Separuh Selesai", "Selesai", "Tutup"];
const PRIORITIES = ["High", "Medium", "Medium", "Low"];

export const INCIDENTS = Array.from({ length: 60 }, (_, i) => {
  const type = pick(INCIDENT_TYPES);
  const place = pick(PLACES);
  const hour = String(Math.floor(rnd() * 24)).padStart(2, "0");
  const minute = String(Math.floor(rnd() * 60)).padStart(2, "0");
  return {
    id: `20240612-${String(949 - i).padStart(3, "0")}`,
    code: type.code,
    type: type.name,
    subtype: pick(SUBTYPES[type.code]),
    color: type.color,
    status: i < 15 ? "Aktif" : pick(STATUSES),
    priority: pick(PRIORITIES),
    callsign: pick(CALLSIGNS),
    officer: pick(OFFICERS),
    place: place[0],
    lat: place[1] + (rnd() - 0.5) * 0.02,
    lon: place[2] + (rnd() - 0.5) * 0.02,
    time: `${hour}:${minute}`,
    date: "12/06/2024",
    caller: `+60 1${Math.floor(rnd() * 9)}-${Math.floor(100 + rnd() * 900)} ${Math.floor(1000 + rnd() * 9000)}`,
    desc: `Terdapat satu insiden ${pick(SUBTYPES[type.code]).toLowerCase()} di kawasan ${place[0]}. Pemanggil melaporkan kejadian dan meminta bantuan segera. Tiada tanda suspek masih berada di lokasi.`,
  };
});

const RES_STATUS = ["Ronda", "Ronda", "Ronda", "Standby", "Aktif", "Pasif", "Gantung"];
export const RESOURCES = CALLSIGNS.map((cs, i) => {
  const place = PLACES[i % PLACES.length];
  return {
    callsign: cs,
    officer: OFFICERS[i % OFFICERS.length],
    station: i % 3 === 0 ? "Balai Polis Cheras" : i % 3 === 1 ? "Balai Polis Pudu" : "Balai Polis Wangsa Maju",
    status: RES_STATUS[i % RES_STATUS.length],
    vehicle: i % 4 === 0 ? "MPV" : i % 4 === 1 ? "URB" : "Motosikal",
    lat: place[1] + (rnd() - 0.5) * 0.01,
    lon: place[2] + (rnd() - 0.5) * 0.01,
    since: `${String(Math.floor(rnd() * 24)).padStart(2, "0")}00HRS`,
  };
});

export const KPI = {
  active: INCIDENTS.filter((x) => x.status === "Aktif").length,
  last24h: 124,
  last7d: 1056,
  mpv: RESOURCES.filter((r) => r.vehicle === "MPV").length,
  patrol: RESOURCES.length,
};

export const DAILY = {
  dates: ["31 Jan", "1 Feb", "2 Feb", "3 Feb", "4 Feb", "5 Feb", "6 Feb", "7 Feb", "8 Feb"],
  series: [
    { name: "Jenayah", data: [98, 91, 85, 92, 73, 68, 61, 55, 48], color: "#ff9f1c" },
    { name: "Kemalangan", data: [54, 60, 52, 45, 49, 41, 38, 35, 31], color: "#4cc9f0" },
    { name: "Kecemasan", data: [22, 25, 19, 18, 21, 15, 12, 14, 10], color: "#ff3b5c" },
    { name: "Gangguan Awam", data: [40, 38, 44, 36, 30, 29, 24, 21, 19], color: "#ffd166" },
  ],
};

export const CALLS = { sahih: 3522, palsu: 201 };
export const HOURLY = Array.from({ length: 24 }, (_, h) => Math.round(20 + 40 * Math.exp(-((h - 21) ** 2) / 30) + 25 * Math.exp(-((h - 13) ** 2) / 20)));
export const RESPONSE = [
  { name: "< 5 min", y: 38 },
  { name: "5-10 min", y: 31 },
  { name: "10-15 min", y: 18 },
  { name: "> 15 min", y: 13 },
];
