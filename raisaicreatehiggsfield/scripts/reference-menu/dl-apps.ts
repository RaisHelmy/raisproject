import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
const S = process.argv[2]!, OUT = "public/apps";
const data = JSON.parse(await Bun.file(`${S}/apps.json`).text());
const map: Record<string, string> = {};
function norm(u: string) {
  if (u.startsWith("/")) u = "https://higgsfield.ai" + u;
  const p = u.match(/images\.higgs\.ai\/\?.*?url=([^&]+)/);
  if (p) return decodeURIComponent(p[1]!);
  const m = u.match(/cdn-cgi\/image\/[^/]*\/(https?:\/\/.*)$/);
  if (m) return m[1]!;
  const m2 = u.match(/^https:\/\/cdn\.higgsfield\.ai\/cdn-cgi\/image\/[^/]*\/(.*)$/);
  return m2 ? "https://cdn.higgsfield.ai/" + m2[1]! : u;
}
async function grab(orig: string) {
  if (!orig || map[orig]) return;
  const u = norm(orig);
  const ext = u.match(/\.(mp4|webm|webp|png|jpg|jpeg|avif)/)?.[1] ?? "webp";
  const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + "." + ext;
  if (!existsSync(`${OUT}/${file}`)) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) { console.error("FAIL", r.status, u.slice(0, 80)); return; }
      const b = await r.arrayBuffer();
      if (b.byteLength > 10e6) { console.error("BIG", (b.byteLength / 1e6).toFixed(1) + "MB", u.slice(0, 60)); return; }
      await Bun.write(`${OUT}/${file}`, b);
    } catch { console.error("ERR", u.slice(0, 80)); return; }
  }
  map[orig] = `/apps/${file}`;
}
const all: string[] = [];
for (const page of Object.values<any>(data)) {
  for (const p of page.presets ?? []) { if (p.vid) all.push(p.vid); if (p.img) all.push(p.img); }
  for (const h of page.hero ?? []) all.push(h);
  for (const i of page.imgs ?? []) all.push(i);
}
let n = 0;
for (const u of all) { await grab(u); if (++n % 25 === 0) console.error("...", n, "/", all.length); }
await Bun.write(`${S}/media-apps.json`, JSON.stringify(map, null, 1));
console.log("downloaded", Object.keys(map).length, "of", all.length);
