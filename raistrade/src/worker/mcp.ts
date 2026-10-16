// Public, read-only MCP server (Streamable HTTP, stateless JSON-RPC) at /mcp. It exposes the /ads
// showcase — copy, brand kit, recorded scene clips/screenshots, storyboard and deterministic chart
// data — so Claude (Code, Design or claude.ai) can build videos and designs of RaisTrade.
// No account data is exposed: everything here is already public on /ads.

import type { Hono } from "hono";
import { BRAND, DISCLAIMER, FEATURES, HERO } from "../shared/adsContent";
import { BY_CODE, INSTRUMENTS, KTYPES, klines } from "../shared/market";
import { TEMPLATES } from "../shared/strategies";
import { CATALOG } from "../shared/library";
import { BUNDLES } from "../shared/combos";
import { COMBOS, DETECTORS } from "../shared/risk";

type Env = { ASSETS: Fetcher };
const VERSION = "1.0.0";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface Scene { index: number; title: string; text: string; duration_ms: number }

// ChatGPT connectors / deep research require exactly these two tools (search → ids, fetch → document).
const searchTool = { name: "search", description: "Search the RaisTrade showcase (features, scenes, strategies, brand kit, ad copy). Returns matching document ids for `fetch`.", inputSchema: { type: "object", properties: { query: { type: "string", description: "What to look for, e.g. 'risk guard', 'brand colours', 'scene binary'" } }, required: ["query"] } };
const fetchTool = { name: "fetch", description: "Fetch a full RaisTrade showcase document by id (from `search`).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } };

export const tools = [
  { name: "get_app_overview", description: "What RaisTrade is: tagline, key numbers, feature list, public URLs (ads page, live demo, tour deep links). Start here.", inputSchema: { type: "object", properties: {} } },
  { name: "get_brand_kit", description: "Brand kit for designs/videos: name, wordmark, Inter font, light & dark colour tokens, gradient, logo SVG and visual style notes.", inputSchema: { type: "object", properties: {} } },
  { name: "get_ad_copy", description: "All marketing copy from the /ads landing page: hero pill, headline, lead, CTAs, features, disclaimer.", inputSchema: { type: "object", properties: {} } },
  { name: "list_scenes", description: "The 10 product-tour scenes (title, caption, duration) with URLs of recorded WebM clips (1280×800) and dark/light PNG screenshots, plus deep links that replay each scene live.", inputSchema: { type: "object", properties: {} } },
  { name: "get_scene_media", description: "Returns the screenshot of one tour scene as an image (plus its clip URL and caption).", inputSchema: { type: "object", properties: { scene: { type: "integer", minimum: 1, maximum: 10, description: "Scene number 1–10" }, theme: { type: "string", enum: ["dark", "light"], default: "dark" } }, required: ["scene"] } },
  { name: "get_video_storyboard", description: "A ready-to-use storyboard for a promo video (15s, 30s or 60s): shots with timing, on-screen caption, voice-over line, source clip and transition.", inputSchema: { type: "object", properties: { length_seconds: { type: "integer", enum: [15, 30, 60], default: 30 } } } },
  { name: "get_strategy_catalog", description: "The 100 strategy types (name, category, icon, description) plus catalogue/bundle/risk-guard counts — for animated lists and tickers.", inputSchema: { type: "object", properties: { category: { type: "string", description: "Optional category filter, e.g. Trend, Momentum, Pattern" } } } },
  searchTool, fetchTool,
  { name: "get_market_data", description: "Deterministic OHLCV candles from RaisTrade's simulated market (identical to what the app draws) — for animating charts in a video.", inputSchema: { type: "object", properties: { code: { type: "string", description: `Instrument, e.g. US.NVDA. One of: ${INSTRUMENTS.map((i) => i.code).join(", ")}` }, ktype: { type: "string", enum: Object.keys(KTYPES), default: "K_1M" }, bars: { type: "integer", minimum: 10, maximum: 500, default: 120 }, end: { type: "string", description: "Optional ISO time of the last candle (default: now)" } }, required: ["code"] } },
];

async function scenes(env: Env, origin: string): Promise<Scene[]> {
  const r = await env.ASSETS.fetch(new Request(`${origin}/ads-media/scenes.json`));
  return r.ok ? r.json() : [];
}
const pad = (n: number) => String(n).padStart(2, "0");
const media = (origin: string, i: number) => ({
  clip_webm: `${origin}/ads-media/scene-${pad(i)}.webm`,
  screenshot_dark: `${origin}/ads-media/scene-${pad(i)}-dark.png`,
  screenshot_light: `${origin}/ads-media/scene-${pad(i)}-light.png`,
  replay_live: `${origin}/?demo=1&tour=1&scene=${i - 1}`,
});

function storyboard(sc: Scene[], len: number, origin: string) {
  const pick = len === 15 ? [1, 4, 6, 10] : len === 30 ? [1, 2, 4, 6, 7, 8, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const intro = 2, outro = len === 15 ? 2.5 : 4, body = (len - intro - outro) / pick.length;
  let t = 0;
  const shots: object[] = [{ at: 0, duration: intro, type: "title", text: `${HERO.headline.join(" ")}`, visual: "Logo + wordmark on dark background, gradient sweep across 'prove themselves'", voiceover: "Trading robots that prove themselves first." }];
  t += intro;
  for (const i of pick) {
    const s = sc[i - 1];
    shots.push({ at: +t.toFixed(1), duration: +body.toFixed(1), type: "clip", scene: i, caption: s?.title, voiceover: s?.text, source: media(origin, i).clip_webm, transition: "quick zoom-in on the cursor, then cross-fade" });
    t += body;
  }
  shots.push({ at: +t.toFixed(1), duration: outro, type: "end card", text: "Try the live demo — no sign-up", url: `${origin}/ads`, visual: "Orange CTA button, logo, small disclaimer", disclaimer: DISCLAIMER });
  return { length_seconds: len, aspect: "16:10 source clips (1280×800); crop to 16:9 or 9:16 as needed", music: "upbeat, minimal electronic, ~110 bpm", shots };
}

export interface Doc { id: string; title: string; text: string; url: string; metadata?: Record<string, string> }

/** Every public showcase document, for search/fetch, llms.txt and the REST mirror. */
export async function documents(env: Env, origin: string): Promise<Doc[]> {
  const sc = await scenes(env, origin);
  return [
    { id: "overview", title: "RaisTrade overview", url: `${origin}/ads`, text: `${HERO.headline.join(" ")}\n\n${HERO.lead}\n\nMarkets: ${INSTRUMENTS.length} · strategy types: ${TEMPLATES.length} · rules in catalogue: ${CATALOG.size.toLocaleString()} · bundles: ${BUNDLES.length}\n\nLive demo (no sign-up): ${origin}/?demo=1\n\n${DISCLAIMER}` },
    { id: "brand-kit", title: "Brand kit (colours, font, logo)", url: `${origin}/ads`, text: JSON.stringify(BRAND, null, 2) },
    { id: "ad-copy", title: "Ad copy from the /ads page", url: `${origin}/ads`, text: JSON.stringify({ hero: HERO, features: FEATURES, disclaimer: DISCLAIMER }, null, 2) },
    ...FEATURES.map((f, i) => ({ id: `feature-${i + 1}`, title: `${f.icon} ${f.title}`, url: `${origin}/ads#features`, text: f.text })),
    ...sc.map((s) => ({ id: `scene-${s.index + 1}`, title: `Tour scene ${s.index + 1}: ${s.title}`, url: media(origin, s.index + 1).replay_live, text: `${s.text}\n\nClip: ${media(origin, s.index + 1).clip_webm}\nScreenshot (dark): ${media(origin, s.index + 1).screenshot_dark}\nScreenshot (light): ${media(origin, s.index + 1).screenshot_light}\nDuration: ${(s.duration_ms / 1000).toFixed(1)} s`, metadata: { kind: "scene" } })),
    { id: "strategies", title: `${TEMPLATES.length} strategy types`, url: `${origin}/ads`, text: TEMPLATES.map((t) => `${t.icon} ${t.name} (${t.category}) — ${t.description}`).join("\n") },
    { id: "risk-guards", title: "Crash guards (risk indicator)", url: `${origin}/ads`, text: [...DETECTORS.map((d) => `${d.icon} ${d.name}: ${d.desc}`), "", ...COMBOS.map((c) => `${c.icon} ${c.name} — ${c.scenario}: ${c.desc}`)].join("\n") },
  ];
}

export async function call(name: string, args: any, env: Env, origin: string): Promise<any> {
  const text = (o: unknown) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
  switch (name) {
    case "get_app_overview":
      return text({
        name: BRAND.name, tagline: HERO.headline.join(" "), summary: HERO.lead,
        numbers: { markets: INSTRUMENTS.length, strategy_types: TEMPLATES.length, rules_in_catalogue: CATALOG.size, bundles: BUNDLES.length, risk_detectors: DETECTORS.length, risk_combos: COMBOS.length },
        features: FEATURES, urls: { ads_page: `${origin}/ads`, live_demo: `${origin}/?demo=1`, autoplay_tour: `${origin}/?demo=1&tour=1`, media_folder: `${origin}/ads-media/` },
        notes: "Demo mode runs in the visitor's browser with seeded practice data and a pinned clock, so every replay looks the same. Use ?theme=light|dark on demo URLs.",
        disclaimer: DISCLAIMER,
      });
    case "get_brand_kit": return text(BRAND);
    case "get_ad_copy": return text({ hero: HERO, features: FEATURES, sections: ["Everything you need to trade smarter", "100 strategies, from classic to clever", "Ready to meet your first robot?"], disclaimer: DISCLAIMER });
    case "list_scenes": {
      const sc = await scenes(env, origin);
      return text({ resolution: "1280x800", fps: 25, scenes: sc.map((s) => ({ number: s.index + 1, title: s.title, caption: s.text, duration_s: +(s.duration_ms / 1000).toFixed(1), ...media(origin, s.index + 1) })),
        landing: { hero_dark: `${origin}/ads-media/ads-hero-dark.png`, full_page_dark: `${origin}/ads-media/ads-full-dark.png` } });
    }
    case "get_scene_media": {
      const n = Math.min(10, Math.max(1, Number(args?.scene) || 1)), theme = args?.theme === "light" ? "light" : "dark";
      const sc = (await scenes(env, origin))[n - 1], m = media(origin, n);
      const img = await env.ASSETS.fetch(new Request(theme === "light" ? m.screenshot_light : m.screenshot_dark));
      const b64 = img.ok ? btoa(Array.from(new Uint8Array(await img.arrayBuffer()), (c) => String.fromCharCode(c)).join("")) : null;
      return { content: [
        { type: "text", text: JSON.stringify({ scene: n, title: sc?.title, caption: sc?.text, ...m }, null, 2) },
        ...(b64 ? [{ type: "image", data: b64, mimeType: "image/png" }] : []),
      ] };
    }
    case "get_video_storyboard": return text(storyboard(await scenes(env, origin), [15, 30, 60].includes(Number(args?.length_seconds)) ? Number(args.length_seconds) : 30, origin));
    case "get_strategy_catalog": {
      const list = TEMPLATES.filter((t) => !args?.category || t.category.toLowerCase() === String(args.category).toLowerCase())
        .map((t) => ({ name: t.name, category: t.category, icon: t.icon, description: t.description }));
      return text({ count: list.length, catalogue_rules: CATALOG.size, bundles: BUNDLES.length, risk_combos: COMBOS.map((c) => `${c.icon} ${c.name}`), strategies: list });
    }
    case "search": {
      const q = String(args?.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const docs = await documents(env, origin);
      const scored = docs.map((d) => ({ d, s: q.reduce((n, w) => n + ((d.title + " " + d.text).toLowerCase().includes(w) ? 1 : 0), 0) }))
        .filter((x) => !q.length || x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
      return text({ results: scored.map(({ d }) => ({ id: d.id, title: d.title, url: d.url })) });
    }
    case "fetch": {
      const d = (await documents(env, origin)).find((x) => x.id === String(args?.id));
      return d ? text(d) : { isError: true, content: [{ type: "text", text: `Unknown id ${args?.id}` }] };
    }
    case "get_market_data": {
      const code = String(args?.code ?? ""), inst = BY_CODE[code];
      if (!inst) return { isError: true, content: [{ type: "text", text: `Unknown code. Use one of: ${INSTRUMENTS.map((i) => i.code).join(", ")}` }] };
      const ktype = KTYPES[args?.ktype] ? args.ktype : "K_1M", bars = Math.min(500, Math.max(10, Number(args?.bars) || 120));
      const end = args?.end ? Date.parse(args.end) : Date.now();
      const c = klines(code, ktype, bars, Number.isFinite(end) ? end : Date.now());
      return text({ code, name: inst.name, decimals: inst.decimals, ktype, columns: ["time_ms", "open", "high", "low", "close", "volume"], candles: c });
    }
  }
  return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
}

export function registerMcp(app: Hono<{ Bindings: Env }>) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id, authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
  app.options("/mcp", () => new Response(null, { headers: cors }));
  app.post("/mcp", async (c) => {
    const origin = new URL(c.req.url).origin;
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400, cors); }
    const handle = async (m: any) => {
      if (m?.id === undefined || m?.id === null) return null; // notification
      const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
      switch (m.method) {
        case "initialize":
          return ok({
            protocolVersion: PROTOCOLS.includes(m.params?.protocolVersion) ? m.params.protocolVersion : PROTOCOLS[0],
            capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
            serverInfo: { name: "raistrade-ads", title: "RaisTrade ads & showcase", version: VERSION },
            instructions: "Read-only access to the RaisTrade /ads showcase. Call get_app_overview first, then list_scenes / get_video_storyboard to plan a video, get_brand_kit for colours and fonts, and get_scene_media to see screens.",
          });
        case "ping": return ok({});
        case "tools/list": return ok({ tools });
        case "tools/call": return ok(await call(m.params?.name, m.params?.arguments ?? {}, c.env, origin));
        case "resources/list": return ok({ resources: [
          { uri: "raistrade://brand-kit", name: "Brand kit", mimeType: "application/json" },
          { uri: "raistrade://ad-copy", name: "Ad copy", mimeType: "application/json" },
          { uri: "raistrade://scenes", name: "Tour scenes & media", mimeType: "application/json" },
        ] });
        case "resources/read": {
          const map: Record<string, string> = { "raistrade://brand-kit": "get_brand_kit", "raistrade://ad-copy": "get_ad_copy", "raistrade://scenes": "list_scenes" };
          const tool = map[m.params?.uri];
          if (!tool) return { jsonrpc: "2.0", id: m.id, error: { code: -32002, message: "Resource not found" } };
          const r: any = await call(tool, {}, c.env, origin);
          return ok({ contents: [{ uri: m.params.uri, mimeType: "application/json", text: r.content[0].text }] });
        }
        default: return { jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } };
      }
    };
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(handle))).filter(Boolean);
      return out.length ? c.json(out, 200, cors) : new Response(null, { status: 202, headers: cors });
    }
    const out = await handle(body);
    return out ? c.json(out, 200, cors) : new Response(null, { status: 202, headers: cors });
  });
}
