import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { csrf, requireAdmin, requireAuth, errorHandler, type HonoEnv, CSRF_HEADER_VALUE } from "../src/middleware";
import { fakeCtx, user } from "./helpers";
import { audit } from "../src/services/audit";

function app(u: ReturnType<typeof user> | null) {
  const a = new Hono<HonoEnv>();
  a.use("*", async (c, next) => { const ctx = fakeCtx({}, { WEB_ORIGIN: "https://web.example" }); ctx.user = u; c.set("ctx", ctx); await next(); });
  a.use("/api/*", csrf);
  a.get("/api/open", (c) => c.text("ok"));
  a.post("/api/mutate", (c) => c.text("mutated"));
  a.get("/api/user", requireAuth, (c) => c.text("user"));
  a.get("/api/admin", requireAdmin, (c) => c.text("admin"));
  a.onError(errorHandler);
  return a;
}

describe("csrf", () => {
  it("lets GET through and blocks POST without the header", async () => {
    const a = app(user());
    expect((await a.request("/api/open")).status).toBe(200);
    expect((await a.request("/api/mutate", { method: "POST" })).status).toBe(403);
    expect((await a.request("/api/mutate", { method: "POST", headers: { "X-Requested-With": CSRF_HEADER_VALUE } })).status).toBe(200);
  });
  it("rejects a foreign Origin", async () => {
    const r = await app(user()).request("/api/mutate", { method: "POST", headers: { "X-Requested-With": CSRF_HEADER_VALUE, Origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });
  it("exempts API-key clients", async () => {
    expect((await app(user({ auth_method: "api_key" })).request("/api/mutate", { method: "POST" })).status).toBe(200);
  });
});

describe("authorization", () => {
  it("401 for anonymous, 403 for non-admin, 200 for admin", async () => {
    expect((await app(null).request("/api/user")).status).toBe(401);
    expect((await app(user()).request("/api/admin")).status).toBe(403);
    expect((await app(user({ role: "admin" })).request("/api/admin")).status).toBe(200);
    expect((await app(user({ role: "super_admin" })).request("/api/admin")).status).toBe(200);
  });
  it("renders AppError as a structured failure", async () => {
    const r = await app(null).request("/api/user"); const j = (await r.json()) as { success: boolean; error: { code: string } };
    expect(j.success).toBe(false); expect(j.error.code).toBe("UNAUTHORIZED");
  });
});

describe("audit", () => {
  it("records actor, action, resource and ip; never throws", async () => {
    const rows: unknown[] = [];
    const ctx = fakeCtx({ audit: { insert: async (r: unknown) => { rows.push(r); } } }); ctx.user = user({ id: "admin-1", role: "admin" });
    await audit(ctx, { action: "admin.model_disabled", resource_type: "model", resource_id: "m1", details: { before: true } });
    expect(rows[0]).toMatchObject({ actor_id: "admin-1", action: "admin.model_disabled", resource_type: "model", resource_id: "m1", ip: "127.0.0.1", result: "ok" });
    const broken = fakeCtx({ audit: { insert: async () => { throw new Error("db down"); } } });
    await expect(audit(broken, { action: "x", resource_type: "y" })).resolves.toBeUndefined();
  });
});
