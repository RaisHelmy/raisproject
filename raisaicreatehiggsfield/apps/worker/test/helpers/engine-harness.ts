import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext, type ModelDefinition } from "@raisai/shared";
import type { EngineServices, RecordGenerationInput } from "../../src/engine/registry";
import type { AssetHandle, PortValue } from "../../src/engine/values";
import type { CacheStore } from "../../src/engine/execute";
import { FakeAIProvider } from "../../src/providers/fake/fake-provider";
import { ModelSeedService } from "../../src/services/model-seed-service";
import { ModelService } from "../../src/services/model-service";
import { PricingService } from "../../src/services/pricing-service";
import { registerBuiltinNodes } from "../../src/engine/nodes";

export async function testContext(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Engine User").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 100000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

export interface Harness {
  services: EngineServices;
  provider: FakeAIProvider;
  generations: RecordGenerationInput[];
  storedAssets: { name: string; mime: string; bytes: ArrayBuffer }[];
  cache: CacheStore & { hits: number; writes: number };
  fetchCalls: string[];
  connectors: Map<string, { url: string; token?: string }>;
}

/** In-memory engine services: no R2, no asset D1 writes, no real provider. */
export async function makeHarness(overrides: Partial<EngineServices> = {}): Promise<Harness> {
  registerBuiltinNodes();
  await new ModelSeedService(env).seed();
  const modelService = new ModelService(env);
  const pricing = new PricingService(env);
  const provider = new FakeAIProvider();

  const generations: RecordGenerationInput[] = [];
  const storedAssets: { name: string; mime: string; bytes: ArrayBuffer }[] = [];
  const assetBytes = new Map<string, ArrayBuffer>();
  const fetchCalls: string[] = [];
  const connectors = new Map<string, { url: string; token?: string }>();

  const cacheData = new Map<string, Record<string, PortValue>>();
  const cache = {
    hits: 0,
    writes: 0,
    async get(key: string) {
      const hit = cacheData.get(key) ?? null;
      if (hit) cache.hits += 1;
      return hit;
    },
    async set(key: string, outputs: Record<string, PortValue>) {
      cache.writes += 1;
      cacheData.set(key, outputs);
    },
  };

  const services: EngineServices = {
    provider,
    getModel: (id: string): Promise<ModelDefinition> => modelService.getEnabled(id),
    findModels: (capabilities: string[]) => modelService.findCompatible(capabilities as never),
    getConnector: async (id: string) => connectors.get(id) ?? null,
    estimateCost: (model, input) => pricing.estimate(model, input),
    actualCost: (model, usage, fallback) => pricing.actual(model, usage, fallback),
    async storeAsset(input): Promise<AssetHandle> {
      storedAssets.push({ name: input.name, mime: input.mime, bytes: input.bytes });
      const assetId = newId();
      assetBytes.set(assetId, input.bytes);
      return {
        assetId, mime: input.mime, version: 1, name: input.name,
        width: input.width, height: input.height, durationMs: input.durationMs,
      };
    },
    async readAsset(handle) {
      return { bytes: assetBytes.get(handle.assetId) ?? new ArrayBuffer(8), mime: handle.mime };
    },
    async recordGeneration(input) {
      generations.push(input);
      return newId();
    },
    fetch: (async (url: string | URL | Request) => {
      fetchCalls.push(String(url));
      return new Response(JSON.stringify({ ok: true, echoed: String(url) }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch,
    ...overrides,
  };

  return { services, provider, generations, storedAssets, cache, fetchCalls, connectors };
}
