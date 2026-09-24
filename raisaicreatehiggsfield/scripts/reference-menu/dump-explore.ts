// Step 1 of the Explore port: dump the live Explore page (scrolled, so lazy media loads). Run with bun from raisdownloadscreenshotautomate: bun run ../raisaicreatehiggsfield/scripts/reference-menu/dump-explore.ts <dumpDir>
import { chromium } from "/Users/raishelmy/Downloads/raisproject/raisdownloadscreenshotautomate/node_modules/playwright";
const out = process.argv[2]!;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" });
const page = await ctx.newPage();
const media = new Map<string, { type: string; bytes: number }>();
page.on("response", async (r) => {
  const ct = r.headers()["content-type"] ?? "";
  const u = r.url();
  if (/^(image|video)\//.test(ct) || /\.(mp4|webm|webp|png|jpg|jpeg|svg|gif)(\?|$)/.test(u)) {
    if (!media.has(u)) media.set(u, { type: ct, bytes: Number(r.headers()["content-length"] ?? 0) });
  }
});
await page.goto("https://higgsfield.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
for (const sel of ['button:has-text("Dismiss")', 'button:has-text("Accept")', '[aria-label="Close"]']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 500 })) await b.click({ timeout: 1000 }); } catch {}
}
// scroll slowly to trigger lazy loading
const total = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < total + 1200; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
await page.waitForTimeout(3000);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1000);
const html = await page.evaluate(() => document.querySelector("main")?.outerHTML ?? document.body.innerHTML);
await Bun.write(`${out}/main.html`, html);
const dom = await page.evaluate(() => {
  const urls = new Set<string>();
  document.querySelectorAll("main img").forEach((i) => { const e = i as HTMLImageElement; if (e.currentSrc) urls.add(e.currentSrc); if (e.src) urls.add(e.src); });
  document.querySelectorAll("main video, main source").forEach((v) => { const e = v as HTMLVideoElement; if (e.src) urls.add(e.src); const p = (e as HTMLVideoElement).poster; if (p) urls.add(p); if (e.currentSrc) urls.add(e.currentSrc); });
  document.querySelectorAll("main *").forEach((el) => { const bg = getComputedStyle(el).backgroundImage; const m = bg && bg.match(/url\("?([^")]+)"?\)/g); if (m) m.forEach((x) => urls.add(x.replace(/^url\("?/, "").replace(/"?\)$/, ""))); });
  return [...urls];
});
await Bun.write(`${out}/dom-media.json`, JSON.stringify(dom, null, 1));
await Bun.write(`${out}/net-media.json`, JSON.stringify([...media.entries()], null, 1));
await page.screenshot({ path: `${out}/full.png`, fullPage: true });
console.error("dom media", dom.length, "net media", media.size, "html", html.length);
await browser.close();
