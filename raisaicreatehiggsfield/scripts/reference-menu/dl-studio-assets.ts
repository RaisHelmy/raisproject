// Step 2: bun run scripts/reference-menu/dl-studio-assets.ts <dumpDir> apps/web/public/studio   (needs <dumpDir>/asset-urls.json)
import { createHash } from "node:crypto";
const S = process.argv[2]!, OUT = process.argv[3]!;
const urls: string[] = JSON.parse(await Bun.file(`${S}/asset-urls.json`).text());
const map: Record<string, string> = {};
for (const orig of urls) {
  let u = orig.startsWith("/") ? "https://higgsfield.ai" + orig : orig;
  const m = u.match(/cdn-cgi\/image\/[^/]*\/(.*)$/);
  if (m) u = m[1]!.startsWith("http") ? m[1]! : "https://higgsfield.ai/" + m[1]!;
  const ext = (u.match(/\.(mp4|webp|png|jpg|jpeg|svg)/)?.[1]) ?? "webp";
  const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + "." + ext;
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) { console.error("FAIL", r.status, u.slice(0, 110)); continue; }
    const b = await r.arrayBuffer(); await Bun.write(`${OUT}/${file}`, b);
    map[orig] = `/studio/${file}`;
    console.error("ok", (b.byteLength / 1e3).toFixed(0) + "KB", file, u.slice(-60));
  } catch (e) { console.error("ERR", u.slice(0, 110)); }
}
await Bun.write(`${S}/asset-map.json`, JSON.stringify(map, null, 1));
console.error("done", Object.keys(map).length, "of", urls.length);
