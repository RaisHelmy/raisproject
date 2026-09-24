import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, EmailSettings, User } from "./types";
import { getDb } from "./db";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  generateApiToken,
  hashPassword,
  randomHex,
  SESSION_COOKIE,
  sessionCookie,
  sha256Hex,
  SSO_APP_ID,
  userFromApiToken,
  userFromSession,
  verifyPassword,
  verifySsoToken,
} from "./auth";
import { getEmailSettings, saveEmailSettings, sendEmail, verificationEmail } from "./email";
import { findInstrument, UNIVERSE } from "./instruments";
import { analyzeInstrument, registryForUi } from "./quant";
import { enqueueJob, processJobs, type JobRow } from "./jobs";
import { PROVIDER_REGISTRY, getProviderEntry, integrationStatus } from "./providers/registry";
import { syncConnection, syncDueConnections, type ConnectionRow } from "./sync";
import { toMYR } from "./fx";
import {
  ACHIEVEMENTS,
  addPoints,
  ensureReferralCode,
  evaluateAchievements,
  gatherMetrics,
  maskName,
  pointsRank,
  TIERS,
  tierFor,
  totalPoints,
} from "./gamify";

type Vars = { user: User; viaToken: boolean; tokenScopes: string[] };

const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

const isSecure = (url: string) => new URL(url).protocol === "https:";
const appOrigin = (url: string) => new URL(url).origin;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function issueVerification(env: Env, origin: string, user: { id: string; email: string; name: string }) {
  const token = randomHex(24);
  const expires = new Date(Date.now() + 24 * 3600_000).toISOString();
  await env.DB.prepare(
    "INSERT INTO email_tokens (token, user_id, purpose, expires_at) VALUES (?, ?, 'verify', ?)"
  )
    .bind(token, user.id, expires)
    .run();
  const mail = verificationEmail(origin, token, user.name);
  const result = await sendEmail(env, {
    to: user.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  // In dev mode (or on failure) hand the link back so signup is never a dead end.
  const devVerifyUrl = result.provider === "dev" || !result.ok ? mail.url : undefined;
  return { result, devVerifyUrl };
}

app.post("/auth/signup", async (c) => {
  const body = await c.req
    .json<{ name?: string; email?: string; password?: string; ref?: string }>()
    .catch(() => null);
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const refCode = body?.ref?.trim().toUpperCase() ?? "";

  if (!name) return c.json({ error: "Please tell us your name." }, 400);
  if (!EMAIL_RE.test(email)) return c.json({ error: "That email address doesn't look valid." }, 400);
  if (password.length < 8)
    return c.json({ error: "Password must be at least 8 characters." }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing)
    return c.json({ error: "An account with this email already exists. Try signing in instead." }, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const id = crypto.randomUUID();

  // The very first account becomes the administrator.
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  const role = (count?.n ?? 0) === 0 ? "admin" : "user";

  // Resolve the referral code (if any) — a bad code never blocks signup.
  let referrer: { id: string } | null = null;
  if (refCode) {
    referrer =
      (await c.env.DB.prepare("SELECT id FROM users WHERE referral_code = ?")
        .bind(refCode)
        .first<{ id: string }>()) ?? null;
  }

  await c.env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, role, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, email, name, hash, salt, role, referrer?.id ?? null)
    .run();

  await ensureReferralCode(c.env, id);
  if (referrer) {
    await addPoints(c.env, referrer.id, 200, "referral-joined");
    await addPoints(c.env, id, 100, "welcome-referred");
  }

  const { devVerifyUrl } = await issueVerification(c.env, appOrigin(c.req.url), { id, email, name });

  const token = await createSession(c.env, id);
  c.header("Set-Cookie", sessionCookie(token, isSecure(c.req.url)));
  return c.json({
    user: { id, email, name, role, email_verified: 0 },
    devVerifyUrl,
  });
});

app.post("/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  const row = await c.env.DB.prepare(
    "SELECT id, email, name, role, email_verified, password_hash, password_salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first<User & { password_hash: string; password_salt: string }>();

  if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) {
    return c.json({ error: "Email or password is incorrect." }, 401);
  }

  const token = await createSession(c.env, row.id);
  c.header("Set-Cookie", sessionCookie(token, isSecure(c.req.url)));
  const { password_hash, password_salt, ...user } = row;
  return c.json({ user });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await destroySession(c.env, token);
  c.header("Set-Cookie", clearSessionCookie(isSecure(c.req.url)));
  return c.json({ ok: true });
});

app.get("/auth/me", async (c) => {
  const user = await userFromSession(c.env, getCookie(c, SESSION_COOKIE));
  return c.json({ user });
});

/**
 * Suite super-admin SSO: saas.raishelmy.uk/admin mints a short-lived
 * HMAC-signed token and sends the browser here. On success this creates a
 * session exactly the way /auth/login does (same cookie) and redirects to
 * the admin dashboard. No password is ever involved; failures are terse
 * plain text (401/403), and a missing secret is a hard 503.
 */
app.get("/auth/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO is not configured.", 503);

  const token = c.req.query("token") ?? "";
  if (!token) return c.text("Missing token.", 401);

  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) return c.text("Invalid or expired SSO token.", 401);

  const row = await c.env.DB.prepare("SELECT id, role FROM users WHERE email = ?")
    .bind(verified.email)
    .first<{ id: string; role: string }>();
  if (!row) return c.text("No account for this email.", 403);
  if (row.role !== "admin") return c.text("Account is not an administrator.", 403);

  const session = await createSession(c.env, row.id);
  c.header("Set-Cookie", sessionCookie(session, isSecure(c.req.url)));
  return c.redirect("/system/admin", 302);
});

