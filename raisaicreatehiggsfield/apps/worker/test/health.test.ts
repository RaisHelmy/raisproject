import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { createApp } from "../src/app";

describe("app skeleton", () => {
  it("serves health with a request id", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/health", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
  it("returns the error envelope for unknown api routes", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/nope", {}, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});
