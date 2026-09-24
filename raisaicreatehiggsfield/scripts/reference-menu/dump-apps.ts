import { chromium } from "/Users/raishelmy/Downloads/raisproject/raisdownloadscreenshotautomate/node_modules/playwright";
const out = process.argv[2]!;
const routes = ["/lipsync-studio", "/shorts-studio", "/faceless-studio", "/moodboard", "/character",
  "/explainer", "/mixed-media", "/ai-influencer-studio", "/apps/face-swap", "/apps/relight", "/apps/link-to-video-ad"];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const r of routes) {
  const name = r.replace(/\//g, "_").replace(/^_/, "");
  try {
    await page.goto("https://higgsfield.ai" + r, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4500);
    const html = await page.content();
    await Bun.write(`${out}/${name}.html`, html);
    await page.screenshot({ path: `${out}/${name}.png` });
    const txt = await page.evaluate(() => (document.querySelector("main") ?? document.body).innerText.replace(/\s+/g, " ").slice(0, 200));
    console.log(r.padEnd(24), (html.length / 1024).toFixed(0).padStart(5) + "K", "|", txt);
  } catch (e) { console.log(r.padEnd(24), "ERROR", (e as Error).message.slice(0, 60)); }
}
await browser.close();