app.post("/auth/verify", async (c) => {
  const body = await c.req.json<{ token?: string }>().catch(() => null);
  const token = body?.token ?? "";
  const row = await c.env.DB.prepare(
    "SELECT user_id FROM email_tokens WHERE token = ? AND purpose = 'verify' AND expires_at::timestamptz > now()"
  )
    .bind(token)
    .first<{ user_id: string }>();
  if (!row) return c.json({ error: "This verification link is invalid or has expired." }, 400);

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(row.user_id),
    c.env.DB.prepare("DELETE FROM email_tokens WHERE token = ?").bind(token),
  ]);
  return c.json({ ok: true });
});

// Replaces the Workers Cron Trigger (moved to Ubuntu cron). Same jobs
// scheduled() used to run — must come before the auth gate below since this
// is called by a cron job, not a signed-in user.
app.post("/internal/cron", async (c) => {
  if (c.req.header("X-Cron-Secret") !== c.env.CRON_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const env = withDb(c.env);
  const processed = await processJobs(env);
  await syncDueConnections(env);
  return c.json({ ok: true, processed });
});

/* ---------- everything below requires a signed-in user ---------- */

app.use("*", async (c, next) => {
  // Interactive sessions (cookie) and programmatic access (Bearer token)
  // share the same routes; tokens carry scopes, sessions carry all rights.
  const user = await userFromSession(c.env, getCookie(c, SESSION_COOKIE));
  if (user) {
    c.set("user", user);
    c.set("viaToken", false);
    c.set("tokenScopes", []);
    return next();
  }
  const tokenAuth = await userFromApiToken(c.env, c.req.header("Authorization"));
  if (tokenAuth) {
    c.set("user", tokenAuth.user);
    c.set("viaToken", true);
    c.set("tokenScopes", tokenAuth.scopes);
    return next();
  }
  return c.json({ error: "Not signed in. Use a session or an API token (Authorization: Bearer rfk_…)." }, 401);
});

/** Scope gate for token-authenticated calls; sessions always pass. */
function requireScope(c: { get: (k: "viaToken" | "tokenScopes") => unknown }, scope: string): string | null {
  if (!c.get("viaToken")) return null;
  const scopes = c.get("tokenScopes") as string[];
  if (scopes.includes(scope)) return null;
  return `This API token lacks the '${scope}' scope. Create a token with the scope in Security → API Access.`;
}

/* ------------------------------------------------------------------ */
/* API tokens — managed from an interactive session only               */
/* ------------------------------------------------------------------ */

app.use("/tokens/*", async (c, next) => {
  if (c.get("viaToken"))
    return c.json({ error: "API tokens cannot manage tokens. Sign in to the app instead." }, 403);
  await next();
});
app.use("/tokens", async (c, next) => {
  if (c.get("viaToken"))
    return c.json({ error: "API tokens cannot manage tokens. Sign in to the app instead." }, 403);
  await next();
});

app.get("/tokens", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, prefix, scopes, last_used_at, created_at FROM api_tokens WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC"
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ tokens: results });
});

app.post("/tokens", async (c) => {
  const body = await c.req.json<{ name?: string; scopes?: string[] }>().catch(() => null);
  const name = body?.name?.trim() || "API token";
  const requested = Array.isArray(body?.scopes) ? body!.scopes! : ["read"];
  const scopes = requested.filter((s) => ["read", "trade"].includes(s));
  if (scopes.length === 0) scopes.push("read");
  if (scopes.includes("trade") && !scopes.includes("read")) scopes.unshift("read");

  const { token, prefix } = generateApiToken();
  const hash = await sha256Hex(token);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, scopes) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, c.get("user").id, name, hash, prefix, scopes.join(","))
    .run();
  // The plaintext token is returned exactly once and never stored.
  return c.json({ id, name, prefix, scopes, token });
});

