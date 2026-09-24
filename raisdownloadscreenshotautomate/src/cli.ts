#!/usr/bin/env node
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Options, Plan, ScanResult } from "./types.ts";
import { scan } from "./scan.ts";
import { prioritize } from "./prioritize.ts";
import { capture, selectPages } from "./capture.ts";
import { writeReport } from "./report.ts";
import { openSession } from "./browser.ts";
import { hostOf, log, normalizeUrl, readJson, stamp, writeJson } from "./util.ts";

const HELP = `rdsa — Rais Download Screenshot Automate

Usage:
  rdsa run <url> [options]        scan → plan → capture → report (all in one)
  rdsa scan <url> [options]       discover main menu / submenu links → scan.json
  rdsa plan <url|scan.json>       score + dedupe similar pages → plan.json
  rdsa capture <plan.json|site>   download html + screenshot + assets for planned pages
  rdsa login <url>                open a headed browser, log in by hand, save session
  rdsa inspect <url>              debug: dump nav triggers and link summary for a page
  rdsa latest [site]              print the latest output folder

Options:
  --out <dir>            output root (default ./out)
  --headed               show the browser (debugging)
  --auth <file>          Playwright storage state (default .auth/<site>.json if it exists)
  --chrome [profile]     use real Chrome with a copy of your logged-in profile (default profile "Default")
  --chrome-live          with --chrome, drive your real profile in place (Chrome must be quit; most reliable logins)
  --fresh-profile        re-copy the Chrome profile instead of reusing the existing copy
  --cdp [url]            attach to a Chrome already started with --remote-debugging-port (default http://localhost:9222)
  --concurrency <n>      parallel pages (default 4)
  --max-pages <n>        cap of pages to capture (default 40)
  --min-priority <p>     high | medium | low (default medium)
  --per-template <n>     pages kept per similar URL pattern (default 1)
  --settle <ms>          max wait for network idle after load (default 2500)
  --timeout <ms>         navigation timeout (default 25000)
  --no-assets            skip asset download
  --asset-types <list>   stylesheet,script,font,image[,media] (default no media/video)
  --asset-budget <mb>    max new asset bytes per page (default 30)
  --asset-wait <ms>      max wait for asset bodies after screenshot (default 4000)
  --no-full              skip full-page screenshot
  --no-lazy              skip the scroll pass that loads lazy images
  --lazy-ms <ms>         budget for the lazy-load scroll pass (default 2500)
  --shot-timeout <ms>    per-screenshot timeout (default 20000)
  --no-hover             do not hover nav items for submenus
  --depth <0|1>          1 = also scan menus on each main-nav page (default 0)
  --include <regex>      only URLs matching
  --exclude <regex>      drop URLs matching
  --viewport WxH         default 1440x900
  --json                 print machine-readable result to stdout
`;

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (k.startsWith("no-")) flags[k.slice(3)] = false;
      else if (next !== undefined && !next.startsWith("--")) { flags[k] = next; i++; }
      else flags[k] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}

