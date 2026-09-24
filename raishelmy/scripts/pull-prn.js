#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://mysprsemak.spr.gov.my";
const PAGE_URL = `${BASE_URL}/semakan/keputusan/pru-dun`;
const LIST_URL = `${BASE_URL}/semakan/keputusan/senaraiDunPruDun`;
const RESULT_URL = `${BASE_URL}/semakan/keputusan/keputusanPruDun`;

const DEFAULTS = {
  electionId: "80EE8E02-1217-4FB9-B72C-82EC0DDC7230",
  stateId: "0DD44528-7B9A-41C5-8C01-6C60D5B257BC",
  category: "PRU_DUN",
  outputPath: "prn2025result.json",
  concurrency: 4,
  pauseMs: 150,
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" && argv[i + 1]) out.outputPath = argv[++i];
    else if (arg === "--election-id" && argv[i + 1]) out.electionId = argv[++i];
    else if (arg === "--state-id" && argv[i + 1]) out.stateId = argv[++i];
    else if (arg === "--category" && argv[i + 1]) out.category = argv[++i];
    else if (arg === "--concurrency" && argv[i + 1]) out.concurrency = Number(argv[++i]);
    else if (arg === "--pause" && argv[i + 1]) out.pauseMs = Number(argv[++i]);
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) out.concurrency = DEFAULTS.concurrency;
  if (!Number.isFinite(out.pauseMs) || out.pauseMs < 0) out.pauseMs = DEFAULTS.pauseMs;

  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/pull-prn.js [options]

Options:
  --output <path>        Output JSON file (default: prn2025result.json)
  --election-id <id>     PilihanrayaId
  --state-id <id>        RefNegeriId
  --category <value>     kategori for keputusan endpoint (default: PRU_DUN)
  --concurrency <n>      Parallel seat requests (default: 4)
  --pause <ms>           Pause between seat requests per worker (default: 150)
  --help                 Show help

Env overrides:
  SPR_COOKIE             Full cookie header value (optional)
  SPR_TOKEN              _token value (optional)
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSetCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return {};

  // Split cookie groups safely. Set-Cookie is not comma-safe, but this pattern works for common cases.
  const parts = raw.split(/,(?=\s*[^;=]+=)/g);
  const jar = {};
  for (const part of parts) {
    const pair = part.split(";")[0].trim();
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    jar[name] = value;
  }
  return jar;
}