app.delete("/tokens/:id", async (c) => {
  const res = await c.env.DB.prepare(
    "UPDATE api_tokens SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0"
  )
    .bind(c.req.param("id"), c.get("user").id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Token not found." }, 404);
  return c.json({ ok: true });
});

app.post("/auth/resend-verification", async (c) => {
  const user = c.get("user");
  if (user.email_verified) return c.json({ ok: true, alreadyVerified: true });
  const { result, devVerifyUrl } = await issueVerification(c.env, appOrigin(c.req.url), user);
  return c.json({ ok: result.ok, devVerifyUrl, error: result.error });
});

/* ------------------------------------------------------------------ */
/* Guidance state (per-user journey persistence)                       */
/* ------------------------------------------------------------------ */

app.get("/guidance", async (c) => {
  const row = await c.env.DB.prepare("SELECT data FROM guidance WHERE user_id = ?")
    .bind(c.get("user").id)
    .first<{ data: string }>();
  return c.json({ data: row ? JSON.parse(row.data) : null });
});

app.put("/guidance", async (c) => {
  if (c.get("viaToken")) return c.json({ error: "Journey state is managed in the app, not over API tokens." }, 403);
  const data = await c.req.json().catch(() => null);
  if (!data || typeof data !== "object") return c.json({ error: "Invalid guidance payload." }, 400);
  await c.env.DB.prepare(
    `INSERT INTO guidance (user_id, data, updated_at) VALUES (?, ?, now())
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(c.get("user").id, JSON.stringify(data))
    .run();
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Markets & quant engine                                              */
/* ------------------------------------------------------------------ */

/** Every instrument, run through the full algorithm library, with flags. */
app.get("/instruments", (c) => {
  return c.json({ instruments: UNIVERSE.map(analyzeInstrument) });
});

app.get("/instruments/:symbol", (c) => {
  const inst = findInstrument(c.req.param("symbol"));
  if (!inst) return c.json({ error: "Unknown instrument." }, 404);
  return c.json({ analysis: analyzeInstrument(inst) });
});

/** The technique → method → algorithm registry and decision library. */
app.get("/robo/registry", (c) => c.json(registryForUi()));

/* ------------------------------------------------------------------ */
/* Investment queue — jobs processed by the worker                     */
/* ------------------------------------------------------------------ */

app.get("/jobs", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, type, payload, status, result, error, attempts, created_at, finished_at FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  )
    .bind(c.get("user").id)
    .all<JobRow>();
  return c.json({ jobs: results });
});

app.get("/jobs/:id", async (c) => {
  const job = await c.env.DB.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), c.get("user").id)
    .first<JobRow>();
  if (!job) return c.json({ error: "Job not found." }, 404);
  return c.json({ job });
});

app.post("/jobs/process", async (c) => {
  const processed = await processJobs(c.env);
  return c.json({ ok: true, processed });
});

/** Queue an analysis run — one symbol, or the full universe when omitted. */
app.post("/robo/analyze", async (c) => {
  const body = await c.req.json<{ symbol?: string }>().catch(() => ({}) as { symbol?: string });
  if (body.symbol && !findInstrument(body.symbol))
    return c.json({ error: "Unknown instrument." }, 400);
  const id = await enqueueJob(c.env, c.get("user").id, "analysis", { symbol: body.symbol ?? null });
  c.executionCtx.waitUntil(processJobs(c.env));
  return c.json({ ok: true, jobId: id });
});

/** Queue a robo order. Live mode requires live trading to be enabled. */
app.post("/robo/orders", async (c) => {
  const body = await c.req
    .json<{ symbol?: string; side?: string; amount?: number; mode?: string }>()
    .catch(() => null);
  if (!body) return c.json({ error: "Invalid order payload." }, 400);

  const inst = body.symbol ? findInstrument(body.symbol) : undefined;
  if (!inst) return c.json({ error: "Choose a valid instrument." }, 400);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return c.json({ error: "Order amount must be a positive number." }, 400);
  const side = body.side === "sell" ? "sell" : "buy";
  const mode = body.mode === "live" ? "live" : "paper";

  if (mode === "live") {
    const g = await c.env.DB.prepare("SELECT data FROM guidance WHERE user_id = ?")
      .bind(c.get("user").id)
      .first<{ data: string }>();
    const enabled = g ? !!JSON.parse(g.data).liveTradingEnabled : false;
    if (!enabled)
      return c.json(
        { error: "Live trading is not enabled. Enable it in Robo Trading first — paper orders are always available." },
        403
      );
  }

  const scopeErr = requireScope(c, "trade");
  if (scopeErr) return c.json({ error: scopeErr }, 403);

  const id = await enqueueJob(c.env, c.get("user").id, "order", {
    symbol: inst.symbol,
    side,
    amount,
    mode,
  });
  c.executionCtx.waitUntil(processJobs(c.env));
  return c.json({ ok: true, jobId: id });
});

/* ------------------------------------------------------------------ */
/* Documents — metadata in D1, file bodies in R2                       */
/* ------------------------------------------------------------------ */

const MAX_UPLOAD = 15 * 1024 * 1024; // 15 MB

// The family document vault is deliberately session-only.
app.use("/documents/*", async (c, next) => {
  if (c.get("viaToken")) return c.json({ error: "Documents are not accessible over API tokens." }, 403);
  await next();
});
app.use("/documents", async (c, next) => {
  if (c.get("viaToken")) return c.json({ error: "Documents are not accessible over API tokens." }, 403);
  await next();
});

app.get("/documents", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, category, size, content_type, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ documents: results });
});

app.post("/documents", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  const category = String(form?.get("category") ?? "general");
  if (!(file instanceof File)) return c.json({ error: "No file was provided." }, 400);
  if (file.size === 0) return c.json({ error: "The selected file is empty." }, 400);
  if (file.size > MAX_UPLOAD)
    return c.json({ error: "Files are limited to 15 MB. Your data was not changed." }, 413);

  const user = c.get("user");
  const id = crypto.randomUUID();
  const r2Key = `documents/${user.id}/${id}/${file.name}`;

  await c.env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  await c.env.DB.prepare(
    "INSERT INTO documents (id, user_id, name, category, size, content_type, r2_key) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, user.id, file.name, category, file.size, file.type || "application/octet-stream", r2Key)
    .run();

  return c.json({
    document: { id, name: file.name, category, size: file.size, content_type: file.type },
  });
});

app.get("/documents/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT r2_key, name, content_type FROM documents WHERE id = ? AND user_id = ?"
  )
    .bind(c.req.param("id"), c.get("user").id)
    .first<{ r2_key: string; name: string; content_type: string }>();
  if (!row) return c.json({ error: "Document not found." }, 404);

  const obj = await c.env.FILES.get(row.r2_key);
  if (!obj) return c.json({ error: "The stored file could not be found." }, 404);

  return new Response(obj.body as ReadableStream, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Disposition": `attachment; filename="${row.name.replace(/"/g, "")}"`,
    },
  });
});

app.delete("/documents/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT r2_key FROM documents WHERE id = ? AND user_id = ?"
  )
    .bind(c.req.param("id"), c.get("user").id)
    .first<{ r2_key: string }>();
  if (!row) return c.json({ error: "Document not found." }, 404);

  await c.env.FILES.delete(row.r2_key);
  await c.env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Investments — providers, connections, consolidated portfolio        */