function buildOptions(flags: Record<string, string | boolean>, site?: string): Options {
  const num = (k: string, d: number) => (flags[k] !== undefined ? Number(flags[k]) : d);
  const [w, h] = String(flags.viewport ?? "1440x900").split("x").map(Number);
  const defaultAuth = site ? path.join(".auth", `${site}.json`) : undefined;
  return {
    out: String(flags.out ?? "out"),
    headed: flags.headed === true,
    chromeProfile: flags["chrome-live"] === true && flags.chrome === undefined ? "Default" : flags.chrome === true ? "Default" : typeof flags.chrome === "string" ? flags.chrome : undefined,
    profileDir: String(flags["profile-dir"] ?? ".chrome-profile"),
    liveProfile: flags["chrome-live"] === true,
    freshProfile: flags["fresh-profile"] === true,
    cdp: typeof flags.cdp === "string" ? flags.cdp : flags.cdp === true ? "http://localhost:9222" : undefined,
    storageState: typeof flags.auth === "string" ? flags.auth : defaultAuth && existsSync(defaultAuth) ? defaultAuth : undefined,
    concurrency: num("concurrency", 4),
    maxPages: num("max-pages", 40),
    minPriority: (String(flags["min-priority"] ?? "medium") as Options["minPriority"]),
    settleMs: num("settle", 2500),
    timeoutMs: num("timeout", 25000),
    assets: flags.assets !== false,
    assetTypes: new Set(String(flags["asset-types"] ?? "stylesheet,script,font,image").split(",").map((s) => s.trim()).filter(Boolean)),
    assetBudgetMb: num("asset-budget", 30),
    assetWaitMs: num("asset-wait", 4000),
    fullPage: flags.full !== false,
    lazy: flags.lazy !== false,
    lazyMs: num("lazy-ms", 2500),
    shotTimeoutMs: num("shot-timeout", 20000),
    hover: flags.hover !== false,
    scanDepth: num("depth", 0),
    perTemplate: num("per-template", 1),
    viewport: { width: w || 1440, height: h || 900 },
    include: typeof flags.include === "string" ? new RegExp(flags.include, "i") : undefined,
    exclude: typeof flags.exclude === "string" ? new RegExp(flags.exclude, "i") : undefined,
  };
}

async function latestDir(outRoot: string, site?: string): Promise<string | null> {
  const sites = site ? [site] : (await readdir(outRoot).catch(() => [])).filter((s) => !s.startsWith("."));
  let best: { dir: string; mtime: number } | null = null;
  for (const s of sites) {
    const sdir = path.join(outRoot, s);
    for (const run of await readdir(sdir).catch(() => [])) {
      const dir = path.join(sdir, run);
      const st = await stat(dir).catch(() => null);
      if (st?.isDirectory() && (!best || st.mtimeMs > best.mtime)) best = { dir, mtime: st.mtimeMs };
    }
  }
  return best?.dir ?? null;
}

