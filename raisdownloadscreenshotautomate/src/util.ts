import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

export const nowIso = () => new Date().toISOString();

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Normalize a URL for dedupe: strip hash, utm params, trailing slash, sort query. */
export function normalizeUrl(raw: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  u.hash = "";
  const keep = new URLSearchParams();
  [...u.searchParams.entries()]
    .filter(([k]) => !/^(utm_|ref$|fbclid|gclid|_ga)/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => keep.append(k, v));
  u.search = keep.toString() ? `?${keep}` : "";
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export function sameSite(a: string, b: string): boolean {
  const ha = hostOf(a), hb = hostOf(b);
  return ha === hb || ha.endsWith("." + hb) || hb.endsWith("." + ha);
}

export function slugify(s: string, max = 60): string {
  const out = s
    .toLowerCase()
    .replace(/https?:\/\/[^/]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return out || "root";
}

/** Turn /models/abc-123/edit into /models/:slug/edit for similarity grouping. */
export function templateOf(url: string): string {
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean).map((s) => {
    if (s.startsWith("@") || s.startsWith("~")) return ":user";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return ":uuid";
    if (/^\d+$/.test(s)) return ":num";
    if (/^[0-9a-f]{12,}$/i.test(s)) return ":hash";
    if (/^[a-z0-9]{16,}$/i.test(s) && /\d/.test(s)) return ":id";
    if (s.length > 24 && (s.match(/-/g) ?? []).length >= 3) return ":slug";
    return s;
  });
  const q = [...u.searchParams.keys()].sort().join(",");
  return "/" + segs.join("/") + (q ? `?${q}` : "");
}

export async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

export async function writeJson(p: string, data: unknown) {
  await ensureDir(path.dirname(p));
  await writeFile(p, JSON.stringify(data, null, 2));
}

export async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await readFile(p, "utf8")) as T;
}

export function log(msg: string, data?: Record<string, unknown>) {
  const t = new Date().toISOString().slice(11, 23);
  process.stderr.write(`[${t}] ${msg}${data ? " " + JSON.stringify(data) : ""}\n`);
}

export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function extOfContentType(ct: string, url: string): string {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (fromUrl && fromUrl.length <= 6) return fromUrl;
  const m: Record<string, string> = {
    "text/css": ".css", "application/javascript": ".js", "text/javascript": ".js",
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg",
    "image/gif": ".gif", "image/avif": ".avif", "font/woff2": ".woff2", "font/woff": ".woff",
    "application/font-woff2": ".woff2", "application/json": ".json", "video/mp4": ".mp4",
  };
  const key = ct.split(";")[0].trim().toLowerCase();
  return m[key] ?? "";
}
