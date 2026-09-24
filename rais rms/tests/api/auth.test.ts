import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("auth", () => {
  test("register creates tenant, outlet, owner user and sets a session cookie", async () => {
    const client = new TestClient(testEnv());
    const { res, json } = await registerTenant(client);

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data.tenant.slug).toContain("test-bistro-");
    expect(json.data.outlet.tenant_id).toBe(json.data.tenant.id);
    expect(json.data.user.email).toContain("owner-");
  });

  test("me returns the authenticated session after register", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);

    const res = await client.get("/api/auth/me");
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(json.data.roles).toBeDefined();
  });

  test("me is unauthorized without a session", async () => {
    const client = new TestClient(testEnv());
    const res = await client.get("/api/auth/me");
    const json = (await res.json()) as any;

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  test("login succeeds with correct credentials and fails with wrong password", async () => {
    const env = testEnv();
    const registerClient = new TestClient(env);
    const { body } = await registerTenant(registerClient);

    const loginClient = new TestClient(env);
    const ok = await loginClient.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: body.ownerEmail,
      password: body.password,
    });
    expect(ok.status).toBe(200);

    const badClient = new TestClient(env);
    const bad = await badClient.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: body.ownerEmail,
      password: "wrong-password",
    });
    expect(bad.status).toBe(401);
  });

  test("logout clears the session", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);
    await client.post("/api/auth/logout");

    const res = await client.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
