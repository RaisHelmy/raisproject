import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { LedgerService } from "../src/services/ledger-service";
import { resetRateLimits } from "../src/middleware/rate-limit";
import { MCP_TOOLS } from "../src/mcp/tools";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

function stubEnv() {
  return { ...env, AI: { run: async () => ({ image: "aGk=" }) } as unknown as Ai };
}

async function agentToken(scopes: string[]) {
  const testEnv = stubEnv();
  const app = createApp();
  const signup = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `mcp-${newId()}@example.com`, password: "password123", name: "Agent Owner" }),
    },
    testEnv,
  );
  const setCookies = signup.headers.getSetCookie();
  const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
  const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
  const { orgId } = (await signup.json()) as { orgId: string };

  const issued = await app.request(
    "/api/v1/mcp-tokens",
    {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name: "agent", scopes }),
    },
    testEnv,
  );
  const issuedBody = (await issued.json()) as { secret?: string; error?: { message: string } };
  if (!issuedBody.secret) {
    throw new Error(`token not issued: ${issuedBody.error?.message ?? issued.status}`);
  }
  return { app, testEnv, secret: issuedBody.secret, orgId };
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: { code: string; action?: string } };
}

async function rpc(
  app: ReturnType<typeof createApp>,
  testEnv: typeof env,
  secret: string,
  method: string,
  params?: Record<string, unknown>,
  id: number | string | null = 1,
): Promise<{ status: number; body: RpcResponse | null }> {
  const res = await app.request(
    "/api/v1/mcp",
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
    },
    testEnv,
  );
  return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as RpcResponse) };
}

describe("MCP server", () => {
  beforeEach(() => resetRateLimits());

  it("initializes and states that generations spend real money", async () => {
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const { body } = await rpc(app, testEnv, secret, "initialize");
    const result = body!.result as { protocolVersion: string; instructions: string };

    expect(result.protocolVersion).toBeTruthy();
    // An agent must know spending is real before it plans a run.
    expect(result.instructions).toContain("prepaid balance");
  });

  it("advertises only the tools this token can actually use", async () => {
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const { body } = await rpc(app, testEnv, secret, "tools/list");
    const tools = (body!.result as { tools: { name: string }[] }).tools.map((t) => t.name);

    expect(tools).toContain("list_models");
    // No generations:write scope, so the agent is never offered the tool.
    expect(tools).not.toContain("create_generation");
    expect(tools.length).toBeLessThan(MCP_TOOLS.length);
  });

  it("lists models with a price an agent can reason about", async () => {
    await new ModelSeedService(env).seed();
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const { body } = await rpc(app, testEnv, secret, "tools/call", { name: "list_models", arguments: { category: "image" } });
    const models = (body!.result as { structuredContent: { id: string; typicalCost?: string }[] }).structuredContent;

    expect(models.length).toBeGreaterThan(0);
    expect(models[0]!.typicalCost).toMatch(/^RM/);
  });

  it("refuses a tool the token has no scope for", async () => {
    await new ModelSeedService(env).seed();
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const { body } = await rpc(app, testEnv, secret, "tools/call", {
      name: "create_generation",
      arguments: { modelId: FLUX, prompt: "should be refused" },
    });

    const error = body!.error!;
    expect(error.data?.code).toBe("insufficient_scope");
    expect(error.message).toContain("generations:write");
  });

  it("generates through the same service the web app uses, and charges for it", async () => {
    await new ModelSeedService(env).seed();
    const { app, testEnv, secret, orgId } = await agentToken(["models:read", "generations:write", "projects:read"]);
    const ledger = new LedgerService(env);
    await ledger.deposit(orgId, 5000);
    const before = await ledger.getBalance(orgId);

    const { body } = await rpc(app, testEnv, secret, "tools/call", {
      name: "create_generation",
      arguments: { modelId: FLUX, prompt: "an agent-made image" },
    });
    const generation = (body!.result as { structuredContent: { status: string; chargedSen: number } }).structuredContent;

    expect(generation.status).toBe("completed");
    const after = await ledger.getBalance(orgId);
    expect(after.availableSen).toBe(before.availableSen - generation.chargedSen);
  });

  it("enforces balance for an agent exactly as for a person", async () => {
    await new ModelSeedService(env).seed();
    const { app, testEnv, secret } = await agentToken(["models:read", "generations:write", "projects:read"]);
    // No deposit: the workspace has nothing to spend.
    const { body } = await rpc(app, testEnv, secret, "tools/call", {
      name: "create_generation",
      arguments: { modelId: "@cf/leonardo/lucid-origin", prompt: "expensive" },
    });

    const error = body!.error!;
    expect(error.data?.code).toBe("insufficient_balance");
  });

  it("reports balance in ringgit, not credits", async () => {
    const { app, testEnv, secret, orgId } = await agentToken(["billing:read"]);
    await new LedgerService(env).deposit(orgId, 4962);
    const { body } = await rpc(app, testEnv, secret, "tools/call", { name: "get_balance", arguments: {} });
    const balance = (body!.result as { structuredContent: { available: string; currency: string } }).structuredContent;

    expect(balance.available).toBe("RM49.62");
    expect(balance.currency).toBe("MYR");
  });

  it("cannot see another workspace's work", async () => {
    await new ModelSeedService(env).seed();
    const owner = await agentToken(["models:read", "generations:write", "generations:read", "projects:read"]);
    await new LedgerService(env).deposit(owner.orgId, 5000);
    const created = await rpc(owner.app, owner.testEnv, owner.secret, "tools/call", {
      name: "create_generation",
      arguments: { modelId: FLUX, prompt: "private work" },
    });
    const generationId = (created.body!.result as { structuredContent: { id: string } }).structuredContent.id;

    const stranger = await agentToken(["generations:read"]);
    const { body } = await rpc(stranger.app, stranger.testEnv, stranger.secret, "tools/call", {
      name: "get_generation",
      arguments: { generationId },
    });
    expect(body!.error!.data?.code).toBe("not_found");
  });

  it("rejects an API key on the MCP endpoint", async () => {
    const testEnv = stubEnv();
    const app = createApp();
    const signup = await app.request(
      "/api/v1/auth/signup",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `x-${newId()}@example.com`, password: "password123", name: "X" }),
      },
      testEnv,
    );
    const setCookies = signup.headers.getSetCookie();
    const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
    const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
    const key = await app.request(
      "/api/v1/api-keys",
      { method: "POST", headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ name: "k", scopes: ["models:read"] }) },
      testEnv,
    );
    const { secret } = (await key.json()) as { secret: string };

    const res = await app.request(
      "/api/v1/mcp",
      {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      },
      testEnv,
    );
    expect(res.status).toBe(403);
  });

  it("answers a batch and stays silent on notifications", async () => {
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const res = await app.request(
      "/api/v1/mcp",
      {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 1, method: "ping" },
          { jsonrpc: "2.0", method: "notifications/initialized" },
        ]),
      },
      testEnv,
    );
    const body = (await res.json()) as unknown[];
    // Two requests in, one reply out: a notification expects none.
    expect(body).toHaveLength(1);
  });

  it("returns a JSON-RPC error for an unknown method rather than a crash", async () => {
    const { app, testEnv, secret } = await agentToken(["models:read"]);
    const { body } = await rpc(app, testEnv, secret, "does/not/exist");
    expect(body!.error!.code).toBe(-32601);
  });
});
