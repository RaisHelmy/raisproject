import { AppError, formatMYR, hasScope, type AuthContext, type Scope } from "@raisai/shared";
import type { Env } from "../env";
import { ModelService } from "../services/model-service";
import { PricingService } from "../services/pricing-service";
import { GenerationService } from "../services/generation-service";
import { TemplateService } from "../services/template-service";
import { WorkflowService } from "../services/workflow-service";
import { WorkflowExecutionService } from "../services/workflow-execution-service";
import { AssetService } from "../services/asset-service";
import { LedgerService } from "../services/ledger-service";
import { ProjectService } from "../services/project-service";
import { toModelDTO } from "../dto/model";
import { toGenerationDTO } from "../dto/generation";

export type McpEnv = Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "RAIS_WORKFLOW_RUN">>;

export interface McpTool {
  name: string;
  title: string;
  description: string;
  scope: Scope;
  inputSchema: Record<string, unknown>;
  handler(env: McpEnv, auth: AuthContext, args: Record<string, unknown>): Promise<unknown>;
}

const str = (description: string, required = false) => ({ type: "string", description, ...(required ? {} : {}) });
const num = (description: string) => ({ type: "number", description });

function object(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

/**
 * Reads a required string argument. Without this, a caller that omits or
 * misnames a field (say `inputs.prompt` instead of `prompt`) had it silently
 * coerced by `String(undefined)` into the literal text "undefined" — which
 * was then persisted as the prompt and sent to the provider to be paid for.
 * A missing required field is a validation error, not a generation.
 */
function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("invalid_input", `"${key}" is required and must be a non-empty string.`, {
      action: `Pass "${key}" as a top-level tool argument.`,
    });
  }
  return value;
}

/** Reads an optional string argument, treating blank as absent. */
function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * MCP tools (§57). Every one calls the same application service the web app
 * and REST API use, so an agent cannot reach behaviour that bypasses balance,
 * ownership or model rules (§59, §161).
 */
