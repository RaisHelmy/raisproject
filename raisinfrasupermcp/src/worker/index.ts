import { Hono } from "hono";
import { cors } from "hono/cors";
import postgres from "postgres";
import type { DataStore } from "../domain/repository/store";
import { createMemoryStore } from "../domain/repository/memory";
import { createPgStore } from "./pgStore";
import { seedDemo, DEMO } from "../domain/seed/demo";
import { createSuperMcp, resolveActor, makeContext, type SuperMcp } from "../domain/services";
import { DomainError, type RequestContext, type Actor } from "../domain/types";
import { PermissionDenied, DEFAULT_ROLES } from "../domain/permissions";
import { createSession, findSession, hashPassword, verifyPassword, verifySsoToken } from "./auth";
import { handleMcp } from "./mcp";
import { newId, hash } from "../domain/ids";
import { TASK_CATALOG } from "../domain/engines/taskCatalog";
import { createProvider } from "../domain/ai/httpProviders";

export interface Env { HYPERDRIVE?: Hyperdrive; EVIDENCE?: R2Bucket; ASSETS?: Fetcher; APP_NAME: string; DEMO_MODE?: string; SESSION_SECRET?: string; SAAS_SSO_SECRET?: string; AI_PROVIDER_KEY?: string; AI_PROVIDER?: "ANTHROPIC" | "OPENAI" | "GOOGLE"; AI_MODEL?: string }

type Vars = { app: SuperMcp; store: DataStore; ctx: RequestContext; userId: string; sessionId: string; mode: "DEMO" | "CONNECTED" };
const api = new Hono<{ Bindings: Env; Variables: Vars }>();

// ---- store per isolate (memory demo store is seeded once per isolate; Postgres via Hyperdrive when bound and DEMO_MODE != true) ----
// The Postgres client (and store built on it) is deliberately NOT cached
// across requests, unlike `memory` below: a postgres.js client holds a live
// socket (an I/O object), and Workers forbids using an I/O object created
// in one request's context from a later request ("Cannot perform I/O on
// behalf of a different request") — a cached module-level client works for
// the first request in an isolate and throws on every request after it.
// Hyperdrive itself pools the real connections, so a fresh client per
// request is cheap and correct. `memory`/`seeded` hold no I/O socket (an
// in-process object), so caching those across requests is fine.
let memory: DataStore | undefined; let seeded: Promise<void> | undefined;
async function getStore(env: Env): Promise<{ store: DataStore; mode: "DEMO" | "CONNECTED" }> {
  if (env.HYPERDRIVE && env.DEMO_MODE !== "true") {
    const pgClient = postgres(env.HYPERDRIVE.connectionString, { max: 5 });
    const pgStore = createPgStore(withSearchPath(pgClient, "raisinfrasupermcp"));
    if ((await pgStore.roles.count()) === 0) { await pgStore.roles.putMany(DEFAULT_ROLES.map((r) => ({ ...r, id: `role_${r.key}` }))); await pgStore.taskDefinitions.putMany(TASK_CATALOG); }
    return { store: pgStore, mode: "CONNECTED" };
  }
  if (!memory) { memory = createMemoryStore(); seeded = seedDemo(memory); }
  await seeded;
  return { store: memory, mode: "DEMO" };
}

/**
 * Hyperdrive pools connections at the transaction/statement level and does
 * not preserve session state (a `SET search_path`, or the search_path
 * connection option used here previously) across separate statements, so
 * every unqualified table reference in pgStore.ts otherwise resolves
 * against the default schema and fails with "relation ... does not exist".
 * Wrapping every `.unsafe(...)` call in an explicit transaction that first
 * runs `SET search_path` *is* pinned to a single backend connection under
 * Hyperdrive's transaction pooling. pgStore.ts's RepoTable only ever calls
 * `sql.unsafe(...)`, so that's the only method this wrapper needs to
 * implement.
 */
function withSearchPath(sql: ReturnType<typeof postgres>, schema: string): ReturnType<typeof postgres> {
  return {
    unsafe: (text: string, params?: unknown[]) =>
      sql.begin(async (tx) => {
        await tx.unsafe(`SET search_path TO ${schema}`);
        return tx.unsafe(text, params as never[]);
      }),
    begin: (fn: (tx: ReturnType<typeof postgres>) => unknown) =>
      sql.begin(async (tx) => {
        await tx.unsafe(`SET search_path TO ${schema}`);
        return fn(tx as unknown as ReturnType<typeof postgres>);
      }),
  } as unknown as ReturnType<typeof postgres>;
}

