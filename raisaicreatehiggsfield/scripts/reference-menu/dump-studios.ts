// Step 1 of the studio port: capture the live Video/Image/Audio studio pages. Run with bun from raisdownloadscreenshotautomate: bun run ../raisaicreatehiggsfield/scripts/reference-menu/dump-studios.ts <dumpDir>
import { chromium } from "/Users/raishelmy/Downloads/raisproject/raisdownloadscreenshotautomate/node_modules/playwright";
const out = process.argv[2]!;
const targets: [string, string][] = [["video", "https://higgsfield.ai/ai/video"], ["image", "https://higgsfield.ai/ai/image"], ["audio", "https://higgsfield.ai/audio"]];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" });
const page = await ctx.newPage();
const media = new Map<string, string>();
page.on("response", (r) => { const ct = r.headers()["content-type"] ?? ""; if (/^(image|video)\//.test(ct)) media.set(r.url(), ct); });
for (const [name, url] of targets) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(7000);
  for (const sel of ['button:has-text("Dismiss")', 'button:has-text("Accept")', '[aria-label="Close"]']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 400 })) await b.click({ timeout: 800 }); } catch {}
  }
  await page.waitForTimeout(2500);
  const html = await page.evaluate(() => document.body.innerHTML);
  await Bun.write(`${out}/${name}.html`, html);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  console.error(name, page.url(), "html", html.length);
}
await Bun.write(`${out}/media.json`, JSON.stringify([...media.entries()], null, 1));
await browser.close();
