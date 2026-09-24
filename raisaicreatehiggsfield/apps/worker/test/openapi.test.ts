import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { createApp } from "../src/app";

async function cookie(app: ReturnType<typeof createApp>) {
  const res = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `doc-${newId()}@example.com`, password: "password123", name: "Doc" }),
    },
    env,
  );
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

describe("API description", () => {
  it("describes every documented endpoint with a scope", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/openapi/summary", { headers: { cookie: await cookie(app) } }, env);
    const body = (await res.json()) as { endpoints: { method: string; path: string; scope: string; summary: string }[] };

    expect(body.endpoints.length).toBeGreaterThan(20);
    for (const endpoint of body.endpoints) {
      expect(endpoint.path.startsWith("/api/v1/"), endpoint.path).toBe(true);
      expect(endpoint.summary.length, endpoint.path).toBeGreaterThan(10);
      expect(endpoint.scope, endpoint.path).toBeTruthy();
    }
  });

  it("serves a valid OpenAPI document that explains the money", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/openapi.json", { headers: { cookie: await cookie(app) } }, env);
    const doc = (await res.json()) as {
      openapi: string;
      info: { description: string };
      paths: Record<string, Record<string, unknown>>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths).length).toBeGreaterThan(20);
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
    // Sen and ringgit are the single most confusable thing about this API.
    expect(doc.info.description).toContain("sen");
    expect(doc.info.description).toContain("ringgit");
  });

  it("documents the failures a caller must handle, not only success", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/openapi.json", { headers: { cookie: await cookie(app) } }, env);
    const doc = (await res.json()) as { paths: Record<string, Record<string, { responses: Record<string, unknown> }>> };
    const generate = doc.paths["/api/v1/generations"]!.post!;

    expect(Object.keys(generate.responses)).toContain("402");
    expect(Object.keys(generate.responses)).toContain("403");
    expect(Object.keys(generate.responses)).toContain("429");
  });

  it("keeps admin routes out of the customer API description", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/openapi.json", { headers: { cookie: await cookie(app) } }, env);
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).some((p) => p.includes("/admin/"))).toBe(false);
  });

  it("describes routes that actually exist", async () => {
    const app = createApp();
    const session = await cookie(app);
    const res = await app.request("/api/v1/openapi/summary", { headers: { cookie: session } }, env);
    const body = (await res.json()) as { endpoints: { method: string; path: string }[] };

    // Spot-check the GET routes with no parameters: a documented path that
    // 404s would be worse than no documentation at all.
    const plainGets = body.endpoints.filter((e) => e.method === "GET" && !e.path.includes("{"));
    expect(plainGets.length).toBeGreaterThan(5);

    for (const endpoint of plainGets) {
      const probe = await app.request(endpoint.path, { headers: { cookie: session } }, env);
      expect(probe.status, `${endpoint.path} should exist`).not.toBe(404);
    }
  });
});