export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_models",
    title: "List models",
    description: "Lists the AI models available to this workspace, with what each can do and what a typical request costs.",
    scope: "models:read",
    inputSchema: object({
      category: str("Filter by image, video, audio, text, vision or embedding."),
      capability: str("Only models with this capability, e.g. image-input."),
    }),
    async handler(env, _auth, args) {
      const models = await new ModelService(env).list({
        category: args.category as never,
        capabilities: args.capability ? [args.capability as never] : undefined,
      });
      const pricing = new PricingService(env);
      return Promise.all(
        models.map(async (model) => {
          const dto = toModelDTO(model);
          try {
            const estimate = await pricing.estimate(model, { prompt: "a sample prompt" });
            return { ...dto, typicalCost: formatMYR(estimate.estimatedSen), typicalCostSen: estimate.estimatedSen };
          } catch {
            return dto;
          }
        }),
      );
    },
  },
  {
    name: "get_model",
    title: "Get model",
    description: "Full details of one model: its inputs, parameters and limits.",
    scope: "models:read",
    inputSchema: object({ modelId: str("The model id, e.g. @cf/black-forest-labs/flux-1-schnell", true) }, ["modelId"]),
    async handler(env, _auth, args) {
      return toModelDTO(await new ModelService(env).getEnabled(String(args.modelId)));
    },
  },
  {
    name: "estimate_cost",
    title: "Estimate cost",
    description: "What a generation would cost, before running it.",
    scope: "models:read",
    inputSchema: object(
      { modelId: str("Model to price", true), prompt: str("The prompt"), durationSeconds: num("Video duration") },
      ["modelId"],
    ),
    async handler(env, _auth, args) {
      const model = await new ModelService(env).getEnabled(String(args.modelId));
      const estimate = await new PricingService(env).estimate(model, {
        prompt: args.prompt ? String(args.prompt) : undefined,
        durationSeconds: typeof args.durationSeconds === "number" ? args.durationSeconds : undefined,
      });
      return { estimatedSen: estimate.estimatedSen, estimated: formatMYR(estimate.estimatedSen), approximate: estimate.approximate, currency: "MYR" };
    },
  },
  {
    name: "create_generation",
    title: "Create a generation",
    description: "Generates an image, video, speech or text with a chosen model. Charges the workspace balance.",
    scope: "generations:write",
    inputSchema: object(
      {
        modelId: str("Model to run", true),
        prompt: str("What to create", true),
        negativePrompt: str("What to avoid"),
        projectId: str("Project to file it under; defaults to the first project"),
      },
      ["modelId", "prompt"],
    ),
    async handler(env, auth, args) {
      const result = await new GenerationService(env).create(auth, {
        modelId: requireString(args, "modelId"),
        prompt: requireString(args, "prompt"),
        negativePrompt: optionalString(args, "negativePrompt"),
        projectId: optionalString(args, "projectId"),
      });
      return {
        ...toGenerationDTO(result.generation, result.outputs),
        charged: result.generation.actual_cost_sen !== null ? formatMYR(result.generation.actual_cost_sen) : null,
        balanceAfter: formatMYR(result.balanceAfterSen),
      };
    },
  },
  {
    name: "get_generation",
    title: "Get a generation",
    description: "Looks up one generation and its outputs.",
    scope: "generations:read",
    inputSchema: object({ generationId: str("The generation id", true) }, ["generationId"]),
    async handler(env, auth, args) {
      const { generation, outputs } = await new GenerationService(env).get(auth, String(args.generationId));
      return toGenerationDTO(generation, outputs);
    },
  },
  {
    name: "cancel_generation",
    title: "Cancel a generation",
    description: "Asks a generation that is still running to stop. Anything the provider already produced is still charged.",
    scope: "generations:write",
    inputSchema: object({ generationId: str("The generation id", true) }, ["generationId"]),
    async handler(env, auth, args) {
      const { generation } = await new GenerationService(env).get(auth, String(args.generationId));
      if (!generation.workflow_run_id) {
        throw new AppError("invalid_input", "That generation is not running.", { action: "Nothing to stop." });
      }
      return new WorkflowExecutionService(env).cancel(auth, generation.workflow_run_id);
    },
  },
  {
    name: "list_generations",
    title: "List generations",
    description: "Recent generations in this workspace.",
    scope: "generations:read",
    inputSchema: object({ limit: num("How many to return, up to 100") }),
    async handler(env, auth, args) {
      const { items } = await new GenerationService(env).list(auth, {
        limit: typeof args.limit === "number" ? args.limit : 20,
      });
      return items.map((i) => toGenerationDTO(i.generation, i.outputs));
    },
  },
  {
    name: "list_templates",
    title: "List templates",
    description: "Reusable workflows this workspace can run, with their inputs and cost.",
    scope: "templates:read",
    inputSchema: object({}),
    async handler(env, auth) {
      const list = await new TemplateService(env).list(auth, { includePublic: true });
      return list.map((t) => ({
        id: t.id, name: t.name, description: t.description,
        estimatedCostSen: t.estimated_cost_sen, version: t.current_version, usageCount: t.usage_count,
      }));
    },
  },
  {
    name: "get_template",
    title: "Get a template",
    description: "A template's details, including the inputs it needs.",
    scope: "templates:read",
    inputSchema: object({ templateId: str("The template id", true) }, ["templateId"]),
    async handler(env, auth, args) {
      const { template, variables } = await new TemplateService(env).requireTemplate(auth, String(args.templateId));
      return {
        id: template.id, name: template.name, description: template.description,
        version: template.current_version, estimatedCostSen: template.estimated_cost_sen, variables,
      };
    },
  },
  {
    name: "execute_template",
    title: "Run a template",
    description: "Runs a template with the given inputs. Charges the workspace balance.",
    scope: "templates:execute",
    inputSchema: object(
      { templateId: str("Template to run", true), variables: { type: "object", description: "Values for the template's declared inputs" } },
      ["templateId"],
    ),
    async handler(env, auth, args) {
      const projectId = (await new ProjectService(env).getOrCreateDefault(auth)).id;
      const run = await new TemplateService(env).execute(
        auth,
        String(args.templateId),
        (args.variables as Record<string, unknown>) ?? {},
        { projectId },
      );
      return {
        workflowRunId: run.id, status: run.status, outputs: run.outputs,
        charged: formatMYR(run.actualCostSen), chargedSen: run.actualCostSen,
        ...(run.error ? { error: run.error } : {}),
      };
    },
  },
  {
    name: "list_workflows",
    title: "List workflows",
    description: "Workflows in this workspace.",
    scope: "workflows:read",
    inputSchema: object({}),
    async handler(env, auth) {
      const list = await new WorkflowService(env).list(auth);
      return list.map((w) => ({ id: w.id, name: w.name, description: w.description, version: w.current_version }));
    },
  },
  {
    name: "execute_workflow",
    title: "Run a workflow",
    description: "Runs a workflow with the given inputs. Charges the workspace balance.",
    scope: "workflows:execute",
    inputSchema: object(
      { workflowId: str("Workflow to run", true), variables: { type: "object", description: "Workflow input values" } },
      ["workflowId"],
    ),
    async handler(env, auth, args) {
      const service = new WorkflowService(env);
      const { workflow } = await service.get(auth, String(args.workflowId));
      const frozen = await service.freezeVersion(auth, workflow.id);
      const run = await new WorkflowExecutionService(env).start(auth, {
        doc: frozen.document,
        workflowId: workflow.id,
        workflowVersionId: frozen.versionId,
        projectId: workflow.project_id,
        variables: (args.variables as Record<string, unknown>) ?? {},
        trigger: "mcp",
      });
      return {
        workflowRunId: run.id, status: run.status, outputs: run.outputs,
        charged: formatMYR(run.actualCostSen), chargedSen: run.actualCostSen,
      };
    },
  },
  {
    name: "get_workflow_run",
    title: "Get a workflow run",
    description: "Status, outputs and cost of one run.",
    scope: "workflows:read",
    inputSchema: object({ workflowRunId: str("The run id", true) }, ["workflowRunId"]),
    async handler(env, auth, args) {
      const run = await new WorkflowExecutionService(env).get(auth, String(args.workflowRunId));
      return {
        id: run.id, status: run.status, outputs: run.outputs,
        chargedSen: run.actualCostSen, charged: formatMYR(run.actualCostSen),
        nodes: run.nodes.map((n) => ({ nodeId: n.nodeId, status: n.status, error: n.error ?? null })),
      };
    },
  },
  {
    name: "list_assets",
    title: "List assets",
    description: "Files in this workspace: generated images, video, audio and uploads.",
    scope: "assets:read",
    inputSchema: object({ kind: str("image, video, audio or document"), limit: num("How many, up to 100") }),
    async handler(env, auth, args) {
      const { items } = await new AssetService(env).list(auth, {
        kind: args.kind as never,
        limit: typeof args.limit === "number" ? args.limit : 25,
      });
      return items.map((a) => ({
        id: a.id, name: a.name, kind: a.kind, mime: a.mime,
        width: a.width, height: a.height, durationMs: a.duration_ms,
        url: `/api/v1/assets/${a.id}/content`, createdAt: a.created_at,
      }));
    },
  },
  {
    name: "get_asset",
    title: "Get an asset",
    description: "Details of one file.",
    scope: "assets:read",
    inputSchema: object({ assetId: str("The asset id", true) }, ["assetId"]),
    async handler(env, auth, args) {
      const asset = await new AssetService(env).require(auth, String(args.assetId));
      return {
        id: asset.id, name: asset.name, kind: asset.kind, mime: asset.mime,
        width: asset.width, height: asset.height, durationMs: asset.duration_ms,
        url: `/api/v1/assets/${asset.id}/content`, createdAt: asset.created_at,
      };
    },
  },
  {
    name: "get_balance",
    title: "Get balance",
    description: "How much prepaid balance is left, and how much is held for work in progress.",
    scope: "billing:read",
    inputSchema: object({}),
    async handler(env, auth) {
      const balance = await new LedgerService(env).getBalance(auth.orgId);
      return {
        available: formatMYR(balance.availableSen),
        availableSen: balance.availableSen,
        heldForRunningWork: formatMYR(balance.reservedSen),
        currency: "MYR",
      };
    },
  },
  {
    name: "get_usage",
    title: "Get usage",
    description: "What this workspace has spent recently, by day.",
    scope: "billing:read",
    inputSchema: object({ days: num("How many days back, default 30") }),
    async handler(env, auth, args) {
      const days = typeof args.days === "number" ? Math.min(Math.max(args.days, 1), 365) : 30;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { results } = await env.DB
        .prepare(
          `SELECT substring(created_at,1,10) AS day, COUNT(*) AS generations, COALESCE(SUM(actual_cost_sen),0) AS spent_sen
             FROM generations WHERE org_id = ? AND created_at >= ? GROUP BY day ORDER BY day DESC`,
        )
        .bind(auth.orgId, since)
        .all<{ day: string; generations: number; spent_sen: number }>();
      const totalSen = results.reduce((sum, r) => sum + r.spent_sen, 0);
      return { days, totalSpent: formatMYR(totalSen), totalSpentSen: totalSen, byDay: results };
    },
  },
];

export function findTool(name: string): McpTool {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new AppError("not_found", `No tool named "${name}".`);
  return tool;
}

/** Scope check applied before any tool runs (§59). */
export function assertToolAllowed(auth: AuthContext, tool: McpTool): void {
  if (!hasScope(auth, tool.scope)) {
    throw new AppError("insufficient_scope", `This token cannot use ${tool.name}. It needs the ${tool.scope} scope.`, {
      action: "Create a token with that scope.",
    });
  }
}
