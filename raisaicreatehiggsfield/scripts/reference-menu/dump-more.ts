import { chromium } from "/Users/raishelmy/Downloads/raisproject/raisdownloadscreenshotautomate/node_modules/playwright";
const out = process.argv[2]!;
const targets: [string, string][] = [
  ["mcp", "https://higgsfield.ai/mcp"],
  ["academy", "https://higgsfield.ai/academy"],
  ["viral-presets", "https://higgsfield.ai/viral-presets"],
  ["canvas", "https://higgsfield.ai/canvas"],
  ["supercomputer", "https://higgsfield.ai/supercomputer"],
  ["enterprise", "https://higgsfield.ai/enterprise"],
  ["3d-jutsu", "https://higgsfield.ai/3d-jutsu"],
  ["marketing-studio", "https://higgsfield.ai/marketing-studio"],
  ["originals", "https://higgsfield.ai/original-series"],
];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" });
const page = await ctx.newPage();
for (const [name, url] of targets) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    for (const sel of ['a:has-text("Dismiss")', 'button:has-text("Dismiss")']) {
      try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 300 })) await b.click({ timeout: 700 }); } catch {}
    }
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < Math.min(h, 9000); y += 800) { await page.mouse.wheel(0, 800); await page.waitForTimeout(160); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1500);
    await Bun.write(`${out}/${name}.html`, await page.evaluate(() => document.body.innerHTML));
    await page.screenshot({ path: `${out}/${name}.png` });
    console.error(name, page.url().replace("https://higgsfield.ai", ""), "h=" + h);
  } catch (e) { console.error(name, "FAILED", String(e).slice(0, 80)); }
}
await browser.close();