function toCookieHeader(cookieJar) {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function extractTokenFromHtml(html) {
  const patterns = [
    /name=["']_token["'][^>]*value=["']([^"']+)["']/i,
    /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
    /_token\s*[:=]\s*["']([^"']+)["']/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function parseIntLoose(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeSeatNumber(raw) {
  const m = String(raw || "").match(/N\.?\s*(\d{1,2})/i);
  if (!m) return null;
  return String(Number(m[1])).padStart(2, "0");
}

function normalizeSeatName(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^N\.\s*/i, "N");
  s = s.replace(/^N\s*(\d{1,2})\s*/i, (_, n) => `N${String(Number(n)).padStart(2, "0")} `);

  const m = s.match(/^N(\d{2})\s+(.+)$/i);
  if (m) {
    return `N${m[1]} - ${m[2].trim()}`;
  }

  const num = normalizeSeatNumber(raw);
  return num ? `N${num} - UNKNOWN` : s;
}

function partyShortName(calon) {
  if (calon?.parti_bebas?.Penerangan) return calon.parti_bebas.Penerangan;
  if (calon?.parti?.NamaSingkatan) return calon.parti.NamaSingkatan;
  return "BEBAS";
}

function mapCandidate(calon, totalVotes) {
  const votes = parseIntLoose(calon?.BilUndi) || 0;
  const name = String(calon?.NamaUndiCalon || "").trim();
  const short = partyShortName(calon);
  const percentage = totalVotes > 0 ? `${((votes / totalVotes) * 100).toFixed(2)}%` : "0.00%";

  return {
    name,
    party: `${name}\n${short}`,
    votes,
    percentage,
  };
}

function pickWinner(penamaanMenang, candidates) {
  if (penamaanMenang?.NamaUndiCalon) {
    const name = String(penamaanMenang.NamaUndiCalon).trim();
    const short = partyShortName(penamaanMenang);
    const votes = parseIntLoose(penamaanMenang.BilUndi) || 0;
    const found = candidates.find((c) => c.name === name);
    return {
      name,
      party: `${name}\n${short}`,
      votes,
      percentage: found ? found.percentage : "0.00%",
    };
  }

  if (candidates.length > 0) {
    const top = [...candidates].sort((a, b) => b.votes - a.votes)[0];
    return { ...top };
  }

  return { name: "", party: "", votes: 0, percentage: "0.00%" };
}

function mapSeatResponse(payload, existingRecord) {
  const pilihan = payload?.pilihanraya?.[0] || {};
  const penamaan = Array.isArray(pilihan.penamaan) ? pilihan.penamaan : [];

  const totalVotes = penamaan.reduce((sum, c) => sum + (parseIntLoose(c.BilUndi) || 0), 0);
  const candidates = penamaan.map((c) => mapCandidate(c, totalVotes));
  const winner = pickWinner(payload?.penamaanMenang, candidates);

  const seat = normalizeSeatName(payload?.namaDun || existingRecord?.seat || "");
  const majority = parseIntLoose(pilihan?.keputusan?.[0]?.Majoriti) || 0;

  const now = new Date();
  const updated = now.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    seat,
    state: existingRecord?.state || "Sabah",
    majority,
    winner,
    candidates,
    registered_voters: existingRecord?.registered_voters ?? null,
    total_votes: totalVotes,
    turnout_percentage: existingRecord?.turnout_percentage ?? null,
    updated,
  };
}

function makePlaceholderSeat(kodBahagian, nama, existingRecord) {
  const num = String(Number(kodBahagian)).padStart(2, "0");
  return {
    seat: `N${num} - ${String(nama || "UNKNOWN").trim()}`,
    state: existingRecord?.state || "Sabah",
    majority: existingRecord?.majority ?? 0,
    winner: existingRecord?.winner || { name: "", party: "", votes: 0, percentage: "0.00%" },
    candidates: existingRecord?.candidates || [],
    registered_voters: existingRecord?.registered_voters ?? null,
    total_votes: existingRecord?.total_votes ?? 0,
    turnout_percentage: existingRecord?.turnout_percentage ?? null,
    updated: existingRecord?.updated || null,
  };
}

function seatNumberFromSeatLabel(seat) {
  const m = String(seat || "").match(/^N(\d{2})\b/i);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText} -> ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function bootstrapSession() {
  const res = await fetch(PAGE_URL, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Bootstrap failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const token = extractTokenFromHtml(html);
  const cookies = parseSetCookie(res.headers);
  return { token, cookies };
}

async function main() {
  const cfg = parseArgs(process.argv);
  const outPath = path.resolve(process.cwd(), cfg.outputPath);

  const existing = fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, "utf8"))
    : [];

  const existingByNum = new Map();
  for (const rec of existing) {
    const m = String(rec?.seat || "").match(/^N(\d{2})\b/i);
    if (m) existingByNum.set(m[1], rec);
  }

  console.log("[1/4] Bootstrapping SPR session...");
  let token = process.env.SPR_TOKEN || null;
  const cookieJar = {};

  if (process.env.SPR_COOKIE) {
    for (const part of process.env.SPR_COOKIE.split(/;\s*/)) {
      const idx = part.indexOf("=");
      if (idx > 0) cookieJar[part.slice(0, idx)] = part.slice(idx + 1);
    }
  }

  try {
    const boot = await bootstrapSession();
    token = token || boot.token;
    Object.assign(cookieJar, boot.cookies);
  } catch (err) {
    console.warn(`Bootstrap warning: ${err.message}`);
  }

  if (!token) {
    throw new Error("Missing _token. Set SPR_TOKEN env or allow bootstrap from page.");
  }

  const cookieHeader = toCookieHeader(cookieJar);
  const commonHeaders = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: BASE_URL,
    Referer: PAGE_URL,
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  };
  if (cookieHeader) commonHeaders.Cookie = cookieHeader;

  console.log("[2/4] Fetching DUN list...");
  const listForm = new URLSearchParams({
    _token: token,
    PilihanrayaId: cfg.electionId,
    RefNegeriId: cfg.stateId,
  });
  const listPayload = await fetchJson(LIST_URL, {
    method: "POST",
    headers: commonHeaders,
    body: listForm,
  });

  const dunList = Array.isArray(listPayload?.dun) ? listPayload.dun : [];
  if (dunList.length === 0) {
    throw new Error("No DUN returned by senaraiDunPruDun.");
  }
  console.log(`Found ${dunList.length} DUN entries.`);

  console.log("[3/4] Pulling seat results...");
  const mergedByNum = new Map(existingByNum);
  const failures = [];

  let index = 0;
  async function worker(workerId) {
    while (index < dunList.length) {
      const current = dunList[index++];
      const num = String(Number(current.KodBahagianPilihanRaya)).padStart(2, "0");
      const existingRecord = existingByNum.get(num);

      const form = new URLSearchParams({
        _token: token,
        kategori: cfg.category,
        PilihanrayaId: cfg.electionId,
        kodbahagian: current.AppendKod,
      });

      try {
        const payload = await fetchJson(RESULT_URL, {
          method: "POST",
          headers: commonHeaders,
          body: form,
        });

        const mapped = mapSeatResponse(payload, existingRecord);
        mergedByNum.set(num, mapped);
        process.stdout.write(`\rWorker ${workerId}: pulled N${num} (${current.NamaBahagianPilihanRaya})     `);
      } catch (err) {
        failures.push({
          num,
          name: current.NamaBahagianPilihanRaya,
          error: err.message,
        });
        // Keep existing if present, else create placeholder.
        if (!mergedByNum.has(num)) {
          mergedByNum.set(num, makePlaceholderSeat(num, current.NamaBahagianPilihanRaya, existingRecord));
        }
      }

      if (cfg.pauseMs > 0) await sleep(cfg.pauseMs);
    }
  }

  const workers = Array.from({ length: cfg.concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  process.stdout.write("\n");

  // Guarantee N01..N73 coverage.
  for (const d of dunList) {
    const num = String(Number(d.KodBahagianPilihanRaya)).padStart(2, "0");
    if (!mergedByNum.has(num)) {
      mergedByNum.set(num, makePlaceholderSeat(num, d.NamaBahagianPilihanRaya, existingByNum.get(num)));
    }
  }

  const final = [...mergedByNum.values()].sort((a, b) => seatNumberFromSeatLabel(a.seat) - seatNumberFromSeatLabel(b.seat));

  console.log("[4/4] Writing merged output...");
  fs.writeFileSync(outPath, `${JSON.stringify(final, null, 2)}\n`, "utf8");

  const presentNums = new Set(
    final
      .map((r) => String(r?.seat || "").match(/^N(\d{2})\b/i))
      .filter(Boolean)
      .map((m) => Number(m[1]))
  );
  const missing = [];
  for (let i = 1; i <= 73; i += 1) {
    if (!presentNums.has(i)) missing.push(`N${String(i).padStart(2, "0")}`);
  }

  console.log(`Done. Records written: ${final.length}`);
  if (failures.length > 0) {
    console.log(`Fetch failures: ${failures.length}`);
    for (const f of failures.slice(0, 10)) {
      console.log(` - N${f.num} ${f.name}: ${f.error}`);
    }
    if (failures.length > 10) console.log(` - ...and ${failures.length - 10} more`);
  }

  if (missing.length > 0) {
    console.log(`Coverage gap: ${missing.join(", ")}`);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
