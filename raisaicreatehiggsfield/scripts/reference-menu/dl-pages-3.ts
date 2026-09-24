import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
const S = process.argv[2]!, OUT = "public/pages";
const pl = JSON.parse(await Bun.file(`${S}/plugins.json`).text());
const co = JSON.parse(await Bun.file(`${S}/contests.json`).text());
const ci = JSON.parse(await Bun.file(`${S}/cinema.json`).text());
const map: Record<string, string> = {};
function norm(u: string) {
  if (u.startsWith("/")) u = "https://higgsfield.ai" + u;
  const p = u.match(/images\.higgs\.ai\/\?.*?url=([^&]+)/);
  if (p) return `https://images.higgs.ai/?default=1&output=webp&url=${p[1]}&w=640&q=85`;
  const m = u.match(/cdn-cgi\/image\/[^/]*\/(https?:\/\/.*)$/);
  return m ? m[1]! : u;
}
async function grab(orig: string) {
  const u = norm(orig);
  const ext = u.includes("images.higgs.ai") ? "webp" : (u.match(/\.(mp4|webp|png|jpg|jpeg|svg)/)?.[1] ?? "webp");
  const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + "." + ext;
  if (!existsSync(`${OUT}/${file}`)) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) { console.error("FAIL", r.status, u.slice(0, 80)); return; }
      const b = await r.arrayBuffer();
      if (b.byteLength > 25e6) { console.error("BIG", u.slice(0, 60)); return; }
      await Bun.write(`${OUT}/${file}`, b);
    } catch { console.error("ERR", u.slice(0, 80)); return; }
  }
  map[orig] = `/pages/${file}`;
}
const all = [...pl.imgs, ...pl.videos.slice(0, 2), ...co.films.map((f: any) => f.img), ...ci.cards.map((c: any) => c.img)].filter(Boolean);
const q = [...new Set(all)] as string[];
console.error("urls", q.length);
await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) await grab(q.shift()!); }));
const prev = JSON.parse(await Bun.file(`${S}/../more/pages-map.json`).text());
await Bun.write(`${S}/../more/pages-map.json`, JSON.stringify({ ...prev, ...map }, null, 1));
console.error("mapped", Object.keys(map).length);
