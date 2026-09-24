import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { createApp } from "../src/app";

function getCookie(res: Response, name: string): string | undefined {
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  for (const line of raw) {
    if (line.startsWith(`${name}=`)) return line.split(";")[0]!.split("=").slice(1).join("=");
  }
  return undefined;
}

describe("auth flow", () => {
  it("signs up, exposes /me, and logs out", async () => {
    const app = createApp();
    const email = `user-${Date.now()}@example.com`;

    const signupRes = await app.request(
      "/api/v1/auth/signup",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123", name: "Alice" }) },
      env,
    );
    expect(signupRes.status).toBe(201);
    const sessionCookie = getCookie(signupRes, "rais_session");
    expect(sessionCookie).toBeTruthy();
    const signupBody = (await signupRes.json()) as { user: { email: string }; orgId: string };
    expect(signupBody.user.email).toBe(email);
    expect(signupBody.orgId).toBeTruthy();

    const meRes = await app.request("/api/v1/auth/me", { headers: { cookie: `rais_session=${sessionCookie}` } }, env);
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as { orgId: string; isAdmin: boolean };
    expect(me.orgId).toBe(signupBody.orgId);
    expect(me.isAdmin).toBe(false);

    const logoutRes = await app.request(
      "/api/v1/auth/logout",
      { method: "POST", headers: { cookie: `rais_session=${sessionCookie}` } },
      env,
    );
    expect(logoutRes.status).toBe(204);

    const meAfterLogout = await app.request("/api/v1/auth/me", { headers: { cookie: `rais_session=${sessionCookie}` } }, env);
    expect(meAfterLogout.status).toBe(401);
  });

  it("rejects signup with a duplicate email", async () => {
    const app = createApp();
    const email = `dup-${Date.now()}@example.com`;
    const payload = JSON.stringify({ email, password: "password123", name: "Bob" });
    const first = await app.request("/api/v1/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: payload }, env);
    expect(first.status).toBe(201);
    const second = await app.request("/api/v1/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: payload }, env);
    expect(second.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    const app = createApp();
    const email = `login-${Date.now()}@example.com`;
    await app.request(
      "/api/v1/auth/signup",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123", name: "Cara" }) },
      env,
    );
    const loginOk = await app.request(
      "/api/v1/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123" }) },
      env,
    );
    expect(loginOk.status).toBe(200);
    const loginBad = await app.request(
      "/api/v1/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "nope" }) },
      env,
    );
    expect(loginBad.status).toBe(401);
  });

  it("records signup and login audit events", async () => {
    const app = createApp();
    const email = `audit-${Date.now()}@example.com`;
    await app.request(
      "/api/v1/auth/signup",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123", name: "Dee" }) },
      env,
    );
    const { results } = await env.DB.prepare(
      `SELECT event FROM audit_log al JOIN users u ON u.id = al.actor_user_id WHERE u.email = ? ORDER BY al.created_at`,
    )
      .bind(email)
      .all<{ event: string }>();
    expect(results.map((r) => r.event)).toEqual(["signup", "login"]);
  });

  it("signs in regardless of how the email was capitalised", async () => {
    const app = createApp();
    const email = `Mixed.Case-${Date.now()}@Example.com`;
    await app.request(
      "/api/v1/auth/signup",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "password123", name: "Eve" }) },
      env,
    );

    // Email case is not meaningful, and someone typing their own address in a
    // different case is not a wrong password.
    const res = await app.request(
      "/api/v1/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.toUpperCase(), password: "password123" }) },
      env,
    );
    expect(res.status).toBe(200);
  });
});