async function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  const [cmd, target] = pos;
  const json = flags.json === true;
  if (!cmd || flags.help) { process.stdout.write(HELP); return; }

  if (cmd === "latest") {
    const d = await latestDir(String(flags.out ?? "out"), target);
    process.stdout.write((d ?? "") + "\n");
    return;
  }

  if (cmd === "login") {
    if (!target) throw new Error("login needs a url");
    const site = hostOf(target);
    const opts = buildOptions({ ...flags, headed: true }, site);
    const file = path.join(".auth", `${site}.json`);
    const session = await openSession({ ...opts, storageState: undefined }, 1, target);
    const ctx = await session.context(0);
    const page = await ctx.newPage();
    await session.preparePage(page);
    await page.goto(target);
    log(`A browser window is open. Sign in there, then just CLOSE the window.`);
    log(`Your session is saved continuously to ${file} — no need to press anything.`);
    let closed = false;
    const done = new Promise<void>((res) => {
      page.on("close", () => { closed = true; res(); });
      ctx.on("close", () => { closed = true; res(); });
    });
    const deadline = Date.now() + 15 * 60 * 1000;
    const poll = (async () => {
      while (!closed && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        if (closed) break;
        await ctx.storageState({ path: file }).catch(() => {});
      }
    })();
    await Promise.race([done, poll]);
    await ctx.storageState({ path: file }).catch(() => {});
    await session.close().catch(() => {});
    log(`saved ${file}`);
    return;
  }

  if (cmd === "inspect") {
    if (!target) throw new Error("inspect needs a url");
    const opts = buildOptions(flags, hostOf(target));
    const res = await scan(target, { ...opts, scanDepth: 0 });
    const summary = {
      url: target, links: res.links.length, notes: res.notes,
      bySource: Object.fromEntries(["main-nav", "sub-nav", "sidebar", "hero-cta", "footer", "body"].map((s) => [s, res.links.filter((l) => l.source === s).length])),
      menu: res.links.filter((l) => l.source !== "body" && l.source !== "footer").map((l) => `${l.source}${l.parent ? `(${l.parent})` : ""}: ${l.text || "-"} → ${l.url}`),
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  if (cmd === "scan" || cmd === "run") {
    if (!target) throw new Error(`${cmd} needs a url`);
    const url = normalizeUrl(target.startsWith("http") ? target : `https://${target}`, "https://x")!;
    const site = hostOf(url);
    const opts = buildOptions(flags, site);
    const outDir = path.join(opts.out, site, stamp());
    // One session for the whole run: spawning a second browser mid-process proved flaky.
    const session = cmd === "run" ? await openSession(opts, opts.concurrency, url) : undefined;
    const res = await scan(url, opts, session);
    await writeJson(path.join(outDir, "scan.json"), res);
    log(`scan done: ${res.links.length} links in ${res.durationMs} ms → ${outDir}/scan.json`);
    for (const n of res.notes) log(`note: ${n}`);
    const plan = prioritize(res, opts);
    await writeJson(path.join(outDir, "plan.json"), plan);
    log(`plan: ${JSON.stringify(plan.stats)} → ${outDir}/plan.json`);
    if (cmd === "scan") {
      if (json) process.stdout.write(JSON.stringify({ outDir, scan: res, plan }, null, 2) + "\n");
      else printPlan(plan, opts);
      return;
    }
    const manifest = await capture(plan, outDir, opts, session);
    await session?.close().catch(() => {});
    await writeReport(outDir, plan, manifest);
    log(`done: ${JSON.stringify(manifest.stats)} → ${outDir}/index.html`);
    if (json) process.stdout.write(JSON.stringify({ outDir, stats: manifest.stats, pages: manifest.pages }, null, 2) + "\n");
    else process.stdout.write(`${outDir}\n`);
    return;
  }

  if (cmd === "plan") {
    if (!target) throw new Error("plan needs a url or scan.json");
    let res: ScanResult; let outDir: string;
    if (target.endsWith(".json")) { res = await readJson<ScanResult>(target); outDir = path.dirname(target); }
    else { const d = await latestDir(String(flags.out ?? "out"), hostOf(target.startsWith("http") ? target : `https://${target}`)); if (!d) throw new Error("no scan found; run `scan` first"); res = await readJson<ScanResult>(path.join(d, "scan.json")); outDir = d; }
    const opts = buildOptions(flags, res.site);
    const plan = prioritize(res, opts);
    await writeJson(path.join(outDir, "plan.json"), plan);
    if (json) process.stdout.write(JSON.stringify(plan, null, 2) + "\n"); else printPlan(plan, opts);
    return;
  }

  if (cmd === "capture") {
    let planFile = target;
    if (!planFile || !planFile.endsWith(".json")) { const d = await latestDir(String(flags.out ?? "out"), planFile); if (!d) throw new Error("no plan found; run `scan` first"); planFile = path.join(d, "plan.json"); }
    const plan = await readJson<Plan>(planFile);
    const outDir = path.dirname(planFile);
    const opts = buildOptions(flags, plan.site);
    const manifest = await capture(plan, outDir, opts);
    await writeReport(outDir, plan, manifest);
    log(`done: ${JSON.stringify(manifest.stats)} → ${outDir}/index.html`);
    if (json) process.stdout.write(JSON.stringify({ outDir, stats: manifest.stats, pages: manifest.pages }, null, 2) + "\n");
    else process.stdout.write(`${outDir}\n`);
    return;
  }

  process.stdout.write(HELP);
  process.exit(1);
}

function printPlan(plan: Plan, opts: Options) {
  const sel = new Set(selectPages(plan, opts).map((p) => p.id));
  const rows = plan.pages.map((p) => `${sel.has(p.id) ? "▶" : " "} ${p.priority.padEnd(6)} ${String(p.score).padStart(4)}  ${p.source.padEnd(8)} ${p.url}${p.similarTo ? `  ~ ${p.similarTo}` : ""}`);
  process.stdout.write(rows.join("\n") + `\n\n${plan.stats.total} pages: ${JSON.stringify(plan.stats)} · ▶ = will be captured (${sel.size})\n`);
}

main().catch((e) => { log(`fatal: ${(e as Error).stack ?? e}`); process.exit(1); });