/* ------------------------------------------------------------------ */

interface AffiliateRow {
  provider_id: string;
  country: string;
  affiliate_url: string;
  terms_url: string | null;
  disclosure_text: string | null;
}

async function resolveAffiliate(env: Env, providerId: string, country: string) {
  const { results } = await env.DB.prepare(
    `SELECT provider_id, country, affiliate_url, terms_url, disclosure_text
     FROM investment_affiliates
     WHERE provider_id = ? AND active = 1
       AND (country = ? OR country = '*')
       AND (start_date IS NULL OR start_date <= date('now'))
       AND (end_date IS NULL OR end_date >= date('now'))`
  )
    .bind(providerId, country)
    .all<AffiliateRow>();
  // Country-specific rows win over the '*' fallback.
  return results.find((r) => r.country === country) ?? results.find((r) => r.country === "*") ?? null;
}

/** Provider metadata for the frontend — the only place React learns about
 * providers, capabilities, integration status and affiliate destinations. */
app.get("/investments/providers", async (c) => {
  const country = (c.req.query("country") ?? "MY").toUpperCase();
  const providers = await Promise.all(
    PROVIDER_REGISTRY.map(async (entry) => {
      const status = integrationStatus(entry, c.env);
      const aff = entry.metadata.capabilities.affiliate || entry.metadata.capabilities.referral
        ? await resolveAffiliate(c.env, entry.metadata.id, country)
        : null;
      return {
        id: entry.metadata.id,
        name: entry.metadata.name,
        tagline: entry.metadata.tagline,
        instruments: entry.metadata.instruments,
        regions: entry.metadata.regions,
        capabilities: entry.metadata.capabilities,
        integrationStatus: status,
        connectable: status === "implemented",
        affiliate: aff
          ? {
              available: true,
              registrationUrl: aff.affiliate_url,
              termsUrl: aff.terms_url,
              disclosure:
                aff.disclosure_text ??
                "Rais Fintech may receive a referral or affiliate benefit if you open an account through this link. This does not affect the broker's services or fees.",
            }
          : { available: false },
      };
    })
  );
  return c.json({ providers });
});

/** Backward-compat: users who connected Moomoo before the multi-broker
 * schema existed (guidance flag only) get a connection row transparently —
 * no reconnect required. */
async function backfillLegacyMoomoo(env: Env, userId: string): Promise<boolean> {
  const existing = await env.DB.prepare(
    "SELECT id FROM investment_connections WHERE user_id = ? AND provider_id = 'moomoo'"
  )
    .bind(userId)
    .first();
  if (existing) return false;
  const g = await env.DB.prepare("SELECT data FROM guidance WHERE user_id = ?")
    .bind(userId)
    .first<{ data: string }>();
  let legacy = false;
  try {
    legacy = g ? !!JSON.parse(g.data).brokerageConnected : false;
  } catch { /* unreadable guidance → nothing to migrate */ }
  if (!legacy) return false;

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO investment_connections (id, user_id, provider_id, status, environment, label) VALUES (?, ?, 'moomoo', 'connected', 'live', 'Moomoo (migrated)')"
  )
    .bind(id, userId)
    .run();
  const conn = await env.DB.prepare("SELECT * FROM investment_connections WHERE id = ?")
    .bind(id)
    .first<ConnectionRow>();
  if (conn) await syncConnection(env, conn);
  return true;
}

app.get("/investments/connections", async (c) => {
  const user = c.get("user");
  await backfillLegacyMoomoo(c.env, user.id);
  const { results } = await c.env.DB.prepare(
    "SELECT id, provider_id, status, environment, label, sync_interval_min, last_sync_at, last_sync_status, created_at FROM investment_connections WHERE user_id = ? ORDER BY created_at ASC"
  )
    .bind(user.id)
    .all();
  return c.json({ connections: results });
});

app.post("/investments/connections/:provider/connect", async (c) => {
  if (c.get("viaToken"))
    return c.json({ error: "Creating connections requires the app — API tokens can read and sync only." }, 403);
  const user = c.get("user");
  const providerId = c.req.param("provider");
  const entry = getProviderEntry(providerId);
  if (!entry) return c.json({ error: "Unknown provider." }, 404);

  const status = integrationStatus(entry, c.env);
  if (status !== "implemented") {
    return c.json(
      {
        error: `${entry.metadata.name} integration is ${status === "coming_soon" ? "coming soon" : "not live yet"}. Your interest is noted — no connection was created.`,
        integrationStatus: status,
      },
      409
    );
  }

  const body = await c.req
    .json<{ environment?: string; label?: string; syncIntervalMin?: number }>()
    .catch(() => ({}) as { environment?: string; label?: string; syncIntervalMin?: number });
  const interval = Math.min(1440, Math.max(5, Number(body.syncIntervalMin) || 15));
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO investment_connections (id, user_id, provider_id, status, environment, label, sync_interval_min) VALUES (?, ?, ?, 'connected', ?, ?, ?)"
  )
    .bind(id, user.id, providerId, body.environment === "paper" ? "paper" : "live", body.label ?? null, interval)
    .run();

  const conn = await c.env.DB.prepare("SELECT * FROM investment_connections WHERE id = ?")
    .bind(id)
    .first<ConnectionRow>();
  if (conn) await syncConnection(c.env, conn);

  const fresh = await c.env.DB.prepare(
    "SELECT id, provider_id, status, environment, label, last_sync_at FROM investment_connections WHERE id = ?"
  )
    .bind(id)
    .first();
  return c.json({ connection: fresh });
});

