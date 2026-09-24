import type { Page, Response } from "playwright";
import path from "node:path";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { CaptureMeta, Manifest, Options, Plan, PlannedPage } from "./types.ts";
import { openSession, dismissOverlays, type Session } from "./browser.ts";
import { ensureDir, extOfContentType, log, pool, writeJson } from "./util.ts";

const MAX_ASSET_BYTES = 20 * 1024 * 1024;

interface AssetRec { url: string; file: string; type: string; bytes: number; status: number; shared: boolean }

/** One store per run: every asset URL is downloaded once and shared by all pages. */
class AssetStore {
  private files = new Map<string, Promise<AssetRec | null>>();
  private root: string;
  private types: Set<string>;
  constructor(root: string, types: Set<string>) { this.root = root; this.types = types; }

  private relPath(url: string, ct: string): string {
    const u = new URL(url);
    let p = u.pathname.replace(/^\/+/, "");
    if (!p || p.endsWith("/")) p += "index";
    if (u.search) p += "-" + createHash("md5").update(u.search).digest("hex").slice(0, 8);
    if (!path.extname(p)) p += extOfContentType(ct, url);
    p = p.split("/").map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)).join("/");
    return path.posix.join("assets", u.hostname, p);
  }

  wants(resp: Response): boolean {
    const type = resp.request().resourceType();
    return this.types.has(type) && /^https?:/.test(resp.url()) && resp.status() < 400 && resp.status() !== 204;
  }

  /** Returns the record (shared=true if another page already fetched it). */
  save(resp: Response, budget: { left: number }): Promise<AssetRec | null> {
    const url = resp.url();
    const existing = this.files.get(url);
    if (existing) return existing.then((r) => (r ? { ...r, shared: true } : null));
    const p = (async (): Promise<AssetRec | null> => {
      try {
        const ct = resp.headers()["content-type"] ?? "";
        const len = Number(resp.headers()["content-length"] ?? 0);
        if (len > MAX_ASSET_BYTES || len > budget.left) return null;
        const body = await resp.body();
        if (body.length > MAX_ASSET_BYTES || body.length > budget.left) return null;
        budget.left -= body.length;
        const rel = this.relPath(url, ct);
        const abs = path.join(this.root, rel);
        await ensureDir(path.dirname(abs));
        await writeFile(abs, body);
        return { url, file: rel, type: resp.request().resourceType(), bytes: body.length, status: resp.status(), shared: false };
      } catch {
        return null;
      }
    })();
    this.files.set(url, p);
    return p;
  }
}

/**
 * Scroll the page once end-to-end so lazy images/grids start loading, force any
 * remaining `loading="lazy"` images to load, then return to the top. Bounded by
 * `budgetMs` so a slow page cannot stall the run.
 */
