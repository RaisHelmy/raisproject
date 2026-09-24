import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
const S = process.argv[2]!, OUT = "public/pages";
const ent = JSON.parse(await Bun.file(`${S}/enterprise.json`).text());
const ms = JSON.parse(await Bun.file(`${S}/marketing.json`).text());
const sc = JSON.parse(await Bun.file(`${S}/super.json`).text());
const map: Record<string, string> = {};
function norm(u: string) {
  if (u.startsWith("/")) u = "https://static.higgsfield.ai" + u;
  const m = u.match(/cdn-cgi\/image\/[^/]*\/(https?:\/\/.*)$/);
  if (m) return m[1]!;
  const m2 = u.match(/^https:\/\/cdn\.higgsfield\.ai\/cdn-cgi\/image\/[^/]*\/(.*)$/);
  if (m2) return "https://cdn.higgsfield.ai/" + m2[1]!;
  return u;
}
async function grab(orig: string) {
  if (!orig || map[orig]) return;
  const u = norm(orig);
  const ext = u.match(/\.(mp4|webm|webp|png|jpg|jpeg|svg|avif)/)?.[1] ?? "webp";
  const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + "." + ext;
  if (!existsSync(`${OUT}/${file}`)) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) { console.error("FAIL", r.status, u.slice(0, 90)); return; }
      const b = await r.arrayBuffer();
      if (b.byteLength > 12e6) { console.error("BIG", (b.byteLength / 1e6).toFixed(1) + "MB", u.slice(0, 70)); return; }
      await Bun.write(`${OUT}/${file}`, b);
    } catch { console.error("ERR", u.slice(0, 90)); return; }
  }
  map[orig] = `/pages/${file}`;
}
const all: string[] = [
  ...ent.imgs.filter((u: string) => !u.includes("country-flags")).slice(0, 60),
  ...ent.vids,
  ...ms.heroes, ...ms.tiles,
  ...sc.cards.map((c: any) => c.img || c.vid),
  ...sc.cards.map((c: any) => c.vid).filter(Boolean),
];
let i = 0;
for (const u of all) { await grab(u); if (++i % 20 === 0) console.error("...", i, "/", all.length); }
await Bun.write(`${S}/media3.json`, JSON.stringify(map, null, 1));
console.log("downloaded", Object.keys(map).length, "of", all.length);
