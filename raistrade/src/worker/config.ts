// moomoo OpenAPI connection settings. RaisTrade (a Cloudflare Worker) can't talk to moomoo OpenD
// directly, so the user runs OpenD + a small bridge (tools/moomoo-bridge/bridge.py, official
// futu-api SDK) on their own machine and exposes it over HTTPS (e.g. Cloudflare Tunnel).
// Stored here: the bridge URL and access token (AES-GCM encrypted, never returned), plus
// non-secret preferences. The moomoo login and trade password stay on the user's machine.

import type { Hono } from "hono";

type Env = { DB: D1Database; SESSION_SECRET: string; ADMIN_PASSWORD: string };
const KEY = "moomoo_config";

export interface MoomooConfig {
  bridge_url: string; token_enc: string | null; token_hint: string | null;
  trd_env: "SIMULATE" | "REAL"; market: "US" | "HK" | "MY" | "CN" | "SG"; security_firm: string; acc_id: string;
  opend_host: string; opend_port: number; enabled: boolean; last_test: { ok: boolean; at: number; summary: string } | null; updated_at: number;
}
const DEFAULTS: MoomooConfig = {
  bridge_url: "", token_enc: null, token_hint: null, trd_env: "SIMULATE", market: "US", security_firm: "FUTUMY", acc_id: "",
  opend_host: "127.0.0.1", opend_port: 11111, enabled: false, last_test: null, updated_at: 0,
};

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function aesKey(env: Env) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`moomoo-config:${env.SESSION_SECRET || env.ADMIN_PASSWORD}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(env: Env, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}
async function open(env: Env, sealed: string) {
  const [iv, ct] = sealed.split(".");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv!) }, await aesKey(env), unb64(ct!)));
}

async function load(db: D1Database): Promise<MoomooConfig> {
  const r = await db.prepare("SELECT value FROM settings WHERE key=?").bind(KEY).first<{ value: string }>();
  return { ...DEFAULTS, ...(r ? JSON.parse(r.value) : {}) };
}
async function save(db: D1Database, c: MoomooConfig) {
  c.updated_at = Date.now();
  await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(KEY, JSON.stringify(c), c.updated_at).run();
}
const publicView = (c: MoomooConfig) => { const { token_enc, ...rest } = c; return { ...rest, token_set: !!token_enc }; };

/** Calls the user's bridge with the stored token. */
export async function bridgeFetch(env: Env, path: string, init?: RequestInit) {
  const c = await load(env.DB);
  if (!c.bridge_url || !c.token_enc) throw new Error("moomoo bridge not configured");
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(c.bridge_url.replace(/\/$/, "") + path, { ...init, signal: ctl.signal, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${await open(env, c.token_enc)}`, "content-type": "application/json" } });
    const body = await r.text();
    let data: unknown = body; try { data = JSON.parse(body); } catch { /* text */ }
    return { status: r.status, ok: r.ok, data };
  } finally { clearTimeout(t); }
}

export function registerConfig(app: Hono<{ Bindings: Env }>) {
  app.get("/api/config/moomoo", async (c) => c.json({ ret: 0, data: publicView(await load(c.env.DB)) }));

  app.post("/api/config/moomoo", async (c) => {
    const b = await c.req.json<Partial<MoomooConfig> & { token?: string; clear_token?: boolean }>();
    const cur = await load(c.env.DB);
    if (b.bridge_url != null) {
      const u = b.bridge_url.trim();
      if (u && !/^https:\/\/[^\s/]+/.test(u)) return c.json({ ret: -1, msg: "Bridge URL must start with https:// (expose your bridge with a tunnel — never plain http over the internet)" }, 400);
      cur.bridge_url = u;
    }
    if (b.clear_token) { cur.token_enc = null; cur.token_hint = null; }
    else if (b.token) {
      if (b.token.length < 16) return c.json({ ret: -1, msg: "Access token must be at least 16 characters" }, 400);
      cur.token_enc = await seal(c.env, b.token); cur.token_hint = `••••${b.token.slice(-4)}`;
    }
    if (b.trd_env === "SIMULATE" || b.trd_env === "REAL") cur.trd_env = b.trd_env;
    if (b.market && ["US", "HK", "MY", "CN", "SG"].includes(b.market)) cur.market = b.market;
    if (b.security_firm) cur.security_firm = String(b.security_firm).replace(/[^A-Z]/g, "").slice(0, 20);
    if (b.acc_id != null) cur.acc_id = String(b.acc_id).replace(/[^0-9]/g, "").slice(0, 24);
    if (b.opend_host) cur.opend_host = String(b.opend_host).slice(0, 100);
    if (b.opend_port) cur.opend_port = Math.max(1, Math.min(65535, Number(b.opend_port)));
    if (b.enabled != null) cur.enabled = !!b.enabled;
    await save(c.env.DB, cur);
    return c.json({ ret: 0, data: publicView(cur) });
  });

  app.post("/api/config/moomoo/test", async (c) => {
    const cur = await load(c.env.DB);
    const steps: { step: string; ok: boolean; detail: string }[] = [];
    try {
      const h = await bridgeFetch(c.env, "/health");
      steps.push({ step: "Reach bridge", ok: h.ok, detail: h.ok ? "bridge responded" : `HTTP ${h.status}` });
      if (h.status === 401) steps.push({ step: "Access token", ok: false, detail: "bridge rejected the token" });
      const hd: any = h.data;
      if (h.ok) {
        steps.push({ step: "OpenD quote login", ok: !!hd?.qot_logined, detail: hd?.qot_logined ? "logged in" : "OpenD is not logged in to quotes" });
        steps.push({ step: "OpenD trade login", ok: !!hd?.trd_logined, detail: hd?.trd_logined ? "logged in" : "OpenD is not logged in to trading" });
        const a = await bridgeFetch(c.env, `/accounts?market=${cur.market}&firm=${cur.security_firm}`);
        const accs: any[] = (a.data as any)?.accounts ?? [];
        steps.push({ step: "Trading accounts", ok: a.ok && accs.length > 0, detail: a.ok ? `${accs.length} account(s): ${accs.map((x) => `${x.trd_env} ${String(x.acc_id).slice(-4).padStart(8, "•")}`).join(", ") || "none"}` : `HTTP ${a.status}` });
        if (cur.acc_id) steps.push({ step: "Selected account", ok: accs.some((x) => String(x.acc_id) === cur.acc_id), detail: accs.some((x) => String(x.acc_id) === cur.acc_id) ? "found" : "not in the list returned by OpenD" });
      }
    } catch (e) {
      steps.push({ step: "Reach bridge", ok: false, detail: (e as Error).name === "AbortError" ? "timed out after 9 s" : (e as Error).message });
    }
    const ok = steps.length > 0 && steps.every((s) => s.ok);
    cur.last_test = { ok, at: Date.now(), summary: steps.map((s) => `${s.ok ? "✓" : "✕"} ${s.step}`).join(" · ") };
    await save(c.env.DB, cur);
    return c.json({ ret: 0, ok, steps });
  });
}
