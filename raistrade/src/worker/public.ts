// Public, LLM-friendly surfaces so ChatGPT, Gemini and any crawler can read RaisTrade without
// running JavaScript or speaking MCP:
//   GET /mcp (non-SSE)      → human/LLM guide to the MCP server (markdown or HTML)
//   GET /llms.txt, /ads.md  → the showcase as markdown
//   GET /mcp/openapi.json   → OpenAPI 3.1 for ChatGPT GPT Actions / Gemini function calling
//   GET|POST /mcp/call/:tool→ REST mirror of every MCP tool (same results as tools/call)
//   GET /ads                → the SPA shell with the full page content pre-rendered for crawlers

import type { Hono } from "hono";
import { BRAND, DISCLAIMER, FEATURES, HERO } from "../shared/adsContent";
import { INSTRUMENTS, KTYPES } from "../shared/market";
import { TEMPLATES } from "../shared/strategies";
import { CATALOG } from "../shared/library";
import { BUNDLES } from "../shared/combos";
import { call, documents, tools } from "./mcp";

type Env = { ASSETS: Fetcher };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function markdown(env: Env, origin: string) {
  const docs = await documents(env, origin);
  const scenes = docs.filter((d) => d.id.startsWith("scene-"));
  return `# ${BRAND.name} — ${HERO.headline.join(" ")}

${HERO.lead}

- Live demo (no sign-up, runs in the browser): ${origin}/?demo=1
- Auto-playing product tour: ${origin}/?demo=1&tour=1
- Landing page: ${origin}/ads
- MCP server (Streamable HTTP, no auth, read-only): ${origin}/mcp
- REST/OpenAPI mirror of the MCP tools: ${origin}/mcp/openapi.json

## Key numbers
- ${INSTRUMENTS.length} markets (US, HK and Bursa stocks, FX, crypto, gold, oil, S&P 500)
- ${TEMPLATES.length} strategy types · ${CATALOG.size.toLocaleString()} rules in the catalogue · ${BUNDLES.length} ready-made bundles

## Features
${FEATURES.map((f) => `- **${f.icon} ${f.title}** — ${f.text}`).join("\n")}

## Product tour (recorded clips, 1280×800)
${scenes.map((s) => `- **${s.title}** — ${s.text.split("\n")[0]}\n  - clip: ${s.text.match(/Clip: (\S+)/)?.[1]}\n  - screenshot: ${s.text.match(/\(dark\): (\S+)/)?.[1]}`).join("\n")}

## Brand
- Font: ${BRAND.font.family} · primary ${BRAND.colors.dark.primary} · background ${BRAND.colors.dark.background} · gradient ${BRAND.gradient}
- Style: ${BRAND.style}

---
${DISCLAIMER}
`;
}

function guide(origin: string) {
  return `# RaisTrade MCP server

This URL is a **Model Context Protocol** server (Streamable HTTP, stateless JSON-RPC 2.0 over POST).
It is public, needs no authentication, and is **read-only**: it exposes only the public /ads showcase
(copy, brand kit, recorded scene clips/screenshots, storyboard, strategy list, simulated chart data).
It cannot place trades or read any account.

## Connect
- **Claude Code**: \`claude mcp add --transport http raistrade ${origin}/mcp\`
- **Claude.ai / Claude Desktop**: Settings → Connectors → Add custom connector → \`${origin}/mcp\`
- **ChatGPT** (Developer mode or connectors): Settings → Connectors → Create → URL \`${origin}/mcp\`, authentication: none.
  Supports the \`search\` and \`fetch\` tools ChatGPT needs for connectors and deep research.
- **Gemini CLI**: in \`~/.gemini/settings.json\` → \`{"mcpServers":{"raistrade":{"httpUrl":"${origin}/mcp"}}}\`
- **Custom GPT Actions / Gemini function calling / any HTTP client**: import \`${origin}/mcp/openapi.json\`
  or call \`${origin}/mcp/call/<tool>?arg=value\`.
- **No tools at all?** Read \`${origin}/llms.txt\` (markdown).

## Tools
${tools.map((t) => `- \`${t.name}\` — ${t.description}`).join("\n")}

## Try it
\`\`\`
curl -s ${origin}/mcp -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_app_overview","arguments":{}}}'
curl -s '${origin}/mcp/call/search?query=risk'
\`\`\`
`;
}

