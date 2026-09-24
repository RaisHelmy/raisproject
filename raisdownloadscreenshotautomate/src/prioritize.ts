import type { DiscoveredLink, Options, Plan, PlannedPage, ScanResult } from "./types.ts";
import { slugify, templateOf } from "./util.ts";

const BASE: Record<DiscoveredLink["source"], number> = {
  "main-nav": 100, "sub-nav": 85, sidebar: 90, "hero-cta": 70, footer: 35, body: 20,
};

const LEGAL = /(privacy|terms|cookie|legal|gdpr|dmca|imprint|impressum)/i;
const AUTH = /(\/login|\/signin|\/sign-in|\/signup|\/sign-up|\/register|\/logout|\/auth\b)/i;
const NOISE = /\.(pdf|zip|xml|txt|rss)$/i;

export function prioritize(scanRes: ScanResult, opts: Options): Plan {
  const byUrl = new Map<string, DiscoveredLink>();
  for (const l of scanRes.links) byUrl.set(l.url, l);
  if (!byUrl.has(scanRes.startUrl)) {
    byUrl.set(scanRes.startUrl, { url: scanRes.startUrl, text: "Home", source: "main-nav", depth: 0, order: -1 });
  }

  const scored: PlannedPage[] = [];
  for (const l of byUrl.values()) {
    const reasons: string[] = [`${l.source}:${BASE[l.source]}`];
    let score = BASE[l.source];
    if (l.url === scanRes.startUrl) { score += 50; reasons.push("start:+50"); }
    if (l.depth >= 3) { score -= (l.depth - 2) * 8; reasons.push(`depth${l.depth}:-${(l.depth - 2) * 8}`); }
    if (LEGAL.test(l.url)) { score -= 65; reasons.push("legal:-65"); }
    if (AUTH.test(l.url)) { score -= 25; reasons.push("auth:-25"); }
    if (NOISE.test(l.url)) { score -= 100; reasons.push("file:-100"); }
    if (new URL(l.url).search) { score -= 10; reasons.push("query:-10"); }
    if (!l.text) { score -= 25; reasons.push("nolabel:-25"); } // real menu items have a label; icon/avatar links do not
    scored.push({
      id: "", url: l.url, text: l.text, source: l.source, parent: l.parent,
      template: templateOf(l.url), score, priority: "low", reasons,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Similarity: same template -> keep the first N at full score, demote the rest.
  const seenTemplate = new Map<string, PlannedPage[]>();
  // Sibling groups: same parent path with many children (e.g. /blog/*) -> also demote.
  const seenParent = new Map<string, number>();
  for (const p of scored) {
    const group = seenTemplate.get(p.template) ?? [];
    const parentPath = p.template.split("/").slice(0, -1).join("/") || "/";
    const siblings = seenParent.get(parentPath) ?? 0;
    if (group.length >= opts.perTemplate) {
      p.similarTo = group[0].id || group[0].url;
      p.score = Math.min(p.score, 15);
      p.reasons.push(`similar-template:${p.template}`);
    } else if (siblings >= 6 && p.template.split("/").length > 2) {
      p.similarTo = undefined;
      p.score -= 30;
      p.reasons.push(`many-siblings:${parentPath}`);
    }
    group.push(p);
    seenTemplate.set(p.template, group);
    seenParent.set(parentPath, siblings + 1);
  }

  scored.sort((a, b) => b.score - a.score);
  const usedIds = new Set<string>();
  for (const p of scored) {
    let id = slugify(new URL(p.url).pathname + (new URL(p.url).search ? "-" + new URL(p.url).search : ""));
    let n = 2;
    while (usedIds.has(id)) id = `${id}-${n++}`;
    usedIds.add(id);
    p.id = id;
    p.priority = p.score >= 70 ? "high" : p.score >= 40 ? "medium" : p.score > 0 ? "low" : "skip";
  }
  for (const p of scored) if (p.similarTo && !p.similarTo.includes("://")) continue; else if (p.similarTo) {
    p.similarTo = scored.find((q) => q.url === p.similarTo)?.id ?? p.similarTo;
  }

  const stats = { total: scored.length, high: 0, medium: 0, low: 0, skip: 0 };
  for (const p of scored) stats[p.priority]++;
  return { site: scanRes.site, startUrl: scanRes.startUrl, plannedAt: new Date().toISOString(), pages: scored, stats };
}
