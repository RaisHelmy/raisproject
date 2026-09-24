// Step 3: bun run scripts/reference-menu/dl-explore-images.ts <dumpDir> apps/web/public/explore   (needs <dumpDir>/explore-data.json from the extraction step)
import { createHash } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
const S = process.argv[2]!, OUT = process.argv[3]!;
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(await Bun.file(`${S}/explore-data.json`).text());
const urls = new Set<string>();
const add = (u?: string | null) => { if (u && typeof u === "string") urls.add(u); };
const walk = (v: any) => { if (!v) return; if (typeof v === "string") { if (/^(https?:)?\/.*\.(webp|png|jpg|jpeg|svg|gif)(\?|$)|images\.higgs\.ai|cdn-cgi\/image/.test(v)) add(v); return; } if (Array.isArray(v)) v.forEach(walk); else if (typeof v === "object") Object.values(v).forEach(walk); };
walk(data);
// static extras seen in the markup
["https://static.higgsfield.ai/explore-image/bg-mcp.png","https://higgsfield.ai/explore/image-generate-block/sc-hero-pattern.svg","https://static.higgsfield.ai/spc-banner/bg-spc-banner.png","https://static.higgsfield.ai/spc-banner/spc-banner-creative.png","https://static.higgsfield.ai/spc-banner/spc-banner-visualizing.png","https://static.higgsfield.ai/spc-banner/spc-banner-marketing.png","https://static.higgsfield.ai/spc-banner/spc-banner-production.png","https://static.higgsfield.ai/spc-banner/spc-banner-logo.png","https://static.higgsfield.ai/canvas-banner-bg-desktop.webp","https://static.higgsfield.ai/canvas-banner-desktop.webp","https://static.higgsfield.ai/canvas-banner-bg-mobile.webp","https://static.higgsfield.ai/canvas-banner-mobile.webp","https://higgsfield.ai/photodump/cta-desktop.png","https://higgsfield.ai/photodump/cta-mobile.png","https://higgsfield.ai/promotions/seedance-2-5-sale-hero-poster.jpg"].forEach(add);
function normalize(u: string): string {
  if (u.startsWith("/")) u = "https://higgsfield.ai" + u;
  // unwrap cloudflare image resizing → original
  const m = u.match(/cdn-cgi\/image\/[^/]*\/(https?:\/\/.*|[^h].*)$/);
  if (m) u = m[1]!.startsWith("http") ? m[1]! : "https://higgsfield.ai/" + m[1]!;
  // images.higgs.ai proxy → request 640w webp
  const p = u.match(/images\.higgs\.ai\/\?.*?url=([^&]+)/);
  if (p) return `https://images.higgs.ai/?default=1&output=webp&url=${p[1]}&w=640&q=85`;
  return u;
}
const map: Record<string, string> = {};
const list = [...urls];
console.error("unique image urls", list.length);
let i = 0, ok = 0, fail = 0;
async function worker() {
  while (i < list.length) {
    const orig = list[i++]!; const u = normalize(orig);
    const hash = createHash("sha1").update(u).digest("hex").slice(0, 12);
    const extM = u.match(/\.(webp|png|jpg|jpeg|svg|gif)(\?|$)/); const ext = u.includes("images.higgs.ai") ? "webp" : (extM?.[1] ?? "webp");
    const file = `${hash}.${ext}`;
    if (!existsSync(`${OUT}/${file}`)) {
      try {
        const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0", accept: "image/*,*/*" } });
        if (!r.ok) { fail++; console.error("FAIL", r.status, u.slice(0, 120)); continue; }
        await Bun.write(`${OUT}/${file}`, await r.arrayBuffer()); ok++;
      } catch (e) { fail++; console.error("ERR", u.slice(0, 120), String(e)); continue; }
    } else ok++;
    map[orig] = `/explore/${file}`;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
await Bun.write(`${S}/image-map.json`, JSON.stringify(map, null, 1));
console.error("done ok", ok, "fail", fail);
