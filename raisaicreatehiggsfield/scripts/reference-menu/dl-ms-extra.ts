import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
const S = process.argv[2]!, OUT = "public/pages";
const missing: string[] = JSON.parse(await Bun.file(`${S}/ms_missing.json`).text());
const map: Record<string, string> = JSON.parse(await Bun.file(`${S}/media3.json`).text());
function norm(u: string) {
  const m = u.match(/^https:\/\/cdn\.higgsfield\.ai\/cdn-cgi\/image\/[^/]*\/(.*)$/);
  if (m) return "https://cdn.higgsfield.ai/" + m[1]!;
  const m2 = u.match(/cdn-cgi\/image\/[^/]*\/(https?:\/\/.*)$/);
  return m2 ? m2[1]! : u;
}
let n = 0;
for (const orig of missing) {
  if (!orig || map[orig]) continue;
  const u = norm(orig);
  const ext = u.match(/\.(mp4|webm|webp|png|jpg|jpeg)/)?.[1] ?? "webp";
  const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + "." + ext;
  if (!existsSync(`${OUT}/${file}`)) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) { console.error("FAIL", r.status, u.slice(0, 80)); continue; }
      const b = await r.arrayBuffer();
      if (b.byteLength > 12e6) { console.error("BIG", u.slice(0, 60)); continue; }
      await Bun.write(`${OUT}/${file}`, b);
    } catch { console.error("ERR", u.slice(0, 80)); continue; }
  }
  map[orig] = `/pages/${file}`; n++;
}
await Bun.write(`${S}/media3.json`, JSON.stringify(map, null, 1));
console.log("added", n, "total", Object.keys(map).length);
