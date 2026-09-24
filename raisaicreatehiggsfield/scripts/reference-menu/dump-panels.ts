// Run from raisdownloadscreenshotautomate (it has Playwright): bun run ../raisaicreatehiggsfield/scripts/reference-menu/dump-panels.ts <outDir>
import { chromium } from "playwright";
const out = process.argv[2];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" });
const page = await ctx.newPage();
await page.goto("https://higgsfield.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
// dismiss cookie banners if any
for (const sel of ['button:has-text("Accept")', 'button:has-text("Accept All")', '[aria-label="Close"]']) {
  try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 500 })) await b.click({ timeout: 1000 }); } catch {}
}
const triggers = await page.$$eval('[data-nav-trigger]', els => els.map(e => e.getAttribute('data-nav-trigger')));
console.error('triggers', triggers);
const result: Record<string, string> = {};
for (const t of triggers) {
  const trig = page.locator(`[data-nav-trigger="${t}"]`).first();
  await trig.hover();
  await page.waitForTimeout(900);
  const html = await page.evaluate(() => {
    const vp = document.querySelector('.hfnav-viewport-position');
    return vp ? vp.outerHTML : '';
  });
  result[t!] = html;
  const safe = t!.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({ path: `${out}/${safe}.png` });
  await Bun.write(`${out}/${safe}.html`, html);
  console.error(t, html.length);
  await page.mouse.move(700, 700);
  await page.waitForTimeout(500);
}
// also grab computed styles for key classes inside a panel
await browser.close();
