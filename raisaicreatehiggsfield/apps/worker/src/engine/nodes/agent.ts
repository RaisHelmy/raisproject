import { z } from "zod";
import { AppError, type ModelDefinition } from "@raisai/shared";
import { registerNode, type NodeDefinition, type NodeRuntimeContext } from "../registry";
import { asText, type AssetHandle, type PortValue } from "../values";

/**
 * A plan the agent must produce before it may spend anything.
 *
 * Planning first, then executing, is what makes the budget enforceable: the
 * whole plan is priced before a single step runs, so the node can refuse or
 * trim rather than discovering the cost halfway through (§138, §139).
 */
const planSchema = z.object({
  reasoning: z.string().default(""),
  steps: z
    .array(
      z.object({
        kind: z.enum(["image", "text", "speech"]),
        prompt: z.string().min(1),
        why: z.string().default(""),
      }),
    )
    .min(1),
});

type Plan = z.infer<typeof planSchema>;

const configSchema = z.object({
  goal: z.string().min(1, "Give the agent a goal."),
  plannerModelId: z.string().optional(),
  /** A hard ceiling. The agent stops rather than exceeding it. */
  maxCostSen: z.number().int().positive().default(200),
  maxSteps: z.number().int().min(1).max(10).default(4),
});

const MAX_STEPS = 10;

function planPrompt(goal: string, maxSteps: number, budgetSen: number): string {
  return [
    "You are planning work for a media generation system. Break the goal into concrete steps.",
    "",
    `Goal: ${goal}`,
    `You may plan at most ${maxSteps} steps, and the whole plan must cost under RM${(budgetSen / 100).toFixed(2)}.`,
    "Prefer fewer, better steps over many cheap ones.",
    "",
    "Each step is one of:",
    '  "image"  - generate a picture from a prompt',
    '  "text"   - write something from a prompt',
    '  "speech" - speak a piece of text',
    "",
    "Reply with JSON only:",
    '{ "reasoning": "why this plan", "steps": [{ "kind": "image", "prompt": "...", "why": "..." }] }',
  ].join("\n");
}

