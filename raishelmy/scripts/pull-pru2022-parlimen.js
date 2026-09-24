#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://mysprsemak.spr.gov.my";
const PAGE_URL = `${BASE_URL}/semakan/keputusan/pru`;
const LIST_URL = `${BASE_URL}/semakan/keputusan/pru/getParDun`;
const RESULT_URL = `${BASE_URL}/semakan/keputusan/keputusanPru`;

const DEFAULTS = {
  electionId: "E5B1D6F4-C243-4F3D-87C0-4DBDF186E30A",
  category: "PRU",
  outputPath: "pru2022_parlimen_except_sabah.json",
  concurrency: 5,
  pauseMs: 120,
  excludedStates: ["0DD44528-7B9A-41C5-8C01-6C60D5B257BC"], // SABAH
};

const STATES = [
  { id: "E361A6E8-109C-4967-8E9D-B8971B8C3DD0", name: "PERLIS" },
  { id: "F8AE996D-E20B-454A-B3A8-01E51844509F", name: "KEDAH" },
  { id: "36C3C838-421C-4DC7-8F70-371D2F78CE63", name: "KELANTAN" },
  { id: "9EA8AEE0-91C4-4B6D-AE13-000E7C55E451", name: "TERENGGANU" },
  { id: "2FF5BDF7-F925-4D8F-AFBA-69D3115DCBC8", name: "PULAU PINANG" },
  { id: "5886B081-29F3-4302-985F-03206054139F", name: "PERAK" },
  { id: "5276F833-F381-4398-A602-0CD69DD64148", name: "PAHANG" },
  { id: "78993030-8027-4253-9561-F483B13C90B7", name: "SELANGOR" },
  { id: "76D00DD7-99D5-4541-AE6B-1E75BE881890", name: "W.P KUALA LUMPUR" },
  { id: "9223F5AB-DA65-4DF3-A016-900ED4DFB5F8", name: "W.P PUTRAJAYA" },
  { id: "05C20FC5-B6B7-4DBF-9408-6098EE3B19F7", name: "NEGERI SEMBILAN" },
  { id: "FA21B710-F68A-4DBC-87CA-8D27BC4A008F", name: "MELAKA" },
  { id: "CC43499B-6796-4069-839E-AE88640675A9", name: "JOHOR" },
  { id: "B34E679F-A0B7-4DB8-A263-18F417DE63D4", name: "W.P LABUAN" },
  { id: "0DD44528-7B9A-41C5-8C01-6C60D5B257BC", name: "SABAH" },
  { id: "CC96B1AA-7886-4454-A312-0AE23DB3E942", name: "SARAWAK" },
];

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" && argv[i + 1]) out.outputPath = argv[++i];
    else if (arg === "--election-id" && argv[i + 1]) out.electionId = argv[++i];
    else if (arg === "--category" && argv[i + 1]) out.category = argv[++i];
    else if (arg === "--concurrency" && argv[i + 1]) out.concurrency = Number(argv[++i]);
    else if (arg === "--pause" && argv[i + 1]) out.pauseMs = Number(argv[++i]);
    else if (arg === "--exclude-state" && argv[i + 1]) out.excludedStates.push(argv[++i]);
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  out.excludedStates = [...new Set(out.excludedStates.map((x) => String(x).trim().toUpperCase()))];
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) out.concurrency = DEFAULTS.concurrency;
  if (!Number.isFinite(out.pauseMs) || out.pauseMs < 0) out.pauseMs = DEFAULTS.pauseMs;
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/pull-pru2022-parlimen.js [options]

Options:
  --output <path>          Output JSON file (default: pru2022_parlimen_except_sabah.json)
  --election-id <id>       PilihanrayaId (default: PRU15 2022)
  --category <value>       kategori for keputusan endpoint (default: PRU)
  --concurrency <n>        Parallel parlimen requests (default: 5)
  --pause <ms>             Pause between requests per worker (default: 120)
  --exclude-state <id>     Additional RefNegeriId to exclude
  --help                   Show help

