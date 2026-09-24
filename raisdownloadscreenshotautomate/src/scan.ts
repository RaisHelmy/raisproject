import type { Page } from "playwright";
import type { DiscoveredLink, LinkSource, Options, ScanResult } from "./types.ts";
import { openSession, dismissOverlays, type Session } from "./browser.ts";
import { hostOf, log, normalizeUrl, sameSite } from "./util.ts";

interface RawLink { href: string; text: string; source: LinkSource; parent?: string; visible: boolean }

/** Runs inside the page: collect anchors and classify by ancestor region. */
const COLLECT = `(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };
  const region = (el) => {
    let n = el;
    while (n && n !== document.body) {
      const tag = n.tagName.toLowerCase();
      const cls = (typeof n.className === "string" ? n.className : "") + " " + (n.id || "");
      const role = n.getAttribute("role") || "";
      if (tag === "footer" || role === "contentinfo" || /footer/i.test(cls)) return "footer";
      if (tag === "aside" || /sidebar|side-nav|sidenav/i.test(cls)) return "sidebar";
      if (tag === "header" || tag === "nav" || role === "navigation" || role === "menubar" || /\\b(navbar|nav-bar|main-nav|site-nav|top-nav|primary-nav|menu-bar|site-header|app-header)\\b/i.test(cls)) return "main-nav";
      n = n.parentElement;
    }
    return "body";
  };
  const heroLimit = window.innerHeight * 1.2;
  const out = [];
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const text = (a.innerText || a.getAttribute("aria-label") || a.getAttribute("title") || "").trim().replace(/\\s+/g, " ").slice(0, 80);
    let source = region(a);
    if (source === "body") {
      const r = a.getBoundingClientRect();
      const looksCta = /\\bbtn|button|cta\\b/i.test(typeof a.className === "string" ? a.className : "") || a.getAttribute("role") === "button";
      if (r.top + window.scrollY < heroLimit && looksCta) source = "hero-cta";
    }
    out.push({ href: a.href, text, source, visible: isVisible(a) });
  });
  return out;
})()`;

/** Runs inside the page: find top-level nav triggers (things that may open a submenu). */
const TRIGGERS = `(() => {
  const isVisible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const roots = [...document.querySelectorAll("header, nav, [role=navigation], [role=menubar], aside")];
  const seen = new Set(); const out = [];
  for (const root of roots) {
    root.querySelectorAll("button, a, [role=menuitem], [aria-haspopup], [aria-expanded], li > span, li > div").forEach((el) => {
      if (!isVisible(el) || seen.has(el)) return;
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 60);
      if (!text || text.length > 40) return;
      const hasPopup = el.hasAttribute("aria-haspopup") || el.hasAttribute("aria-expanded");
      const li = el.closest("li");
      const hasNested = !!(li && li.querySelector("ul, [role=menu], [class*=dropdown], [class*=submenu], [class*=mega]"));
      const isBtn = el.tagName === "BUTTON" || el.getAttribute("role") === "button";
      if (!(hasPopup || hasNested || isBtn)) return;
      seen.add(el);
      el.setAttribute("data-rdsa-trigger", String(out.length));
      out.push({ idx: out.length, text, hasPopup, hasNested, isBtn });
    });
  }
  return out;
})()`;