async function loadLazyContent(page: Page, budgetMs: number) {
  const deadline = Date.now() + budgetMs;
  await page.evaluate(`(async () => {
    const step = Math.max(400, Math.round(window.innerHeight * 0.9));
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    let last = -1;
    for (let y = 0; y < document.body.scrollHeight && y < 60000; y += step) {
      window.scrollTo(0, y);
      await pause(60);
      if (document.body.scrollHeight === last && y > document.body.scrollHeight) break;
      last = document.body.scrollHeight;
    }
    window.scrollTo(0, document.body.scrollHeight);
    await pause(120);
    // Anything still deferred: opt it in and kick off decoding.
    document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => el.loading = "eager");
    document.querySelectorAll("img[data-src]:not([src]), img[data-lazy-src]:not([src])").forEach((el) => {
      el.src = el.dataset.src || el.dataset.lazySrc || el.src;
    });
    window.scrollTo(0, 0);
    await pause(80);
  })()`).catch(() => {});
  // Give the newly requested images a moment, then wait for decode where we can.
  const left = Math.max(0, deadline - Date.now());
  if (left > 0) {
    await Promise.race([
      page.evaluate(`Promise.all([...document.images].filter(i => !i.complete).slice(0, 80).map(i => i.decode().catch(() => {})))`),
      new Promise((r) => setTimeout(r, left)),
    ]).catch(() => {});
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function capturePage(page: Page, item: PlannedPage, dir: string, store: AssetStore, opts: Options): Promise<CaptureMeta> {
  const t0 = Date.now();
  const assets: AssetRec[] = [];
  const pending: Promise<void>[] = [];
  const budget = { left: opts.assetBudgetMb * 1024 * 1024 };

  const onResponse = (resp: Response) => {
    if (!opts.assets || !store.wants(resp)) return;
    pending.push(store.save(resp, budget).then((r) => { if (r) assets.push(r); }));
  };
  page.on("response", onResponse);

  let status: number | null = null;
  let error: string | undefined;
  let navMs = 0, settleMs = 0;
  try {
    // Fast path: return on DOMContentLoaded, then give the page at most `settleMs` to finish loading/painting.
    const resp = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
    status = resp?.status() ?? null;
    navMs = Date.now() - t0;
    const t1 = Date.now();
    await page.waitForLoadState("load", { timeout: opts.settleMs }).catch(() => {});
    const remaining = Math.max(200, opts.settleMs - (Date.now() - t1));
    await page.waitForLoadState("networkidle", { timeout: remaining }).catch(() => {});
    await dismissOverlays(page);
    if (opts.lazy) await loadLazyContent(page, opts.lazyMs);
    settleMs = Date.now() - t1;
  } catch (e) {
    error = (e as Error).message.split("\n")[0];
    navMs = Date.now() - t0;
  }

  await ensureDir(dir);
  const files = { html: "page.html", screenshot: "screenshot.png", fullPage: "full.png", assets: "../../assets" };
  let title = "", finalUrl = page.url(), links = 0;

  if (finalUrl !== "about:blank") {
    try {
      const [html, shot, , info] = await Promise.all([
        page.content(),
        page.screenshot({ path: path.join(dir, files.screenshot), type: "png", timeout: opts.shotTimeoutMs }).catch((e: Error) => e),
        opts.fullPage ? page.screenshot({ path: path.join(dir, files.fullPage), type: "png", fullPage: true, timeout: opts.shotTimeoutMs * 2 }).catch(() => null) : Promise.resolve(null),
        page.evaluate(`({ title: document.title, links: [...document.querySelectorAll("a[href]")].map(a => ({ href: a.href, text: (a.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 80) })) })`) as Promise<{ title: string; links: { href: string; text: string }[] }>,
      ]);
      if (shot instanceof Error) error = `screenshot: ${shot.message.split("\n")[0]}`;
      title = info.title;
      links = info.links.length;
      await writeFile(path.join(dir, files.html), html);
      await writeJson(path.join(dir, "links.json"), info.links);
      if (opts.assets) {
        // Don't let slow asset bodies hold the page hostage.
        await withTimeout(Promise.all(pending), opts.assetWaitMs, undefined);
        let local = html;
        for (const a of assets) local = local.split(a.url).join("../../" + a.file);
        await writeFile(path.join(dir, "page.local.html"), local);
        await writeJson(path.join(dir, "assets.json"), assets);
      }
      if (error && !error.startsWith("screenshot:")) error = undefined; // partial load but we still got a capture
    } catch (e) {
      error = error ?? (e as Error).message.split("\n")[0];
    }
  }
  page.off("response", onResponse);

  const meta: CaptureMeta = {
    id: item.id, url: item.url, finalUrl, title, status, ok: !error && (status === null || status < 400), error,
    timings: { navMs, settleMs, totalMs: Date.now() - t0 },
    files, assetCount: assets.length, assetBytes: assets.filter((a) => !a.shared).reduce((s, a) => s + a.bytes, 0), links,
    capturedAt: new Date().toISOString(),
  };
  await writeJson(path.join(dir, "meta.json"), meta);
  return meta;
}

const ORDER = { high: 0, medium: 1, low: 2, skip: 3 } as const;

export function selectPages(plan: Plan, opts: Options): PlannedPage[] {
  return plan.pages
    .filter((p) => ORDER[p.priority] <= ORDER[opts.minPriority])
    .filter((p) => !opts.exclude?.test(p.url))
    .filter((p) => !opts.include || opts.include.test(p.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxPages);
}

export async function capture(plan: Plan, outDir: string, opts: Options, shared?: Session): Promise<Manifest> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const pages = selectPages(plan, opts);
  log(`capturing ${pages.length} pages with concurrency ${opts.concurrency}`, { outDir, assetTypes: [...opts.assetTypes] });
  const store = new AssetStore(outDir, opts.assetTypes);
  const nCtx = Math.min(opts.concurrency, pages.length);
  const session = shared ?? (await openSession(opts, nCtx, plan.startUrl));
  let relaunching: Promise<void> | null = null;
  const ensureBrowser = async () => {
    if (session.isAlive()) return;
    relaunching ??= session.restart().finally(() => { relaunching = null; });
    await relaunching;
  };
  const free: number[] = Array.from({ length: nCtx }, (_, i) => i);
  // Hard ceiling per page so a wedged renderer can never stall the whole run.
  const watchdogMs = opts.timeoutMs + opts.settleMs + opts.assetWaitMs + 30000;

  const results = await pool(pages, opts.concurrency, async (item) => {
    const ci = free.pop() ?? 0;
    const dir = path.join(outDir, "pages", item.id);
    const t0 = Date.now();
    let page: Page | null = null;
    try {
      await ensureBrowser();
      page = await (await session.context(ci)).newPage();
      await session.preparePage(page);
      const meta = await withTimeout(capturePage(page, item, dir, store, opts), watchdogMs, null);
      if (!meta) throw new Error(`watchdog: page exceeded ${watchdogMs} ms`);
      log(`${meta.ok ? "ok " : "ERR"} ${item.id}`, { ms: meta.timings.totalMs, status: meta.status, assets: meta.assetCount, newKB: Math.round(meta.assetBytes / 1024), err: meta.error });
      return meta;
    } catch (e) {
      const error = (e as Error).message.split("\n")[0];
      log(`ERR ${item.id}`, { error });
      const meta: CaptureMeta = {
        id: item.id, url: item.url, finalUrl: item.url, title: "", status: null, ok: false, error,
        timings: { navMs: 0, settleMs: 0, totalMs: Date.now() - t0 },
        files: { html: "page.html", screenshot: "screenshot.png", fullPage: "full.png", assets: "../../assets" },
        assetCount: 0, assetBytes: 0, links: 0, capturedAt: new Date().toISOString(),
      };
      await writeJson(path.join(dir, "meta.json"), meta).catch(() => {});
      return meta;
    } finally {
      await withTimeout(page?.close().catch(() => {}) ?? Promise.resolve(), 3000, undefined);
      free.push(ci);
    }
  });

  if (!shared) await session.close();
  const manifest: Manifest = {
    site: plan.site, startUrl: plan.startUrl, outDir, startedAt, finishedAt: new Date().toISOString(), pages: results,
    stats: {
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      assets: results.reduce((s, r) => s + r.assetCount, 0),
      bytes: results.reduce((s, r) => s + r.assetBytes, 0),
      durationMs: Date.now() - t0,
    },
  };
  await writeJson(path.join(outDir, "manifest.json"), manifest);
  return manifest;
}