api.use("*", cors({ origin: (o) => o, credentials: true }));
api.use("*", async (c, next) => {
  const { store, mode } = await getStore(c.env);
  const ai = c.env.AI_PROVIDER_KEY && c.env.AI_PROVIDER ? createProvider({ kind: c.env.AI_PROVIDER, model: c.env.AI_MODEL ?? "default", credentialRef: "platform-ai", getSecret: async () => c.env.AI_PROVIDER_KEY }) : createProvider();
  c.set("store", store); c.set("mode", mode); c.set("app", createSuperMcp(store, ai));
  await next();
});

api.onError((e, c) => {
  if (e instanceof DomainError) return c.json({ code: e.code, message: e.message, detail: e.detail }, e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "POLICY_DENIED" ? 403 : 422);
  if (e instanceof PermissionDenied) return c.json({ code: "FORBIDDEN", message: e.message }, 403);
  console.error(e);
  return c.json({ code: "INTERNAL", message: "Something went wrong. The error has been logged with a correlation id.", correlationId: newId("cor") }, 500);
});

const bearer = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header("authorization")?.replace(/^Bearer\s+/i, "");

// ---- auth (public) ----
api.post("/auth/register", async (c) => {
  const store = c.get("store"); const app = c.get("app");
  const body = await c.req.json<{ name: string; email: string; password: string; organizationName: string; organizationType: "PERSONAL" | "COMPANY" }>();
  if (!body.email?.includes("@") || (body.password ?? "").length < 8 || !body.name) throw new DomainError("VALIDATION", "Name, valid email and a password of at least 8 characters are required");
  if ((await store.users.list({ email: body.email.toLowerCase() })).length) throw new DomainError("VALIDATION", "An account with this email already exists");
  const user = { id: newId("usr"), email: body.email.toLowerCase(), name: body.name, avatarInitials: body.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(), verification: { status: "NOT_STARTED" as const }, createdAt: new Date().toISOString() };
  await store.users.put(user);
  const pw = await hashPassword(body.password);
  await store.passwords.put({ id: newId("pwd"), userId: user.id, hash: pw.hash, salt: pw.salt, algorithm: "PBKDF2-SHA256" });
  const org = await app.platform.createOrganization(user.id, user.name, { name: body.organizationName || `${body.name} (Personal)`, type: body.organizationType ?? "PERSONAL" });
  const { token } = await createSession(store, user.id, "WEB", org.id);
  return c.json({ ...(await sessionPayload(app, store, user.id, org.id, c.get("mode"))), token });
});

api.post("/auth/login", async (c) => {
  const store = c.get("store"); const app = c.get("app");
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const user = (await store.users.list((u) => u.email.toLowerCase() === (email ?? "").toLowerCase()))[0];
  const pw = user ? (await store.passwords.list({ userId: user.id }))[0] : undefined;
  const okPw = user && pw && (pw.salt === user.id ? pw.hash === hash(password + ":" + user.id) /* demo seed */ : await verifyPassword(password, pw.hash, pw.salt));
  if (!okPw) return c.json({ code: "UNAUTHENTICATED", message: "Incorrect email or password" }, 401);
  await store.users.put({ ...user, lastLoginAt: new Date().toISOString() });
  const orgs = await app.platform.organizationsForUser(user.id);
  const { token } = await createSession(store, user.id, "WEB", orgs[0]?.id);
  await store.auditLogs.put({ id: newId("aud"), organizationId: orgs[0]?.id ?? "", actorId: user.id, actorName: user.name, action: "auth.login", resourceType: "user", resourceId: user.id, resourceLabel: user.name, timestamp: new Date().toISOString(), result: "SUCCESS", risk: "LOW", correlationId: newId("cor"), executionMode: "HUMAN" });
  return c.json({ ...(await sessionPayload(app, store, user.id, orgs[0]?.id, c.get("mode"))), token });
});