async function userConnection(c: { env: Env }, id: string, userId: string) {
  return c.env.DB.prepare("SELECT * FROM investment_connections WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<ConnectionRow>();
}

app.post("/investments/connections/:id/sync", async (c) => {
  const conn = await userConnection(c, c.req.param("id"), c.get("user").id);
  if (!conn) return c.json({ error: "Connection not found." }, 404);
  await syncConnection(c.env, conn);
  const fresh = await userConnection(c, conn.id, conn.user_id);
  return c.json({ connection: fresh });
});

app.post("/investments/connections/:id/reconnect", async (c) => {
  const conn = await userConnection(c, c.req.param("id"), c.get("user").id);
  if (!conn) return c.json({ error: "Connection not found." }, 404);
  await c.env.DB.prepare("UPDATE investment_connections SET status = 'connected' WHERE id = ?")
    .bind(conn.id)
    .run();
  await syncConnection(c.env, { ...conn, status: "connected" });
  const fresh = await userConnection(c, conn.id, conn.user_id);
  return c.json({ connection: fresh });
});

app.delete("/investments/connections/:id", async (c) => {
  if (c.get("viaToken"))
    return c.json({ error: "Removing connections requires the app — API tokens can read and sync only." }, 403);
  const conn = await userConnection(c, c.req.param("id"), c.get("user").id);
  if (!conn) return c.json({ error: "Connection not found." }, 404);
  // Children first — do not rely on FK cascade behavior.
  const { results: accts } = await c.env.DB.prepare(
    "SELECT id FROM investment_accounts WHERE connection_id = ?"
  )
    .bind(conn.id)
    .all<{ id: string }>();
  const stmts = accts.flatMap((a) => [
    c.env.DB.prepare("DELETE FROM investment_holdings WHERE account_id = ?").bind(a.id),
    c.env.DB.prepare("DELETE FROM investment_transactions WHERE account_id = ?").bind(a.id),
    c.env.DB.prepare("DELETE FROM investment_dividends WHERE account_id = ?").bind(a.id),
    c.env.DB.prepare("DELETE FROM investment_orders WHERE account_id = ?").bind(a.id),
  ]);
  stmts.push(
    c.env.DB.prepare("DELETE FROM investment_accounts WHERE connection_id = ?").bind(conn.id),
    c.env.DB.prepare("DELETE FROM investment_sync_logs WHERE connection_id = ?").bind(conn.id),
    c.env.DB.prepare("DELETE FROM investment_connections WHERE id = ?").bind(conn.id)
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

/** Resolve ?accountId= / ?providerId= into the account rows in scope. */
async function accountsInScope(c: { env: Env; req: { query: (k: string) => string | undefined } }, userId: string) {
  const accountId = c.req.query("accountId");
  const providerId = c.req.query("providerId");
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.name, a.type, a.currency, a.cash_balance, a.provider_account_id,
            k.provider_id, k.id AS connection_id, k.status AS connection_status
     FROM investment_accounts a JOIN investment_connections k ON k.id = a.connection_id
     WHERE a.user_id = ? ORDER BY a.created_at ASC`
  )
    .bind(userId)
    .all<{
      id: string; name: string; type: string; currency: string; cash_balance: number;
      provider_account_id: string; provider_id: string; connection_id: string; connection_status: string;
    }>();
  return results.filter(
    (a) =>
      (!accountId || accountId === "all" || a.id === accountId) &&
      (!providerId || a.provider_id === providerId)
  );
}

app.get("/investments/accounts", async (c) => {
  const accounts = await accountsInScope(c, c.get("user").id);
  return c.json({ accounts });
});

app.get("/investments/portfolio", async (c) => {
  const user = c.get("user");
  const accounts = await accountsInScope(c, user.id);
  if (accounts.length === 0) return c.json({ empty: true, totalMYR: 0, byProvider: [], holdings: [] });

  const ids = accounts.map((a) => a.id);
  const placeholders = ids.map(() => "?").join(",");
  const { results: holdings } = await c.env.DB.prepare(
    `SELECT * FROM investment_holdings WHERE account_id IN (${placeholders}) ORDER BY symbol ASC`
  )
    .bind(...ids)
    .all<{
      account_id: string; symbol: string; name: string; quantity: number; avg_cost: number | null;
      last_price: number; currency: string; market_value: number; asset_class: string | null; shariah_status: string | null;
    }>();

  const acctById = new Map(accounts.map((a) => [a.id, a]));
  let totalMYR = 0;
  const byProvider = new Map<string, number>();
  const byAccount = new Map<string, number>();

  for (const a of accounts) {
    const cash = toMYR(a.cash_balance, a.currency);
    totalMYR += cash;
    byProvider.set(a.provider_id, (byProvider.get(a.provider_id) ?? 0) + cash);
    byAccount.set(a.id, (byAccount.get(a.id) ?? 0) + cash);
  }

  // Consolidate identical securities held at different brokers/accounts.
  const merged = new Map<
    string,
    {
      symbol: string; name: string; totalQuantity: number; valueMYR: number;
      assetClass: string | null; shariahStatus: string | null; gainPct: number | null;
      accounts: { accountId: string; accountName: string; providerId: string; quantity: number; valueMYR: number }[];
    }
  >();

  for (const h of holdings) {
    const acct = acctById.get(h.account_id)!;
    const valueMYR = toMYR(h.market_value, h.currency);
    totalMYR += valueMYR;
    byProvider.set(acct.provider_id, (byProvider.get(acct.provider_id) ?? 0) + valueMYR);
    byAccount.set(acct.id, (byAccount.get(acct.id) ?? 0) + valueMYR);

    const m = merged.get(h.symbol) ?? {
      symbol: h.symbol,
      name: h.name,
      totalQuantity: 0,
      valueMYR: 0,
      assetClass: h.asset_class,
      shariahStatus: h.shariah_status,
      gainPct: null,
      accounts: [],
    };
    m.totalQuantity += h.quantity;
    m.valueMYR += valueMYR;
    if (h.avg_cost) m.gainPct = +(((h.last_price - h.avg_cost) / h.avg_cost) * 100).toFixed(1);
    m.accounts.push({
      accountId: acct.id,
      accountName: acct.name,
      providerId: acct.provider_id,
      quantity: h.quantity,
      valueMYR: +valueMYR.toFixed(2),
    });
    merged.set(h.symbol, m);
  }

  return c.json({
    empty: false,
    totalMYR: +totalMYR.toFixed(2),
    currency: "MYR",
    byProvider: [...byProvider.entries()].map(([providerId, valueMYR]) => ({
      providerId,
      valueMYR: +valueMYR.toFixed(2),
    })),
    byAccount: [...byAccount.entries()].map(([accountId, valueMYR]) => ({
      accountId,
      name: acctById.get(accountId)?.name,
      providerId: acctById.get(accountId)?.provider_id,
      valueMYR: +valueMYR.toFixed(2),
    })),
    holdings: [...merged.values()]
      .map((m) => ({ ...m, valueMYR: +m.valueMYR.toFixed(2) }))
      .sort((a, b) => b.valueMYR - a.valueMYR),
  });
});

app.get("/investments/holdings", async (c) => {
  const accounts = await accountsInScope(c, c.get("user").id);
  if (accounts.length === 0) return c.json({ holdings: [] });
  const ids = accounts.map((a) => a.id);
  const { results } = await c.env.DB.prepare(
    `SELECT h.*, a.name AS account_name, k.provider_id
     FROM investment_holdings h
     JOIN investment_accounts a ON a.id = h.account_id
     JOIN investment_connections k ON k.id = a.connection_id
     WHERE h.account_id IN (${ids.map(() => "?").join(",")})
     ORDER BY h.market_value DESC`
  )
    .bind(...ids)
    .all();
  return c.json({ holdings: results });
});

app.get("/investments/transactions", async (c) => {
  const accounts = await accountsInScope(c, c.get("user").id);
  if (accounts.length === 0) return c.json({ transactions: [] });
  const ids = accounts.map((a) => a.id);
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, a.name AS account_name, k.provider_id
     FROM investment_transactions t
     JOIN investment_accounts a ON a.id = t.account_id
     JOIN investment_connections k ON k.id = a.connection_id
     WHERE t.account_id IN (${ids.map(() => "?").join(",")})
     ORDER BY t.occurred_at DESC LIMIT 200`
  )
    .bind(...ids)
    .all();
  return c.json({ transactions: results });
});

app.get("/investments/dividends", async (c) => {
  const accounts = await accountsInScope(c, c.get("user").id);
  if (accounts.length === 0) return c.json({ dividends: [] });
  const ids = accounts.map((a) => a.id);
  const { results } = await c.env.DB.prepare(
    `SELECT d.*, a.name AS account_name, k.provider_id
     FROM investment_dividends d
     JOIN investment_accounts a ON a.id = d.account_id
     JOIN investment_connections k ON k.id = a.connection_id
     WHERE d.account_id IN (${ids.map(() => "?").join(",")})
     ORDER BY d.pay_date DESC LIMIT 200`
  )
    .bind(...ids)
    .all();
  return c.json({ dividends: results });
});

/** Robo orders from the investment queue, presented in the investment view. */
app.get("/investments/orders", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, payload, result, status, created_at FROM jobs WHERE user_id = ? AND type = 'order' ORDER BY created_at DESC LIMIT 100"
  )
    .bind(c.get("user").id)
    .all<{ id: string; payload: string; result: string | null; status: string; created_at: string }>();
  const orders = results.map((r) => {
    const p = JSON.parse(r.payload);
    const res = r.result ? JSON.parse(r.result) : null;
    return {
      id: r.id,
      providerId: "moomoo",
      symbol: p.symbol,
      side: p.side,
      amount: p.amount,
      mode: p.mode,
      status: r.status === "done" ? (res?.status ?? "filled") : r.status,
      fillPrice: res?.fillPrice ?? null,
      quantity: res?.quantity ?? null,
      placedAt: r.created_at,
    };
  });
  return c.json({ orders });
});