function openapi(origin: string) {
  const paths: Record<string, unknown> = {};
  for (const t of tools) {
    const props = (t.inputSchema as any).properties ?? {}, req: string[] = (t.inputSchema as any).required ?? [];
    paths[`/mcp/call/${t.name}`] = {
      get: {
        operationId: t.name, summary: t.description.slice(0, 120), description: t.description,
        parameters: Object.entries(props).map(([name, schema]: [string, any]) => ({ name, in: "query", required: req.includes(name), description: schema.description, schema: { type: schema.type, enum: schema.enum, minimum: schema.minimum, maximum: schema.maximum, default: schema.default } })),
        responses: { 200: { description: "Tool result", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
      },
    };
  }
  return { openapi: "3.1.0", info: { title: "RaisTrade showcase API", version: "1.0.0", description: "Read-only REST mirror of the RaisTrade MCP server: public /ads showcase content for designs and videos. No authentication." }, servers: [{ url: origin }], paths };
}

/** Converts an MCP tool result into plain JSON for REST clients. */
function plain(r: any) {
  const out: any = {};
  for (const c of r.content ?? []) {
    if (c.type === "text") { try { Object.assign(out, JSON.parse(c.text)); } catch { out.text = c.text; } }
    if (c.type === "image") out.image_base64_png = c.data;
  }
  if (r.isError) out.error = true;
  return out;
}

export function registerPublic(app: Hono<{ Bindings: Env }>) {
  const cors = { "Access-Control-Allow-Origin": "*" };
  app.get("/mcp", (c) => {
    const origin = new URL(c.req.url).origin, accept = c.req.header("accept") ?? "";
    if (accept.includes("text/event-stream")) return new Response("SSE stream not offered — POST JSON-RPC requests instead.", { status: 405, headers: { ...cors, Allow: "POST" } });
    const md = guide(origin);
    if (accept.includes("text/html"))
      return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RaisTrade MCP server</title>
<style>body{font:16px/1.6 Inter,system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 16px;background:#09090b;color:#fafafa}pre{white-space:pre-wrap;background:#18181b;padding:16px;border-radius:12px;border:1px solid #27272a}a{color:#f97316}</style></head>
<body><pre>${esc(md)}</pre></body></html>`, 200, cors);
    return new Response(md, { headers: { ...cors, "content-type": "text/markdown; charset=utf-8" } });
  });
  app.get("/mcp/openapi.json", (c) => c.json(openapi(new URL(c.req.url).origin), 200, cors));
  const rest = async (c: any, args: Record<string, unknown>) => {
    const origin = new URL(c.req.url).origin, name = c.req.param("tool");
    if (!tools.some((t) => t.name === name)) return c.json({ error: `Unknown tool. Available: ${tools.map((t) => t.name).join(", ")}` }, 404, cors);
    for (const k of ["scene", "bars", "length_seconds"]) if (args[k] != null) args[k] = Number(args[k]);
    return c.json(plain(await call(name, args, c.env, origin)), 200, cors);
  };
  app.get("/mcp/call/:tool", (c) => rest(c, { ...c.req.query() }));
  app.post("/mcp/call/:tool", async (c) => rest(c, await c.req.json().catch(() => ({}))));
  app.get("/llms.txt", async (c) => new Response(await markdown(c.env, new URL(c.req.url).origin), { headers: { ...cors, "content-type": "text/markdown; charset=utf-8" } }));
  app.get("/ads.md", async (c) => new Response(await markdown(c.env, new URL(c.req.url).origin), { headers: { ...cors, "content-type": "text/markdown; charset=utf-8" } }));

  // /ads: same SPA, but with the content in the HTML so tools that don't run JavaScript can read it.
  app.get("/ads", async (c) => {
    const origin = new URL(c.req.url).origin;
    const shell = await (await c.env.ASSETS.fetch(new Request(`${origin}/index.html`))).text();
    const desc = esc(HERO.lead);
    const head = `<title>${BRAND.name} — ${esc(HERO.headline.join(" "))}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${BRAND.name} — ${esc(HERO.headline.join(" "))}" /><meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${origin}/ads-media/ads-hero-dark.png" /><meta property="og:url" content="${origin}/ads" /><meta name="twitter:card" content="summary_large_image" />
    <link rel="alternate" type="text/markdown" href="${origin}/llms.txt" />`;
    const body = `<main style="max-width:900px;margin:40px auto;padding:0 16px;font-family:Inter,system-ui,sans-serif">
      <h1>${esc(HERO.headline.join(" "))}</h1><p>${desc}</p>
      <p><a href="/?demo=1">Try the live demo</a> · <a href="/">Sign in</a> · <a href="/llms.txt">Markdown version</a> · <a href="/mcp">MCP server</a></p>
      <h2>Features</h2><ul>${FEATURES.map((f) => `<li><b>${esc(f.title)}</b> — ${esc(f.text)}</li>`).join("")}</ul>
      <h2>Numbers</h2><p>${INSTRUMENTS.length} markets · ${TEMPLATES.length} strategy types · ${CATALOG.size.toLocaleString()} rules · ${BUNDLES.length} bundles · ${Object.keys(KTYPES).length} timeframes</p>
      <p><small>${esc(DISCLAIMER)}</small></p></main>`;
    const html = shell.replace(/<title>.*?<\/title>/s, head).replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    return c.html(html);
  });
}
