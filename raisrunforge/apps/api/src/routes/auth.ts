import { Hono } from "hono";
import type { AuthContext } from "@runforge/shared";
import { newId } from "@runforge/shared";
import { ROLE_MAX_LEVEL } from "@runforge/domain";
import { getRunForge } from "../runforge-instance";
import { ok, fail } from "../response";
import { verifySsoToken } from "../sso";

/** Worker bindings this router reads. `SAAS_SSO_SECRET` is a wrangler secret — never committed. */
export type AuthEnv = {
  Bindings: {
    SAAS_SSO_SECRET?: string;
  };
};

export const authRoutes = new Hono<AuthEnv>();

/** Where the SSO bootstrap page sends the browser once the bearer token is stored. */
const SSO_WEB_APP_URL = "https://app.runforge.raishelmy.uk/";
/** localStorage key the web app (apps/web/src/api/client.ts) reads the bearer token from. */
const WEB_TOKEN_STORAGE_KEY = "runforge_token";
const WEB_DEMO_ROLE_STORAGE_KEY = "runforge_demo_role";

/**
 * Real email+password login (PasswordAuthProvider), for the one seeded user
 * with a real password credential (see packages/providers/src/demo/seed.ts).
 * On success, mints a real bearer token the same way any other MCP/API
 * token is created — there is no session/cookie infra in this app yet, so a
 * token is the credential the caller keeps and sends as
 * `Authorization: Bearer <token>` on every subsequent request.
 */
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as { email?: string; password?: string });
    if (!body.email || !body.password) {
      return c.json({ error: { code: "VALIDATION", message: "email and password are required" } }, 400);
    }
    const runforge = getRunForge();
    const ctx = await runforge.auth.authenticate({
      email: body.email,
      password: body.password,
      correlationId: newId("req"),
    });
    const { token } = await runforge.auth.createToken(ctx, {
      name: "Login session",
      level: ctx.maxLevel,
      role: ctx.role,
    });
    return ok(c, { token, role: ctx.role, organizationId: ctx.organizationId });
  } catch (err) {
    return fail(c, err);
  }
});

/**
 * Super-admin SSO from the suite landing page (https://saas.raishelmy.uk/admin).
 * `GET /api/auth/sso?token=<signed token>`: verifies the HMAC token, looks up
 * the seeded super-admin by email, mints a bearer token EXACTLY like
 * `POST /login` does, and — because this app keeps its credential in
 * localStorage rather than a cookie — returns a tiny HTML page that stores the
 * token where the web app reads it and then `location.replace()`s to the
 * dashboard. Protocol: see the suite's SSO_PROTOCOL (HMAC-SHA256, 90 s TTL).
 */
authRoutes.get("/sso", async (c) => {
  const text = (status: 400 | 401 | 403 | 503, message: string) =>
    c.text(message, status, { "Cache-Control": "no-store" });

  const secret = c.env?.SAAS_SSO_SECRET;
  if (!secret) return text(503, "SSO is not configured");

  const token = c.req.query("token");
  if (!token) return text(400, "Missing token");

  const verified = await verifySsoToken(token, secret);
  if (!verified) return text(401, "Invalid or expired SSO token");

  try {
    const runforge = getRunForge();
    // Same lookup PasswordAuthProvider does (email is not org-scoped here):
    // first active membership whose user matches the email wins.
    let ctx: AuthContext | undefined;
    const orgs = await runforge.store.organizations.list();
    for (const org of orgs) {
      const members = await runforge.store.members.list(org.id, {});
      for (const member of members) {
        const user = await runforge.store.users.get(member.userId);
        if (!user || user.email.toLowerCase() !== verified.email) continue;
        ctx = {
          actorType: member.role === "ai_agent" ? "ai" : "user",
          actorId: user.id,
          userId: user.id,
          organizationId: org.id,
          role: member.role,
          maxLevel: ROLE_MAX_LEVEL[member.role],
          correlationId: newId("req"),
          demo: false,
        };
        break;
      }
      if (ctx) break;
    }
    if (!ctx) return text(403, "No RunForge account for this user");

    const { token: bearer } = await runforge.auth.createToken(ctx, {
      name: "Login session",
      level: ctx.maxLevel,
      role: ctx.role,
    });

    const bootstrap = {
      key: WEB_TOKEN_STORAGE_KEY,
      token: bearer,
      role: ctx.role,
      organizationId: ctx.organizationId,
      clear: [WEB_DEMO_ROLE_STORAGE_KEY],
      redirect: SSO_WEB_APP_URL,
    };
    // JSON inside a <script> block: escape "<" so a value can never close the tag.
    const json = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in to RunForge…</title></head>
<body style="font-family:system-ui,sans-serif;background:#0b0f19;color:#e5e7eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>Signing in to RunForge…</p>
<script>
(function () {
  var b = ${json};
  try {
    localStorage.setItem(b.key, b.token);
    for (var i = 0; i < b.clear.length; i++) localStorage.removeItem(b.clear[i]);
  } catch (e) {}
  location.replace(b.redirect);
})();
</script>
</body></html>`;
    return c.html(html, 200, { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  } catch (err) {
    return fail(c, err);
  }
});