/* ------------------------------------------------------------------ */
/* Suggestions — users propose, admins decide                          */
/* ------------------------------------------------------------------ */

app.post("/suggestions", async (c) => {
  const b = await c.req
    .json<{ context?: string; title?: string; description?: string }>()
    .catch(() => null);
  const title = b?.title?.trim() ?? "";
  const description = b?.description?.trim() ?? "";
  if (!title) return c.json({ error: "Give your suggestion a short title." }, 400);
  if (description.length < 10)
    return c.json({ error: "Describe your idea in a sentence or two so the team can act on it." }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO suggestions (id, user_id, context, title, description) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, c.get("user").id, (b?.context ?? "general").slice(0, 60), title.slice(0, 140), description.slice(0, 2000))
    .run();
  return c.json({ ok: true, id });
});

/** The user's own suggestions, with status and any admin note. */
app.get("/suggestions", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, context, title, description, status, admin_note, created_at, decided_at FROM suggestions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ suggestions: results });
});

/* ------------------------------------------------------------------ */
/* Theory Gallery — admin-curated, read by everyone                    */
/* ------------------------------------------------------------------ */

app.get("/theories", async (c) => {
  const wantAll = c.req.query("all") === "1" && c.get("user").role === "admin";
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, category, summary, content, when_to_use, risk_notes, source, related_technique, published, updated_at
     FROM theories ${wantAll ? "" : "WHERE published = 1"}
     ORDER BY category ASC, title ASC`
  ).all();
  return c.json({ theories: results });
});

/* ------------------------------------------------------------------ */
/* Affiliate & gamification                                            */
/* ------------------------------------------------------------------ */

/** Full affiliate picture: code, stats, tier, leaderboard, referrals, ledger. */
app.get("/affiliate", async (c) => {
  const user = c.get("user");
  const newlyUnlocked = await evaluateAchievements(c.env, user.id);
  const code = await ensureReferralCode(c.env, user.id);
  const points = await totalPoints(c.env, user.id);
  const rank = await pointsRank(c.env, points);
  const tier = tierFor(points);

  const { results: referralRows } = await c.env.DB.prepare(
    "SELECT name, email_verified, created_at FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 50"
  )
    .bind(user.id)
    .all<{ name: string; email_verified: number; created_at: string }>();

  const { results: board } = await c.env.DB.prepare(
    `SELECT u.id, u.name,
       COALESCE((SELECT SUM(points) FROM points_ledger l WHERE l.user_id = u.id), 0) AS points,
       (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id) AS referrals
     FROM users u
     ORDER BY points DESC, u.created_at ASC
     LIMIT 10`
  ).all<{ id: string; name: string; points: number; referrals: number }>();

  const { results: ledger } = await c.env.DB.prepare(
    "SELECT points, reason, created_at FROM points_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 12"
  )
    .bind(user.id)
    .all<{ points: number; reason: string; created_at: string }>();

  return c.json({
    code,
    shareUrl: `${appOrigin(c.req.url)}/signup?ref=${code}`,
    stats: { points, rank, referrals: referralRows.length },
    tier: {
      current: tier.current,
      next: tier.next,
      progressPct: tier.progressPct,
      pointsToNext: tier.next ? tier.next.min - points : 0,
      all: TIERS,
    },
    referrals: referralRows.map((r) => ({
      name: maskName(r.name),
      verified: !!r.email_verified,
      joined: r.created_at,
    })),
    leaderboard: board.map((b, i) => ({
      rank: i + 1,
      name: maskName(b.name),
      points: b.points,
      referrals: b.referrals,
      you: b.id === user.id,
    })),
    ledger,
    newlyUnlocked,
  });
});

/** Achievement catalog with unlock state and live progress. */
app.get("/achievements", async (c) => {
  const user = c.get("user");
  const newlyUnlocked = await evaluateAchievements(c.env, user.id);
  const metrics = await gatherMetrics(c.env, user.id);
  const { results } = await c.env.DB.prepare(
    "SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?"
  )
    .bind(user.id)
    .all<{ achievement_id: string; unlocked_at: string }>();
  const owned = new Map(results.map((r) => [r.achievement_id, r.unlocked_at]));

  const points = await totalPoints(c.env, user.id);
  return c.json({
    points,
    tier: tierFor(points),
    newlyUnlocked,
    achievements: ACHIEVEMENTS.map((a) => {
      const p = a.progress(metrics);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        points: a.points,
        category: a.category,
        unlocked: owned.has(a.id),
        unlockedAt: owned.get(a.id) ?? null,
        progress: p,
      };
    }),
  });
});

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

app.use("/admin/*", async (c, next) => {
  if (c.get("viaToken"))
    return c.json({ error: "Administration is not accessible over API tokens." }, 403);
  if (c.get("user").role !== "admin")
    return c.json({ error: "Administrator access is required." }, 403);
  await next();
});

app.get("/admin/email-settings", async (c) => {
  const settings = await getEmailSettings(c.env);
  // never hand the API key back to the browser
  return c.json({ settings: { ...settings, apiKey: undefined, hasApiKey: !!settings.apiKey } });
});

app.put("/admin/email-settings", async (c) => {
  const body = await c.req.json<Partial<EmailSettings>>().catch(() => null);
  if (!body) return c.json({ error: "Invalid settings payload." }, 400);
  const current = await getEmailSettings(c.env);
  const next: EmailSettings = {
    provider: body.provider ?? current.provider,
    fromEmail: body.fromEmail?.trim() || current.fromEmail,
    fromName: body.fromName?.trim() || current.fromName,
    // keep the stored key unless a new one is supplied
    apiKey: body.apiKey ? body.apiKey.trim() : current.apiKey,
  };
  if (!["dev", "cloudflare", "resend"].includes(next.provider))
    return c.json({ error: "Unknown email provider." }, 400);
  if (!EMAIL_RE.test(next.fromEmail))
    return c.json({ error: "The from address doesn't look like a valid email." }, 400);
  await saveEmailSettings(c.env, next);
  return c.json({ ok: true });
});

app.post("/admin/test-email", async (c) => {
  const user = c.get("user");
  const result = await sendEmail(c.env, {
    to: user.email,
    subject: "Rais Fintech — test email",
    text: "This is a test email from your Rais Fintech email configuration. If you can read this, sending works.",
    html: "<p>This is a <strong>test email</strong> from your Rais Fintech email configuration. If you can read this, sending works.</p>",
  });
  return c.json(result, result.ok ? 200 : 502);
});

/* ---- Theory Gallery management ---- */

const THEORY_CATEGORIES = ["technical", "fundamental", "risk", "islamic", "behavioral", "general"];
const THEORY_TECHNIQUES = ["trend", "mean-reversion", "momentum"];

interface TheoryBody {
  title?: string;
  category?: string;
  summary?: string;
  content?: string;
  when_to_use?: string;
  risk_notes?: string;
  source?: string;
  related_technique?: string | null;
  published?: boolean;
}

function validateTheory(b: TheoryBody): string | null {
  if (!b.title?.trim()) return "A title is required.";
  if (!b.summary?.trim()) return "A one-line summary is required.";
  if (!b.content?.trim()) return "The main content is required.";
  if (b.category && !THEORY_CATEGORIES.includes(b.category)) return "Unknown category.";
  if (b.related_technique && !THEORY_TECHNIQUES.includes(b.related_technique))
    return "Unknown related technique.";
  return null;
}

app.post("/admin/theories", async (c) => {
  const b = await c.req.json<TheoryBody>().catch(() => null);
  if (!b) return c.json({ error: "Invalid payload." }, 400);
  const err = validateTheory(b);
  if (err) return c.json({ error: err }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO theories (id, title, category, summary, content, when_to_use, risk_notes, source, related_technique, published, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      b.title!.trim(),
      b.category ?? "general",
      b.summary!.trim(),
      b.content!.trim(),
      b.when_to_use?.trim() || null,
      b.risk_notes?.trim() || null,
      b.source?.trim() || null,
      b.related_technique || null,
      b.published === false ? 0 : 1,
      c.get("user").id
    )
    .run();
  return c.json({ ok: true, id });
});

app.put("/admin/theories/:id", async (c) => {
  const b = await c.req.json<TheoryBody>().catch(() => null);
  if (!b) return c.json({ error: "Invalid payload." }, 400);
  const err = validateTheory(b);
  if (err) return c.json({ error: err }, 400);
  const res = await c.env.DB.prepare(
    `UPDATE theories SET title = ?, category = ?, summary = ?, content = ?, when_to_use = ?, risk_notes = ?, source = ?, related_technique = ?, published = ?, updated_at = now()
     WHERE id = ?`
  )
    .bind(
      b.title!.trim(),
      b.category ?? "general",
      b.summary!.trim(),
      b.content!.trim(),
      b.when_to_use?.trim() || null,
      b.risk_notes?.trim() || null,
      b.source?.trim() || null,
      b.related_technique || null,
      b.published === false ? 0 : 1,
      c.req.param("id")
    )
    .run();
  if (!res.meta.changes) return c.json({ error: "Theory not found." }, 404);
  return c.json({ ok: true });
});

app.delete("/admin/theories/:id", async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM theories WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  if (!res.meta.changes) return c.json({ error: "Theory not found." }, 404);
  return c.json({ ok: true });
});

/* ---- Suggestion review ---- */

app.get("/admin/suggestions", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.context, s.title, s.description, s.status, s.admin_note, s.created_at, s.decided_at, u.name AS user_name, u.email AS user_email
     FROM suggestions s JOIN users u ON u.id = s.user_id
     ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC LIMIT 200`
  ).all();
  return c.json({ suggestions: results });
});

