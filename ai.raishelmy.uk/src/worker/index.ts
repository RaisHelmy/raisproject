import { Hono } from "hono";
import type { Env } from "./env";
import { v1 } from "./routes/v1";
import { admin } from "./routes/admin";
import { syncCosts } from "./sync";

const app = new Hono<{ Bindings: Env }>();

app.get("/healthz", (c) => c.json({ ok: true, gateway: c.env.AI_GATEWAY_ID }));
// Opportunistic cost reconciliation with Cloudflare's own figures (rate-limited inside syncCosts).
app.use("/api/overview", async (c, next) => {
  await next();
  if (c.res.status === 200) c.executionCtx.waitUntil(syncCosts(c.env).catch(() => undefined));
});
app.route("/v1", v1);
app.route("/api", admin);

app.notFound((c) => (c.req.path.startsWith("/api") || c.req.path.startsWith("/v1") ? c.json({ error: "not found" }, 404) : c.env.ASSETS.fetch(c.req.raw)));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { message: err.message, type: "api_error" } }, 500);
});

export default app;