const agentNode: NodeDefinition = {
  type: "agent",
  version: 1,
  category: "ai",
  label: "Agent",
  description: "Works towards a goal in a few steps, never spending more than its budget.",
  inputs: [{ name: "context", type: "text", label: "Context" }],
  outputs: [
    { name: "results", type: "array", label: "Results" },
    { name: "plan", type: "json", label: "Plan" },
    { name: "summary", type: "text", label: "Summary" },
  ],
  configSchema,

  async estimate(ctx) {
    const config = configSchema.parse(ctx.config);
    // The budget is the honest estimate: an agent decides its own work, so the
    // ceiling is the only number that can be promised in advance.
    return { estimatedSen: config.maxCostSen, approximate: true };
  },

  async execute(ctx) {
    const config = configSchema.parse(ctx.config);
    const context = asText(ctx.inputs.context);
    const goal = context ? `${config.goal}\n\nContext: ${context}` : config.goal;

    const planner = await this.resolvePlanner(ctx, config.plannerModelId);
    const plan = await this.makePlan(ctx, planner, goal, config);

    const results: PortValue[] = [];
    const summary: string[] = [];
    let spentSen = 0;
    let stopped: string | null = null;

    for (const [index, step] of plan.steps.slice(0, Math.min(config.maxSteps, MAX_STEPS)).entries()) {
      const model = await this.modelFor(ctx, step.kind);
      const input = step.kind === "speech" ? { text: step.prompt } : { prompt: step.prompt };
      const estimate = await ctx.services.estimateCost(model, input);

      // Checked before the call, not after: an agent that discovers it is over
      // budget once the money is gone has not respected the budget at all.
      if (spentSen + estimate.estimatedSen > config.maxCostSen) {
        stopped = `Stopped before step ${index + 1}: it would have gone over the budget.`;
        break;
      }

      const job = await ctx.services.provider.execute(model, input, { requestId: ctx.auth.requestId, signal: ctx.signal });
      if (job.status === "failed" || !job.output) {
        stopped = `Step ${index + 1} failed: ${job.error?.message ?? "no result"}.`;
        break;
      }

      const cost = await ctx.services.actualCost(model, job.usage, estimate);
      spentSen += cost.actualSen;

      if (job.output.image?.bytes) {
        results.push(
          (await ctx.services.storeAsset({
            name: `${ctx.nodeId}-step${index + 1}.png`,
            mime: job.output.image.mime,
            bytes: job.output.image.bytes,
            width: job.output.image.width,
            height: job.output.image.height,
          })) as unknown as AssetHandle,
        );
      } else if (job.output.audio?.bytes) {
        results.push(
          (await ctx.services.storeAsset({
            name: `${ctx.nodeId}-step${index + 1}.mp3`,
            mime: job.output.audio.mime,
            bytes: job.output.audio.bytes,
            durationMs: job.output.audio.durationMs,
          })) as unknown as AssetHandle,
        );
      } else if (job.output.text !== undefined) {
        results.push(job.output.text);
      }

      summary.push(`${index + 1}. ${step.kind}: ${step.why || step.prompt}`);

      await ctx.services.recordGeneration({
        modelId: model.id, task: model.task, input: { prompt: step.prompt }, parameters: {},
        status: "completed", estimatedCostSen: estimate.estimatedSen, actualCostSen: cost.actualSen,
        costBasis: cost.basis, providerCostMicroUsd: cost.providerCostMicroUsd,
        providerRequestId: job.providerRequestId, durationMs: 0, nodeRunId: ctx.nodeRunId,
      });
    }

    return {
      outputs: {
        results,
        plan: plan as unknown as PortValue,
        summary: [plan.reasoning, ...summary, stopped].filter(Boolean).join("\n"),
      },
      actualCostSen: spentSen,
    };
  },

  /** @internal */
  async resolvePlanner(ctx: NodeRuntimeContext, modelId?: string): Promise<ModelDefinition> {
    if (modelId) return ctx.services.getModel(modelId);
    throw new AppError("invalid_input", "The agent has no planning model selected.", {
      action: "Choose a text model for the agent to plan with.",
    });
  },

  /** @internal */
  async makePlan(ctx: NodeRuntimeContext, planner: ModelDefinition, goal: string, config: z.infer<typeof configSchema>): Promise<Plan> {
    const job = await ctx.services.provider.execute(
      planner,
      { prompt: planPrompt(goal, config.maxSteps, config.maxCostSen), maxTokens: 1024 },
      { requestId: ctx.auth.requestId, signal: ctx.signal },
    );
    if (job.status === "failed" || job.output?.text === undefined) {
      throw new AppError("provider_error", "The agent could not plan its work.", {
        action: "Try again, or choose a different planning model.",
      });
    }

    const { extractJson } = await import("../../services/story-schema");
    const parsed = planSchema.safeParse(extractJson(job.output.text));
    if (!parsed.success) {
      throw new AppError("provider_error", "The agent's plan could not be read.", {
        action: "Try again, or choose a stronger planning model.",
      });
    }
    return parsed.data;
  },

  /** @internal */
  async modelFor(ctx: NodeRuntimeContext, kind: "image" | "text" | "speech"): Promise<ModelDefinition> {
    const capability = kind === "image" ? "text-to-image" : kind === "speech" ? "text-to-speech" : "text-generation";
    const options = await ctx.services.findModels([capability]);
    if (options[0]) return options[0];

    throw new AppError("model_not_enabled", `No ${kind} model is available for the agent.`, {
      action: "Ask an administrator to enable one.",
    });
  },
} as NodeDefinition & {
  resolvePlanner(ctx: NodeRuntimeContext, modelId?: string): Promise<ModelDefinition>;
  makePlan(ctx: NodeRuntimeContext, planner: ModelDefinition, goal: string, config: z.infer<typeof configSchema>): Promise<Plan>;
  modelFor(ctx: NodeRuntimeContext, kind: "image" | "text" | "speech"): Promise<ModelDefinition>;
};

export function registerAgentNode(): void {
  registerNode(agentNode);
}

export { planSchema };