app.put("/admin/suggestions/:id", async (c) => {
  const b = await c.req.json<{ status?: string; admin_note?: string }>().catch(() => null);
  const status = b?.status ?? "";
  if (!["approved", "rejected", "implemented", "pending"].includes(status))
    return c.json({ error: "Status must be approved, rejected, implemented or pending." }, 400);

  const prev = await c.env.DB.prepare("SELECT user_id, status FROM suggestions WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ user_id: string; status: string }>();
  if (!prev) return c.json({ error: "Suggestion not found." }, 404);

  await c.env.DB.prepare(
    "UPDATE suggestions SET status = ?, admin_note = ?, decided_at = now() WHERE id = ?"
  )
    .bind(status, b?.admin_note?.trim() || null, c.req.param("id"))
    .run();

  // First approval rewards the contributor (once).
  if (status === "approved" && prev.status === "pending") {
    await addPoints(c.env, prev.user_id, 150, "suggestion-approved");
  }
  return c.json({ ok: true });
});

app.get("/admin/users", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, name, role, email_verified, created_at FROM users ORDER BY created_at ASC"
  ).all();
  return c.json({ users: results });
});

/* ------------------------------------------------------------------ */

app.notFound((c) => c.json({ error: "API route not found." }, 404));

app.onError((err, c) => {
  console.error("API error:", err);
  return c.json({ error: "Something went wrong on our side. Your data was not changed." }, 500);
});