// Suite super-admin SSO: GET /api/auth/sso?token=<HMAC token minted by https://saas.raishelmy.uk/admin>.
// Verifies the token, resolves the existing super-admin user by email, mints a normal WEB session
// exactly like /auth/login does, then hands the bearer token to the SPA. The web frontend keeps
// its session in localStorage (`supermcp.token`, read by src/services/api/httpClient.ts) and only
// talks to the Worker when `supermcp.mode` is "connected" (src/services/api/index.ts), so the
// response is a tiny bootstrap page that writes both keys and location.replace()s to the dashboard.
const SSO_APP_ID = "supermcp";
const SSO_DASHBOARD_PATH = "/";
api.get("/auth/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO is not configured", 503);
  const token = c.req.query("token");
  if (!token) return c.text("Missing token", 400);
  const claims = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!claims) return c.text("Invalid or expired SSO token", 401);
  const store = c.get("store"); const app = c.get("app");
  const user = (await store.users.list((u) => u.email.toLowerCase() === claims.email))[0];
  if (!user) return c.text("No account for this identity", 403);
  const orgs = await app.platform.organizationsForUser(user.id);
  const org = orgs.find((o) => o.slug === "rais-admin") ?? orgs[0];
  if (!org) return c.text("No organization membership", 403);
  await store.users.put({ ...user, lastLoginAt: new Date().toISOString() });
  const { token: sessionToken } = await createSession(store, user.id, "WEB", org.id);
  await store.auditLogs.put({ id: newId("aud"), organizationId: org.id, actorId: user.id, actorName: user.name, action: "auth.login", resourceType: "user", resourceId: user.id, resourceLabel: `${user.name} (suite SSO)`, timestamp: new Date().toISOString(), result: "SUCCESS", risk: "LOW", correlationId: newId("cor"), executionMode: "HUMAN" });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head><body><p>Signing you in to Super MCP…</p><script>
