import { newId, type AuthContext, type ModelDefinition } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import type { EngineServices, RecordGenerationInput } from "../engine/registry";
import type { AssetHandle } from "../engine/values";
import { AssetService } from "./asset-service";
import { ConnectorService } from "./connector-service";
import { ModelService } from "./model-service";
import { PricingService } from "./pricing-service";
import { CloudflareAIProvider } from "../providers/cloudflare/cloudflare-provider";
import type { AIProvider } from "../providers/types";

export interface BuildEngineServicesOptions {
  auth: AuthContext;
  projectId: string;
  workflowRunId: string;
  /** Swapped for FakeAIProvider in tests. */
  provider?: AIProvider;
}

/**
 * Binds the pure engine to real infrastructure: D1 for generation records,
 * R2 for outputs, the model registry and pricing. Everything the engine needs
 * arrives through this one seam, which is what keeps the engine testable.
 */
export function buildEngineServices(
  env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "EVENTS" | "IMAGES">>,
  options: BuildEngineServicesOptions,
): EngineServices {
  const models = new ModelService(env);
  const pricing = new PricingService(env);
  const assets = new AssetService(env);
  const provider = options.provider ?? new CloudflareAIProvider(env);
  const { auth, projectId, workflowRunId } = options;

  return {
    provider,
    getModel: (id: string): Promise<ModelDefinition> => models.getEnabled(id),
    findModels: (capabilities: string[]) => models.findCompatible(capabilities as never),

    // Goes through the service so the stored token is decrypted the one place
    // that knows how, and so ownership is checked the same way everywhere.
    getConnector: (id: string) => new ConnectorService(env).resolve(auth, id),
    estimateCost: (model, input) => pricing.estimate(model, input),
    actualCost: (model, usage, fallback) => pricing.actual(model, usage, fallback),

    async storeAsset(input): Promise<AssetHandle> {
      const asset = await assets.create(auth, {
        projectId,
        name: input.name,
        mime: input.mime,
        bytes: input.bytes,
        source: "generation",
        generationId: input.generationId,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
      });
      // Thumbnailing happens off the critical path so a generation never waits
      // on it (§114, §116).
      if (asset.mime.startsWith("image/") && env.EVENTS) {
        const version = await assets.getVersion(auth, asset.id);
        await env.EVENTS.send({
          kind: "thumbnail", assetId: asset.id, orgId: auth.orgId, projectId,
          version: asset.current_version, r2Key: version.r2_key, mime: asset.mime,
        }).catch(() => undefined);
      }

      return {
        assetId: asset.id,
        version: asset.current_version,
        mime: asset.mime,
        name: asset.name,
        ...(asset.width !== null ? { width: asset.width } : {}),
        ...(asset.height !== null ? { height: asset.height } : {}),
        ...(asset.duration_ms !== null ? { durationMs: asset.duration_ms } : {}),
      };
    },

    async readAsset(handle) {
      return assets.readBytes(auth, handle.assetId, handle.version);
    },

    async recordGeneration(input: RecordGenerationInput): Promise<string> {
      const generationId = newId();
      const now = nowIso();
      await env.DB
        .prepare(
          `INSERT INTO generations (id, org_id, project_id, user_id, model_id, task, status,
             input_json, parameters_json, estimated_cost_sen, actual_cost_sen, cost_basis,
             provider_cost_micro_usd, provider_request_id, error_code, error_message,
             workflow_run_id, node_run_id, request_id, started_at, completed_at, duration_ms, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          generationId, auth.orgId, projectId, auth.userId, input.modelId, input.task, input.status,
          JSON.stringify(input.input), JSON.stringify(input.parameters),
          input.estimatedCostSen, input.actualCostSen ?? null, input.costBasis,
          input.providerCostMicroUsd ?? null, input.providerRequestId ?? null,
          input.error?.code ?? null, input.error?.message ?? null,
          workflowRunId, input.nodeRunId, auth.requestId,
          new Date(Date.now() - input.durationMs).toISOString(), now, input.durationMs, now,
        )
        .run();

      // Output assets are linked so history can show a thumbnail per generation.
      for (const [port, value] of Object.entries(input.outputs ?? {})) {
        const isAsset = typeof value === "object" && value !== null && "assetId" in value;
        await env.DB
          .prepare(`INSERT INTO generation_outputs (generation_id, port, asset_id, value_json) VALUES (?,?,?,?)`)
          .bind(
            generationId, port,
            isAsset ? (value as AssetHandle).assetId : null,
            isAsset ? null : JSON.stringify(value),
          )
          .run();
        if (isAsset) {
          await env.DB
            .prepare(`UPDATE assets SET generation_id = ? WHERE id = ? AND org_id = ?`)
            .bind(generationId, (value as AssetHandle).assetId, auth.orgId)
            .run();
        }
      }
      return generationId;
    },

    // Only offered when the Images binding is configured, so the node can
    // report the real reason rather than a cryptic failure (§112).
    ...(env.IMAGES ? { transformImage: imageTransformer(env.IMAGES) } : {}),

    fetch: globalThis.fetch.bind(globalThis),
  };
}

function imageTransformer(images: ImagesBinding): NonNullable<EngineServices["transformImage"]> {
  return async (input, options) => {
    const { format, quality, ...transform } = options;
    const params = Object.fromEntries(Object.entries(transform).filter(([, v]) => v !== undefined));

    let handle = images.input(new Response(input.bytes).body!);
    if (Object.keys(params).length > 0) handle = handle.transform(params as never);
    const output = await handle.output({ format, ...(quality !== undefined ? { quality } : {}) } as never);
    const bytes = await output.response().arrayBuffer();

    let width: number | undefined;
    let height: number | undefined;
    try {
      const info = await images.info(new Response(bytes).body!);
      if ("width" in info) {
        width = info.width;
        height = info.height;
      }
    } catch {
      // Dimensions are a nicety for the next node; the transform itself succeeded.
    }
    return { bytes, mime: format, width, height };
  };
}
