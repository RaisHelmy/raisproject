// Step 4: bun run scripts/reference-menu/dl-explore-videos.ts <dumpDir> apps/web/public/explore/video   (clips over 25MB are skipped: Cloudflare asset limit)
import { createHash } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
const S = process.argv[2]!, OUT = process.argv[3]!; const MAX = 25 * 1024 * 1024;
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(await Bun.file(`${S}/explore-data.json`).text());
const urls = new Set<string>();
const walk = (v: any) => { if (!v) return; if (typeof v === "string") { if (/\.mp4(\?|$)/.test(v)) urls.add(v); return; } if (Array.isArray(v)) v.forEach(walk); else if (typeof v === "object") Object.values(v).forEach(walk); };
walk(data);
const list = [...urls]; console.error("videos", list.length);
const map: Record<string, string> = {}; const skipped: string[] = []; let total = 0, i = 0;
async function worker() {
  while (i < list.length) {
    const u = list[i++]!; const file = createHash("sha1").update(u).digest("hex").slice(0, 12) + ".mp4";
    try {
      if (!existsSync(`${OUT}/${file}`)) {
        const h = await fetch(u, { method: "HEAD", headers: { "user-agent": "Mozilla/5.0" } });
        const len = Number(h.headers.get("content-length") ?? 0);
        if (!h.ok) { skipped.push(`${h.status} ${u}`); continue; }
        if (len > MAX) { skipped.push(`too big ${(len / 1e6).toFixed(1)}MB ${u}`); continue; }
        const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
        if (!r.ok) { skipped.push(`${r.status} ${u}`); continue; }
        const buf = await r.arrayBuffer(); await Bun.write(`${OUT}/${file}`, buf); total += buf.byteLength;
        console.error("ok", (buf.byteLength / 1e6).toFixed(1), "MB", file);
      }
      map[u] = `/explore/video/${file}`;
    } catch (e) { skipped.push(`err ${u} ${String(e)}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
await Bun.write(`${S}/video-map.json`, JSON.stringify(map, null, 1));
await Bun.write(`${S}/video-skipped.json`, JSON.stringify(skipped, null, 1));
console.error("done", Object.keys(map).length, "downloaded MB", (total / 1e6).toFixed(0), "skipped", skipped.length);