try { localStorage.setItem("supermcp.token", ${JSON.stringify(sessionToken)}); localStorage.setItem("supermcp.mode", "connected"); } catch (e) {}
location.replace(${JSON.stringify(SSO_DASHBOARD_PATH)});
</script></body></html>`;
  return c.html(html, 200, { "cache-control": "no-store", "referrer-policy": "no-referrer" });
});

async function sessionPayload(app: SuperMcp, store: DataStore, userId: string, organizationId: string | undefined, mode: "DEMO" | "CONNECTED") {
  const user = await store.users.get(userId);
  const organizations = await app.platform.organizationsForUser(userId);
  const organization = organizations.find((o) => o.id === organizationId) ?? organizations[0];
  if (!user || !organization) throw new DomainError("FORBIDDEN", "No organization membership");
  const actor = await resolveActor(store, userId, organization.id);
  return { user, organization, organizations, actor, mode };
}

// ---- authenticated middleware: resolve actor from session; never trust client claims ----
api.use("*", async (c, next) => {
  const store = c.get("store");
  const session = await findSession(store, bearer(c));
  if (!session) return c.json({ code: "UNAUTHENTICATED", message: "Sign in required" }, 401);
  const orgs = await c.get("app").platform.organizationsForUser(session.userId);
  const orgId = session.organizationId ?? orgs[0]?.id;
  if (!orgId) return c.json({ code: "FORBIDDEN", message: "No organization membership" }, 403);
  const actor: Actor = await resolveActor(store, session.userId, orgId);
  c.set("ctx", makeContext(actor, c.req.header("x-execution-mode") === "WEBHOOK" ? "WEBHOOK" : "HUMAN", c.req.header("x-correlation-id") ?? newId("cor")));
  c.set("userId", session.userId); c.set("sessionId", session.id);
  c.header("x-correlation-id", c.get("ctx").correlationId);
  await next();
});

api.get("/auth/session", async (c) => c.json(await sessionPayload(c.get("app"), c.get("store"), c.get("userId"), c.get("ctx").actor.organizationId, c.get("mode"))));
api.post("/auth/logout", async (c) => { await c.get("store").sessions.delete(c.get("sessionId")); return c.json({ ok: true }); });
api.post("/auth/switch", async (c) => {
  const { organizationId } = await c.req.json<{ organizationId: string }>();
  await resolveActor(c.get("store"), c.get("userId"), organizationId); // throws if not a member
  const s = await c.get("store").sessions.get(c.get("sessionId"));
  if (s) await c.get("store").sessions.put({ ...s, organizationId });
  return c.json({ ...(await sessionPayload(c.get("app"), c.get("store"), c.get("userId"), organizationId, c.get("mode"))) });
});
api.post("/auth/mcp-token", async (c) => { const { token } = await createSession(c.get("store"), c.get("userId"), "MCP", c.get("ctx").actor.organizationId); await c.get("store").auditLogs.put({ id: newId("aud"), organizationId: c.get("ctx").actor.organizationId, actorId: c.get("userId"), actorName: c.get("ctx").actor.userName, action: "mcp.token_created", resourceType: "session", resourceId: "mcp", timestamp: new Date().toISOString(), result: "SUCCESS", risk: "HIGH", correlationId: c.get("ctx").correlationId, executionMode: "HUMAN" }); return c.json({ token, endpoint: new URL("/mcp", c.req.url).toString() }); });

// ---- resources ----
const A = api; const j = <T>(p: Promise<T>) => p.then((r) => r as unknown as Record<string, unknown>);
A.get("/dashboard", async (c) => c.json(await c.get("app").dashboard.get(c.get("ctx"))));
A.post("/command", async (c) => c.json(await c.get("app").command.run(c.get("ctx"), (await c.req.json<{ text: string }>()).text, "Super MCP Web")));

A.get("/changes", async (c) => c.json(await c.get("app").changes.list(c.get("ctx"), { view: c.req.query("view") as never, search: c.req.query("search") })));
A.post("/changes/plan", async (c) => c.json(await c.get("app").changes.plan(c.get("ctx"), (await c.req.json<{ intent: string }>()).intent)));
A.post("/changes", async (c) => c.json(await c.get("app").changes.create(c.get("ctx"), await c.req.json())));
A.get("/changes/:id", async (c) => c.json(await c.get("app").changes.get(c.get("ctx"), c.req.param("id"))));
A.patch("/changes/:id", async (c) => c.json(await c.get("app").changes.update(c.get("ctx"), c.req.param("id"), await c.req.json())));
A.post("/changes/:id/requirements", async (c) => c.json(await c.get("app").changes.confirmRequirements(c.get("ctx"), c.req.param("id"), (await c.req.json<{ requirements?: string[] }>()).requirements)));
A.post("/changes/:id/jira", async (c) => c.json(await c.get("app").changes.syncJira(c.get("ctx"), c.req.param("id"))));
A.post("/changes/:id/skip", async (c) => { const b = await c.req.json<{ key: never; reason: string }>(); return c.json(await c.get("app").changes.skipStage(c.get("ctx"), c.req.param("id"), b.key, b.reason)); });
A.post("/changes/:id/git", async (c) => c.json(await c.get("app").changes.gitEvent(c.get("ctx"), c.req.param("id"), await c.req.json(), c.get("ctx").executionMode === "WEBHOOK" ? "WEBHOOK" : "HUMAN")));
A.post("/changes/:id/checklist", async (c) => { const b = await c.req.json<{ itemId: string; state: never }>(); return c.json(await c.get("app").changes.toggleChecklist(c.get("ctx"), c.req.param("id"), b.itemId, b.state)); });
A.post("/changes/:id/deploy", async (c) => c.json(await c.get("app").changes.requestDeployment(c.get("ctx"), c.req.param("id"))));
A.post("/changes/:id/uat", async (c) => { const b = await c.req.json<{ result: "PASSED" | "FAILED"; note: string }>(); return c.json(await c.get("app").changes.recordUat(c.get("ctx"), c.req.param("id"), b.result, b.note)); });
A.post("/changes/:id/close", async (c) => c.json(await c.get("app").changes.close(c.get("ctx"), c.req.param("id"), (await c.req.json<{ outcome: string }>()).outcome)));
A.post("/changes/:id/cancel", async (c) => c.json(await c.get("app").changes.cancel(c.get("ctx"), c.req.param("id"), (await c.req.json<{ reason: string }>()).reason)));
A.post("/changes/:id/comments", async (c) => c.json(await c.get("app").changes.comment(c.get("ctx"), c.req.param("id"), (await c.req.json<{ text: string }>()).text)));

A.get("/tasks/definitions", async (c) => c.json(c.get("app").tasks.definitions()));
A.get("/tasks", async (c) => c.json(await c.get("app").tasks.list(c.get("ctx"), { status: c.req.query("status") as never, changeId: c.req.query("changeId") })));
A.post("/tasks", async (c) => c.json(await c.get("app").tasks.create(c.get("ctx"), await c.req.json())));
A.get("/tasks/:id", async (c) => c.json(await c.get("app").tasks.get(c.get("ctx"), c.req.param("id"))));
A.post("/tasks/:id/execute", async (c) => {
  // Long-running: execute in the background (Durable Object / Queue in Phase 2); the client polls GET /tasks/:id.
  const app = c.get("app"); const ctx = c.get("ctx"); const id = c.req.param("id");
  const { task } = await app.tasks.get(ctx, id);
  if (task.status === "WAITING_APPROVAL") { await app.tasks.execute(ctx, id, { speed: 0 }); } // throws POLICY_DENIED with details unless approved
  else c.executionCtx.waitUntil(app.tasks.execute(ctx, id, { speed: 0.2, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }).catch((e) => console.error("task execution failed", e)));
  return c.json({ started: true });
});
A.post("/tasks/:id/cancel", async (c) => c.json(await c.get("app").tasks.cancel(c.get("ctx"), c.req.param("id"))));

A.get("/approvals", async (c) => c.json(await c.get("app").approvals.list(c.get("ctx"), { status: c.req.query("status") as never, mine: c.req.query("mine") === "true" })));
A.get("/approvals/:id", async (c) => c.json(await c.get("app").approvals.get(c.get("ctx"), c.req.param("id"))));
A.post("/approvals/:id/decide", async (c) => { const b = await c.req.json<{ decision: never; comment?: string; typedConfirmation?: string }>(); return c.json(await c.get("app").approvals.decide(c.get("ctx"), c.req.param("id"), b.decision, b.comment, b.typedConfirmation)); });

A.get("/policies", async (c) => c.json(await c.get("app").policies.list(c.get("ctx"))));
A.post("/policies", async (c) => c.json(await c.get("app").policies.save(c.get("ctx"), await c.req.json())));
A.post("/policies/simulate", async (c) => c.json(await c.get("app").policies.simulate(c.get("ctx"), await c.req.json())));
A.get("/policies/:id", async (c) => c.json(await c.get("app").policies.get(c.get("ctx"), c.req.param("id"))));
A.post("/policies/:id/toggle", async (c) => c.json(await c.get("app").policies.toggle(c.get("ctx"), c.req.param("id"), (await c.req.json<{ enabled: boolean }>()).enabled)));
A.delete("/policies/:id", async (c) => { await c.get("app").policies.remove(c.get("ctx"), c.req.param("id")); return c.json({ ok: true }); });

A.get("/organizations/current", async (c) => c.json(await c.get("app").platform.organization(c.get("ctx"))));
A.patch("/organizations/current", async (c) => c.json(await c.get("app").platform.updateOrganization(c.get("ctx"), await c.req.json())));
A.post("/organizations/verification", async (c) => { const b = await c.req.json<{ kind: "ORGANIZATION" | "USER"; provider: string }>(); return c.json(await c.get("app").platform.requestVerification(c.get("ctx"), b.kind, b.provider)); });
A.get("/users", async (c) => c.json(await c.get("app").platform.members(c.get("ctx"))));
A.post("/users/invite", async (c) => c.json(await c.get("app").platform.invite(c.get("ctx"), await c.req.json())));
A.patch("/users/memberships/:id", async (c) => c.json(await c.get("app").platform.updateMembership(c.get("ctx"), c.req.param("id"), await c.req.json())));
A.get("/groups", async (c) => c.json(await c.get("app").platform.groups(c.get("ctx"))));
A.post("/groups", async (c) => c.json(await c.get("app").platform.saveGroup(c.get("ctx"), await c.req.json())));
A.get("/roles", async (c) => c.json(await c.get("app").platform.roles(c.get("ctx"))));
A.post("/roles", async (c) => c.json(await c.get("app").platform.saveRole(c.get("ctx"), await c.req.json())));

A.get("/agents", async (c) => c.json(await c.get("app").platform.agents(c.get("ctx"))));
A.post("/agents/register", async (c) => c.json(await c.get("app").platform.registerAgent(c.get("ctx"), await c.req.json())));
A.get("/agents/:id", async (c) => c.json(await c.get("app").platform.agent(c.get("ctx"), c.req.param("id"))));
A.post("/agents/:id/action", async (c) => c.json(await c.get("app").platform.agentAction(c.get("ctx"), c.req.param("id"), (await c.req.json<{ action: never }>()).action)));
// Agent heartbeat (Phase 2 real agents): outbound-only, authenticated with the agent session token.
A.post("/agents/:id/heartbeat", async (c) => { const a = await c.get("app").platform.agent(c.get("ctx"), c.req.param("id")); const b = await c.req.json<{ health?: typeof a.health; version?: string; capabilities?: typeof a.capabilities }>(); await c.get("store").agents.put({ ...a, lastSeenAt: new Date().toISOString(), health: b.health ?? a.health, version: b.version ?? a.version, capabilities: b.capabilities ?? a.capabilities, mode: "CONNECTED" }); return c.json({ ok: true }); });

A.get("/environments", async (c) => c.json(await c.get("app").platform.environments(c.get("ctx"))));
A.get("/environments/servers", async (c) => c.json(await c.get("app").platform.servers(c.get("ctx"))));
A.get("/environments/applications", async (c) => c.json(await c.get("app").platform.applications(c.get("ctx"))));
A.get("/environments/:id/snapshot", async (c) => c.json(await j(c.get("app").platform.environmentSnapshot(c.get("ctx"), c.req.param("id")))));
A.get("/integrations", async (c) => c.json(await c.get("app").platform.integrations(c.get("ctx"))));
A.get("/integrations/repositories", async (c) => c.json(await c.get("app").platform.repositories(c.get("ctx"))));
A.get("/integrations/git", async (c) => c.json(await c.get("app").platform.gitConnections(c.get("ctx"))));
A.post("/integrations/git", async (c) => c.json(await c.get("app").platform.createGitConnection(c.get("ctx"), await c.req.json())));
A.post("/integrations/git/:id/test", async (c) => c.json(await c.get("app").platform.testGitConnection(c.get("ctx"), c.req.param("id"))));
A.get("/integrations/credentials", async (c) => c.json(await c.get("app").platform.credentials(c.get("ctx"))));
A.get("/deployments", async (c) => c.json(await c.get("app").platform.deployments(c.get("ctx"))));
A.get("/deployments/:id", async (c) => c.json(await c.get("app").platform.deployment(c.get("ctx"), c.req.param("id"))));
A.get("/incidents", async (c) => c.json(await c.get("app").platform.incidents(c.get("ctx"))));
A.get("/incidents/:id", async (c) => c.json(await c.get("app").platform.incident(c.get("ctx"), c.req.param("id"))));
A.post("/incidents/:id/resolve", async (c) => c.json(await c.get("app").platform.resolveIncident(c.get("ctx"), c.req.param("id"), (await c.req.json<{ note: string }>()).note)));
A.get("/audit", async (c) => c.json(await c.get("app").platform.auditLogs(c.get("ctx"), { action: c.req.query("action"), actorId: c.req.query("actorId"), result: c.req.query("result"), search: c.req.query("search"), limit: Number(c.req.query("limit") ?? 500) })));
A.get("/notifications", async (c) => c.json(await c.get("app").platform.notifications(c.get("ctx"))));
A.post("/notifications/read", async (c) => { await c.get("app").platform.markNotifications(c.get("ctx"), (await c.req.json<{ ids: string[] | "all" }>()).ids); return c.json({ ok: true }); });
A.get("/billing", async (c) => c.json(await c.get("app").platform.billing(c.get("ctx"))));
A.post("/billing/plan", async (c) => { const b = await c.req.json<{ planId: string; cycle?: "MONTHLY" | "YEARLY" }>(); return c.json(await c.get("app").platform.changePlan(c.get("ctx"), b.planId, b.cycle)); });
A.post("/billing/ai", async (c) => c.json(await c.get("app").platform.setAiMode(c.get("ctx"), await c.req.json())));
A.get("/marketplace", async (c) => c.json(await c.get("app").platform.marketplace(c.get("ctx"))));
A.get("/marketplace/automations", async (c) => c.json(await c.get("app").platform.automations(c.get("ctx"))));
A.post("/marketplace/automations/:id/toggle", async (c) => c.json(await c.get("app").platform.toggleAutomation(c.get("ctx"), c.req.param("id"), (await c.req.json<{ enabled: boolean }>()).enabled)));
A.post("/marketplace/:id/install", async (c) => c.json(await c.get("app").platform.installMarketplaceItem(c.get("ctx"), c.req.param("id"))));
A.post("/data/export", async (c) => c.json(await c.get("app").platform.exportMyData(c.get("ctx"), (await c.req.json<{ sections?: string[] | "all" }>()).sections)));
A.post("/data/delete", async (c) => c.json(await c.get("app").platform.requestDeletion(c.get("ctx"), (await c.req.json<{ phrase: string }>()).phrase)));

A.get("/ai/summary", async (c) => c.json(await c.get("app").telemetry.summary(c.get("ctx"), Number(c.req.query("days") ?? 30))));
A.get("/ai/runs", async (c) => c.json(await c.get("app").telemetry.runs(c.get("ctx"), c.req.query() as never)));
A.get("/ai/runs/:id", async (c) => c.json(await c.get("app").telemetry.run(c.get("ctx"), c.req.param("id"))));
A.get("/ai/recommendations", async (c) => c.json(await c.get("app").telemetry.recommendations(c.get("ctx"))));
A.post("/ai/recommendations/:id", async (c) => c.json(await c.get("app").telemetry.updateRecommendation(c.get("ctx"), c.req.param("id"), (await c.req.json<{ status: never }>()).status)));
A.post("/ai/analyze", async (c) => c.json(await c.get("app").telemetry.analyze(c.get("ctx"))));
A.get("/ai/learning", async (c) => c.json(await c.get("app").telemetry.learning(c.get("ctx"))));
A.post("/ai/export", async (c) => c.json(await c.get("app").telemetry.exportLearningData(c.get("ctx"))));
A.get("/mcp/calls", async (c) => { const q = c.req.query(); return c.json(await c.get("app").telemetry.calls(c.get("ctx"), { ...q, minDurationMs: q.minDurationMs ? Number(q.minDurationMs) : undefined, redundant: q.redundant === undefined ? undefined : q.redundant === "true", limit: q.limit ? Number(q.limit) : undefined } as never)); });
A.get("/mcp/tools", async (c) => c.json(await c.get("app").telemetry.toolAnalytics(c.get("ctx"))));
A.get("/demo/scenarios", async (c) => c.json(c.get("app").demoLab.scenarios()));
A.post("/demo/:id/prepare", async (c) => c.json(await c.get("app").demoLab.prepare(c.get("ctx"), c.req.param("id"))));
A.post("/demo/reset", async (c) => { if (c.get("mode") !== "DEMO") throw new DomainError("VALIDATION", "Reset is only available in demo mode"); memory = undefined; seeded = undefined; return c.json({ ok: true }); });

// ---- root worker: /api/*, /mcp, static assets ----
const root = new Hono<{ Bindings: Env }>();
root.route("/api", api);

root.all("/mcp", async (c) => {
  if (c.req.method === "GET") return c.json({ name: "super-mcp", transport: "streamable-http", endpoint: "/mcp", auth: "Bearer <MCP token from Settings → Connected AI>", tools: 27 });
  if (c.req.method !== "POST") return c.text("Method not allowed", 405);
  const { store, mode } = await getStore(c.env);
  const app = createSuperMcp(store);
  const session = await findSession(store, bearer(c));
  if (!session) return c.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: provide a Bearer MCP token" } }, 401, { "www-authenticate": 'Bearer realm="super-mcp"' });
  const orgs = await app.platform.organizationsForUser(session.userId);
  const orgId = session.organizationId ?? orgs[0]?.id;
  const actor = await resolveActor(store, session.userId, orgId);
  const ctx = makeContext(actor, "AI");
  const sessionId = c.req.header("mcp-session-id") ?? session.id;
  const client = c.req.header("user-agent")?.split("/")[0] ?? "MCP client";
  const result = await handleMcp(app, ctx, await c.req.json(), sessionId, client);
  c.header("mcp-session-id", sessionId);
  return c.json(result as never);
});

root.get("/healthz", (c) => c.json({ ok: true, app: c.env.APP_NAME, mode: c.env.HYPERDRIVE && c.env.DEMO_MODE !== "true" ? "CONNECTED" : "DEMO" }));
root.all("*", async (c) => { if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw); return c.text("Super MCP API. Build the frontend with `bun run build`.", 200); });

export default root;
export { DEMO };
