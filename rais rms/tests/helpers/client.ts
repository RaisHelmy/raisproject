import { app } from "../../api/app";
import type { Bindings } from "../../api/types";
import { createTestD1 } from "./d1-shim";
import { createTestR2 } from "./r2-shim";

export function testEnv(): Bindings {
  return {
    DB: createTestD1(),
    // Unused in tests: `app.request()` calls the Hono app directly, bypassing
    // functions/api/[[route]].ts (the only place HYPERDRIVE is read) entirely.
    HYPERDRIVE: { connectionString: "" } as Hyperdrive,
    BUCKET: createTestR2(),
    APP_ENV: "test",
    JWT_SECRET: "test-secret-do-not-use-in-prod",
  };
}

export class TestClient {
  private cookie: string | null = null;

  constructor(private readonly env: Bindings) {}

  async request(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookie) headers["Cookie"] = this.cookie;

    const res = await app.request(
      path,
      { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined },
      this.env,
    );

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0] ?? null;
    }
    return res;
  }

  get(path: string) {
    return this.request("GET", path);
  }
  post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }
  patch(path: string, body?: unknown) {
    return this.request("PATCH", path, body);
  }

  async putBinary(path: string, bytes: Uint8Array, contentType: string): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
    };
    if (this.cookie) headers["Cookie"] = this.cookie;

    const res = await app.request(path, { method: "PUT", headers, body: bytes as BodyInit }, this.env);
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? null;
    return res;
  }
}

export async function registerTenant(
  client: TestClient,
  overrides: Partial<{
    tenantName: string;
    tenantSlug: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
    outletName: string;
    timezone: string;
    currency: string;
  }> = {},
) {
  const body = {
    tenantName: "Test Bistro",
    tenantSlug: `test-bistro-${Math.random().toString(36).slice(2, 8)}`,
    ownerName: "Owner Person",
    ownerEmail: `owner-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "supersecret123",
    outletName: "Main Outlet",
    timezone: "UTC",
    currency: "USD",
    ...overrides,
  };
  const res = await client.post("/api/auth/register", body);
  const json = (await res.json()) as any;
  return { res, json, body };
}