/**
 * Attaches the D1-compatible Postgres/Hyperdrive shim (worker/db.ts) to
 * `env.DB` for this request. `env` is a plain, mutable object, but the
 * Workers runtime reuses the same `env` reference across multiple
 * invocations in a warm isolate — a postgres.js client is a live socket
 * (an I/O object), and reusing one across requests violates Workers'
 * per-request I/O isolation, intermittently failing with "Cannot perform
 * I/O on behalf of a different request." So this must create a fresh
 * client on every call rather than caching it on `env` after the first.
 */
function withDb(env: Env): Env {
  Object.defineProperty(env, "DB", { value: getDb(env), enumerable: true, configurable: true });
  return env;
}

export default {
  /** /api/v1/* is the stable, documented alias of /api/* for programmatic
   * clients (REST + MCP); the rewrite keeps one set of handlers. */
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    env = withDb(env);
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/v1/")) {
      url.pathname = "/api/" + url.pathname.slice("/api/v1/".length);
      request = new Request(url.toString(), request);
    }
    return app.fetch(request, env, ctx);
  },
  /** Cron: drains the investment queue and syncs due broker connections. */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    env = withDb(env);
    ctx.waitUntil(processJobs(env));
    ctx.waitUntil(syncDueConnections(env));
  },
};