/** Wait for hydration: scroll through the page (lazy sections/footers) and wait until the anchor count stops changing. */
async function settle(page: Page, opts: Options) {
  const deadline = Date.now() + Math.max(opts.settleMs * 3, 6000);
  const count = () => page.evaluate("document.querySelectorAll('a[href]').length") as Promise<number>;
  let last = -1, stableFor = 0, scrolled = false;
  while (Date.now() < deadline) {
    const n = await count().catch(() => 0);
    if (n === last) stableFor += 250; else { stableFor = 0; last = n; }
    if (stableFor >= 750 && !scrolled) {
      // Reveal lazy content and the footer, then let it hydrate.
      await page.evaluate(`(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 900) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, document.body.scrollHeight); })()`).catch(() => {});
      await page.waitForTimeout(400);
      await page.evaluate("window.scrollTo(0, 0)").catch(() => {});
      scrolled = true; stableFor = 0; last = -1;
      continue;
    }
    if (stableFor >= 750 && scrolled && n > 0) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(200);
}

async function collect(page: Page): Promise<RawLink[]> {
  return page.evaluate(COLLECT) as Promise<RawLink[]>;
}

async function collectSubmenus(page: Page, base: string): Promise<RawLink[]> {
  const triggers = (await page.evaluate(TRIGGERS)) as { idx: number; text: string; hasPopup: boolean; hasNested: boolean; isBtn: boolean }[];
  const before = new Set((await collect(page)).filter((l) => l.visible).map((l) => l.href));
  const found: RawLink[] = [];
  for (const t of triggers) {
    const el = page.locator(`[data-rdsa-trigger="${t.idx}"]`).first();
    try {
      await el.hover({ timeout: 800 });
      await page.waitForTimeout(250);
      let after = (await collect(page)).filter((l) => l.visible && !before.has(l.href));
      if (after.length === 0 && (t.hasPopup || t.isBtn)) {
        await el.click({ timeout: 800, noWaitAfter: true });
        await page.waitForTimeout(300);
        if (page.url().split("#")[0] !== base.split("#")[0]) {
          await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForTimeout(200);
          continue;
        }
        after = (await collect(page)).filter((l) => l.visible && !before.has(l.href));
      }
      for (const l of after) found.push({ ...l, source: "sub-nav", parent: t.text });
      if (after.length) log(`submenu "${t.text}": ${after.length} links`);
      await page.keyboard.press("Escape").catch(() => {});
      await page.mouse.move(0, 0);
      await page.waitForTimeout(120);
    } catch {}
  }
  return found;
}

export async function scan(startUrl: string, opts: Options, shared?: Session): Promise<ScanResult> {
  const t0 = Date.now();
  const notes: string[] = [];
  const session = shared ?? (await openSession(opts, 1, startUrl));
  const ctx = await session.context(0);
  const page = await ctx.newPage();
  await session.preparePage(page);
  const links = new Map<string, DiscoveredLink>();
  const rank: Record<LinkSource, number> = { "main-nav": 0, "sub-nav": 1, sidebar: 2, "hero-cta": 3, footer: 4, body: 5 };
  let order = 0;

  const add = (raw: RawLink, base: string) => {
    const url = normalizeUrl(raw.href, base);
    if (!url || !sameSite(url, startUrl)) return;
    if (opts.exclude?.test(url)) return;
    if (opts.include && !opts.include.test(url)) return;
    const depth = new URL(url).pathname.split("/").filter(Boolean).length;
    const existing = links.get(url);
    const cand: DiscoveredLink = { url, text: raw.text, source: raw.source, parent: raw.parent, depth, order: order++ };
    if (!existing || rank[cand.source] < rank[existing.source]) {
      links.set(url, { ...cand, order: existing?.order ?? cand.order, text: cand.text || existing?.text || "" });
    }
  };

  const scanPage = async (url: string, withSubmenus: boolean) => {
    log(`scan ${url}`);
    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: opts.settleMs }).catch(() => {});
    await settle(page, opts);
    await dismissOverlays(page);
    if (resp && resp.status() >= 400) notes.push(`${url} responded ${resp.status()}`);
    const base = page.url();
    const raw = await collect(page);
    for (const l of raw) add(l, base);
    if (withSubmenus && opts.hover) {
      const subs = await collectSubmenus(page, base);
      for (const l of subs) add(l, base);
    }
  };

  await scanPage(startUrl, true);
  const rootHost = hostOf(startUrl);
  if (links.size < 3) notes.push("Very few links found on start page; site may need login (use `login`) or be JS-gated.");

  if (opts.scanDepth >= 1) {
    const mains = [...links.values()].filter((l) => l.source === "main-nav" || l.source === "sidebar").slice(0, 25);
    for (const m of mains) {
      if (hostOf(m.url) !== rootHost) continue;
      try { await scanPage(m.url, true); } catch (e) { notes.push(`scan ${m.url} failed: ${(e as Error).message.split("\n")[0]}`); }
    }
  }

  await page.close().catch(() => {});
  if (!shared) await session.close();
  const all = [...links.values()].sort((a, b) => rank[a.source] - rank[b.source] || a.order - b.order);
  return { site: rootHost, startUrl, scannedAt: new Date().toISOString(), durationMs: Date.now() - t0, links: all, notes };
}