Env overrides:
  SPR_COOKIE               Full cookie header value (optional)
  SPR_TOKEN                _token value (optional)
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function parseSetCookies(headers) {
  const out = {};
  const rawArray = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const lines = rawArray.length > 0 ? rawArray : [headers.get("set-cookie")].filter(Boolean);

  for (const line of lines) {
    const chunks = String(line).split(/,(?=\s*[^;=]+=)/g);
    for (const chunk of chunks) {
      const pair = chunk.split(";")[0].trim();
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      out[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }

  return out;
}

function toCookieHeader(cookieJar) {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
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
  const cookies = parseSetCookies(res.headers);
  return { token, cookies };
}

function compareCodes(a, b) {
  return Number(a.kodParlimen) - Number(b.kodParlimen);
}

async function main() {
  const cfg = parseArgs(process.argv);
  const excluded = new Set(cfg.excludedStates);
  const states = STATES.filter((s) => !excluded.has(s.id));
  const outPath = path.resolve(process.cwd(), cfg.outputPath);

  if (states.length === 0) {
    throw new Error("No states left after exclusions.");
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

  const boot = await bootstrapSession();
  token = token || boot.token;
  Object.assign(cookieJar, boot.cookies);

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

  console.log(`[2/4] Fetching Parlimen list from ${states.length} states (excluding Sabah)...`);
  const allParlimen = [];

  for (const state of states) {
    const form = new URLSearchParams({
      _token: token,
      RefNegeriId: state.id,
      PilihanrayaId: cfg.electionId,
    });

    const payload = await fetchJson(LIST_URL, {
      method: "POST",
      headers: commonHeaders,
      body: form,
    });

    const list = Array.isArray(payload?.parlimen) ? payload.parlimen : [];
    for (const seat of list) {
      allParlimen.push({
        stateId: state.id,
        stateName: state.name,
        parlimen: seat,
      });
    }

    console.log(` - ${state.name}: ${list.length} Parlimen`);
    if (cfg.pauseMs > 0) await sleep(cfg.pauseMs);
  }

  if (allParlimen.length === 0) {
    throw new Error("No parlimen found from getParDun.");
  }

  console.log(`[3/4] Pulling detailed keputusan for ${allParlimen.length} Parlimen...`);
  const results = [];
  const failures = [];
  let idx = 0;

  async function worker(workerId) {
    while (idx < allParlimen.length) {
      const current = allParlimen[idx++];
      const kod = String(current.parlimen?.KodBahagianPilihanRaya || "").trim();

      const form = new URLSearchParams({
        _token: token,
        kategori: cfg.category,
        PilihanrayaId: cfg.electionId,
        kodbahagian: kod,
        DunId: "{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}",
        RefNegeriId: current.stateId,
      });

      try {
        const payload = await fetchJson(RESULT_URL, {
          method: "POST",
          headers: commonHeaders,
          body: form,
        });

        results.push({
          stateId: current.stateId,
          stateName: current.stateName,
          kodParlimen: kod,
          namaParlimen: current.parlimen?.NamaBahagianPilihanRaya || null,
          bahagianPilihanRayaId: current.parlimen?.BahagianPilihanRayaId || null,
          parlimen: current.parlimen,
          keputusanPru: payload,
        });

        process.stdout.write(`\rWorker ${workerId}: pulled P.${kod} ${current.parlimen?.NamaBahagianPilihanRaya || ""}     `);
      } catch (err) {
        failures.push({
          stateId: current.stateId,
          stateName: current.stateName,
          kodParlimen: kod,
          namaParlimen: current.parlimen?.NamaBahagianPilihanRaya || null,
          error: err.message,
        });
      }

      if (cfg.pauseMs > 0) await sleep(cfg.pauseMs);
    }
  }

  const workers = Array.from({ length: cfg.concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  process.stdout.write("\n");

  results.sort((a, b) => {
    if (a.stateName !== b.stateName) return a.stateName.localeCompare(b.stateName);
    return compareCodes(a, b);
  });

  const output = {
    source: "mysprsemak.spr.gov.my",
    generatedAt: new Date().toISOString(),
    election: {
      electionId: cfg.electionId,
      category: cfg.category,
      label: "PRU KE - 15 (2022)",
    },
    filters: {
      excludedStateIds: [...excluded],
      excludedStateNames: STATES.filter((s) => excluded.has(s.id)).map((s) => s.name),
      includedStateCount: states.length,
    },
    totals: {
      parlimenDiscovered: allParlimen.length,
      fetched: results.length,
      failed: failures.length,
    },
    failures,
    data: results,
  };

  console.log("[4/4] Writing output...");
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Done. Wrote ${results.length} records to ${cfg.outputPath}`);
  if (failures.length > 0) {
    console.log(`Failed pulls: ${failures.length}`);
    for (const f of failures.slice(0, 10)) {
      console.log(` - ${f.stateName} P.${f.kodParlimen} ${f.namaParlimen || ""}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
