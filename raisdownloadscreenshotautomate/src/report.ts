import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { Manifest, Plan } from "./types.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function writeReport(outDir: string, plan: Plan, manifest: Manifest) {
  const byId = new Map(plan.pages.map((p) => [p.id, p]));
  const cards = manifest.pages.map((m) => {
    const p = byId.get(m.id);
    return `<article class="${m.ok ? "ok" : "err"}">
  <a href="pages/${m.id}/${m.files.fullPage}" target="_blank"><img src="pages/${m.id}/${m.files.screenshot}" loading="lazy" alt=""></a>
  <h3>${esc(m.title || m.id)}</h3>
  <p class="meta"><span class="pill ${p?.priority}">${p?.priority}</span> ${p?.source ?? ""}${p?.parent ? " › " + esc(p.parent) : ""} · score ${p?.score}</p>
  <p><a href="${esc(m.url)}" target="_blank">${esc(m.url)}</a></p>
  <p class="meta">status ${m.status ?? "-"} · ${m.timings.totalMs} ms · ${m.assetCount} assets · ${(m.assetBytes / 1024).toFixed(0)} KB${m.error ? ` · <b>${esc(m.error)}</b>` : ""}</p>
  <p class="meta"><a href="pages/${m.id}/page.html" target="_blank">html</a> · <a href="pages/${m.id}/page.local.html" target="_blank">offline</a> · <a href="pages/${m.id}/meta.json" target="_blank">meta</a> · <a href="pages/${m.id}/assets.json" target="_blank">assets</a></p>
</article>`;
  }).join("\n");

  const skipped = plan.pages.filter((p) => !manifest.pages.some((m) => m.id === p.id));
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(plan.site)} capture</title>
<style>
body{font:14px system-ui;margin:24px;background:#0f1115;color:#e6e6e6}a{color:#8ab4ff}
h1{margin:0 0 4px}.sub{color:#999;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px}
article{background:#181b22;border:1px solid #262a33;border-radius:10px;padding:12px;overflow:hidden}
article.err{border-color:#a33}img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:6px;background:#000}
h3{margin:10px 0 4px;font-size:15px}.meta{color:#999;margin:4px 0;font-size:12px}p{margin:4px 0;word-break:break-all}
.pill{padding:1px 7px;border-radius:99px;font-size:11px;color:#000}.high{background:#7ef29a}.medium{background:#ffd76e}.low{background:#bbb}.skip{background:#777}
details{margin-top:28px}summary{cursor:pointer}table{border-collapse:collapse;font-size:12px}td,th{padding:3px 8px;border-bottom:1px solid #262a33;text-align:left}
</style>
<h1>${esc(plan.site)}</h1>
<div class="sub">${manifest.stats.ok} ok · ${manifest.stats.failed} failed · ${manifest.stats.assets} assets · ${(manifest.stats.bytes / 1048576).toFixed(1)} MB · ${(manifest.stats.durationMs / 1000).toFixed(1)} s · ${esc(manifest.startedAt)}</div>
<div class="grid">${cards}</div>
<details><summary>${skipped.length} pages planned but not captured (lower priority / similar)</summary><table><tr><th>priority</th><th>score</th><th>url</th><th>similar to</th><th>reasons</th></tr>
${skipped.map((p) => `<tr><td>${p.priority}</td><td>${p.score}</td><td><a href="${esc(p.url)}">${esc(p.url)}</a></td><td>${esc(p.similarTo ?? "")}</td><td>${esc(p.reasons.join(" "))}</td></tr>`).join("\n")}
</table></details>`;
  await writeFile(path.join(outDir, "index.html"), html);
}
