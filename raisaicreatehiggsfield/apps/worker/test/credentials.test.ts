import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { LedgerService } from "../src/services/ledger-service";
import { resetRateLimits } from "../src/middleware/rate-limit";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

function stubEnv() {
  return { ...env, AI: { run: async () => ({ image: "aGk=" }) } as unknown as Ai };
}

async function session(app: ReturnType<typeof createApp>, testEnv: typeof env) {
  const res = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `key-${newId()}@example.com`, password: "password123", name: "Dev" }),
    },
    testEnv,
  );
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
  const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
  const body = (await res.json()) as { orgId: string; user: { id: string } };
  return { cookie, csrf, orgId: body.orgId, userId: body.user.id, headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf } };
}

async function issueKey(app: ReturnType<typeof createApp>, testEnv: typeof env, headers: Record<string, string>, scopes: string[]) {
  const res = await app.request(
    "/api/v1/api-keys",
    { method: "POST", headers, body: JSON.stringify({ name: "CI key", scopes }) },
    testEnv,
  );
  return { status: res.status, body: (await res.json()) as { secret?: string; prefix?: string; id?: string } };
}

describe("API keys", () => {
  beforeEach(() => resetRateLimits());

  it("shows the secret once and never again", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);

    const created = await issueKey(app, testEnv, user.headers, ["models:read"]);
    expect(created.status).toBe(201);
    expect(created.body.secret).toMatch(/^rk_/);

    const listed = await app.request("/api/v1/api-keys", { headers: { cookie: user.cookie, "x-csrf-token": user.csrf } }, testEnv);
    const body = (await listed.json()) as { items: { prefix: string; secret?: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.secret).toBeUndefined();
    expect(body.items[0]!.prefix).toContain("…");
  });

  it("authenticates a request and records the key as used", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    const created = await issueKey(app, testEnv, user.headers, ["models:read"]);

    const res = await app.request(
      "/api/v1/models",
      { headers: { authorization: `Bearer ${created.body.secret}` } },
      testEnv,
    );
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(`SELECT last_used_at FROM api_keys WHERE id = ?`).bind(created.body.id).first<{ last_used_at: string | null }>();
    expect(row?.last_used_at).toBeTruthy();
  });

  it("enforces scopes: a read key cannot generate", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    await new LedgerService(env).deposit(user.orgId, 5000);
    const readOnly = await issueKey(app, testEnv, user.headers, ["models:read"]);

    const res = await app.request(
      "/api/v1/generations",
      {
        method: "POST",
        headers: { authorization: `Bearer ${readOnly.body.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ modelId: FLUX, prompt: "should be refused" }),
      },
      testEnv,
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("insufficient_scope");
  });

  it("lets a write key generate, and skips CSRF for bearer callers", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    await new LedgerService(env).deposit(user.orgId, 5000);
    const key = await issueKey(app, testEnv, user.headers, ["generations:write", "generations:read", "models:read", "projects:read", "projects:write"]);

    const res = await app.request(
      "/api/v1/generations",
      {
        method: "POST",
        // No CSRF token: a bearer credential is not a browser cookie.
        headers: { authorization: `Bearer ${key.body.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ modelId: FLUX, prompt: "from the API" }),
      },
      testEnv,
    );
    expect(res.status).toBe(201);
  });

  it("stops working the moment it is revoked", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    const key = await issueKey(app, testEnv, user.headers, ["models:read"]);

    const before = await app.request("/api/v1/models", { headers: { authorization: `Bearer ${key.body.secret}` } }, testEnv);
    expect(before.status).toBe(200);

    await app.request(`/api/v1/api-keys/${key.body.id}`, { method: "DELETE", headers: user.headers }, testEnv);

    const after = await app.request("/api/v1/models", { headers: { authorization: `Bearer ${key.body.secret}` } }, testEnv);
    expect(after.status).toBe(401);
  });

  it("rejects an unknown key without revealing whether it ever existed", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const res = await app.request("/api/v1/models", { headers: { authorization: "Bearer rk_not_a_real_key" } }, testEnv);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe("That API key is not valid.");
  });

  it("never grants admin rights to a bearer key, even for an admin user", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    await env.DB.prepare(`UPDATE users SET role='admin' WHERE id = ?`).bind(user.userId).run();
    const key = await issueKey(app, testEnv, user.headers, ["billing:read", "billing:write"]);

    const res = await app.request(
      "/api/v1/admin/balance/deposits",
      {
        method: "POST",
        headers: { authorization: `Bearer ${key.body.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ orgId: user.orgId, amountSen: 100000 }),
      },
      testEnv,
    );
    // A leaked key must not be able to mint balance.
    expect(res.status).toBe(403);
  });

  it("refuses to let a key create another key", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);
    const key = await issueKey(app, testEnv, user.headers, ["account:write"]);

    const res = await app.request(
      "/api/v1/api-keys",
      {
        method: "POST",
        headers: { authorization: `Bearer ${key.body.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "second", scopes: ["models:read"] }),
      },
      testEnv,
    );
    expect(res.status).toBe(403);
  });
});

describe("MCP tokens", () => {
  beforeEach(() => resetRateLimits());

  it("refuses scopes an MCP token must never hold", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);

    const res = await app.request(
      "/api/v1/mcp-tokens",
      {
        method: "POST",
        headers: user.headers,
        body: JSON.stringify({ name: "agent", scopes: ["billing:write"] }),
      },
      testEnv,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain("cannot hold");
  });

  it("issues a token with agent-appropriate scopes", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const user = await session(app, testEnv);

    const res = await app.request(
      "/api/v1/mcp-tokens",
      {
        method: "POST",
        headers: user.headers,
        body: JSON.stringify({ name: "agent", scopes: ["models:read", "generations:write", "templates:execute"] }),
      },
      testEnv,
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { secret: string }).secret).toMatch(/^rmcp_/);
  });
});
