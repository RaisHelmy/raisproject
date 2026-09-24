import { AppError, type AuthContext, type Capability } from "@raisai/shared";
import type { Env } from "../env";
import { workflowDocumentSchema, type WorkflowDocument } from "../engine/document";
import { getNodeDefinition, toPaletteEntry, type NodeDefinition } from "../engine/registry";
import { registerBuiltinNodes } from "../engine/nodes";
import { STUDIO_NODES } from "../engine/nodes/ai-presets";
import { GenerationService, type GenerationResult } from "./generation-service";
import { ModelService } from "./model-service";
import { ProjectService } from "./project-service";
import { WorkflowExecutionService } from "./workflow-execution-service";

export interface StudioInput {
  prompt?: string;
  imageAssetIds?: string[];
  maskAssetId?: string;
  videoAssetId?: string;
  audioAssetId?: string;
  modelId?: string;
  parameters?: Record<string, unknown>;
  projectId?: string;
  idempotencyKey?: string;
}

export interface StudioSummary {
  type: string;
  label: string;
  description: string;
  task?: string;
  requiredCapabilities: string[];
  inputs: ReturnType<typeof toPaletteEntry>["inputs"];
  outputs: ReturnType<typeof toPaletteEntry>["outputs"];
  /** How many enabled models can serve this studio right now. */
  availableModels: number;
}

/**
 * The studio pages (§12): one form per preset, no canvas. Each request
 * becomes the same hidden single-node document the canvas would build, so
 * a studio run is priced, reserved, recorded and retried exactly like a
 * workflow run. A studio with no enabled model is listed as such rather
 * than hidden, so the reason is visible instead of the button missing.
 */
export class StudioService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID"> & Partial<Pick<Env, "RAIS_WORKFLOW_RUN">>) {
    registerBuiltinNodes();
  }

  async list(): Promise<StudioSummary[]> {
    const models = new ModelService(this.env);
    return Promise.all(
      STUDIO_NODES.map(async (node) => {
        const entry = toPaletteEntry(node);
        const capabilities = (node.requiredCapabilities ?? []) as Capability[];
        // Capabilities only, no task: that is exactly how the preset picks a
        // model at run time, so the count here never disagrees with Generate.
        const available = await models.findCompatible(capabilities);
        return {
          type: entry.type,
          label: entry.label,
          description: entry.description,
          task: entry.task,
          requiredCapabilities: capabilities,
          inputs: entry.inputs,
          outputs: entry.outputs,
          availableModels: available.length,
        };
      }),
    );
  }

  async estimate(auth: AuthContext, type: string, input: StudioInput): Promise<{ estimatedSen: number; approximate: boolean; errors: string[] }> {
    const project = await this.project(auth, input.projectId);
    const doc = this.buildDocument(this.requireStudio(type), input);
    const preview = await new WorkflowExecutionService(this.env).preview(auth, doc, {}, project.id);
    return {
      estimatedSen: preview.estimatedSen,
      approximate: preview.approximate,
      errors: preview.errors.map((e) => e.message),
    };
  }

  async run(auth: AuthContext, type: string, input: StudioInput): Promise<GenerationResult> {
    const project = await this.project(auth, input.projectId);
    const doc = this.buildDocument(this.requireStudio(type), input);
    return new GenerationService(this.env).runDocument(auth, doc, project.id, { idempotencyKey: input.idempotencyKey });
  }

  private async project(auth: AuthContext, projectId?: string) {
    const projects = new ProjectService(this.env);
    return projectId ? projects.require(auth, projectId) : projects.getOrCreateDefault(auth);
  }

  private requireStudio(type: string): NodeDefinition {
    const node = getNodeDefinition(type);
    if (!node || !STUDIO_NODES.some((s) => s.type === type)) {
      throw new AppError("not_found", `There is no studio called "${type}".`);
    }
    return node;
  }

  /**
   * The hidden graph: one input node per thing the person supplied, wired
   * into the studio node by port name, and an output node on the studio's
   * first output port.
   */
  buildDocument(studio: NodeDefinition, input: StudioInput): WorkflowDocument {
    const ports = new Set(studio.inputs.map((p) => p.name));
    const nodes: WorkflowDocument["nodes"] = [];
    const edges: WorkflowDocument["edges"] = [];
    let row = 0;
    const place = () => ({ x: 0, y: row++ * 110 });

    const prompt = input.prompt?.trim() ?? "";
    if (ports.has("prompt")) {
      if (!prompt) {
        const port = studio.inputs.find((p) => p.name === "prompt");
        throw new AppError("invalid_input", port?.type === "text" ? "Type the text first." : "Write a prompt first.");
      }
      // The audio presets take plain text on the "prompt" port; a prompt node
      // still produces the right value because "prompt" is text underneath.
      nodes.push({ id: "prompt", type: "prompt", version: 1, config: { template: prompt }, position: place() });
      edges.push({ id: "e-prompt", from: { node: "prompt", port: "prompt" }, to: { node: "studio", port: "prompt" } });
    }

    const images = input.imageAssetIds ?? [];
    if (ports.has("images")) {
      images.forEach((assetId, i) => {
        nodes.push({ id: `image${i}`, type: "input.image", version: 1, config: { assetId, mime: "image/png" }, position: place() });
        edges.push({ id: `e-image${i}`, from: { node: `image${i}`, port: "image" }, to: { node: "studio", port: "images" } });
      });
    } else if (images.length > 0) {
      throw new AppError("invalid_input", `${studio.label} does not take an image.`);
    }

    if (ports.has("mask") && input.maskAssetId) {
      nodes.push({ id: "mask", type: "input.image", version: 1, config: { assetId: input.maskAssetId, mime: "image/png" }, position: place() });
      edges.push({ id: "e-mask", from: { node: "mask", port: "image" }, to: { node: "studio", port: "mask" } });
    }
    if (ports.has("video") && input.videoAssetId) {
      nodes.push({ id: "video", type: "input.video", version: 1, config: { assetId: input.videoAssetId, mime: "video/mp4" }, position: place() });
      edges.push({ id: "e-video", from: { node: "video", port: "video" }, to: { node: "studio", port: "video" } });
    }
    if (ports.has("audio") && input.audioAssetId) {
      nodes.push({ id: "audio", type: "input.audio", version: 1, config: { assetId: input.audioAssetId, mime: "audio/mpeg" }, position: place() });
      edges.push({ id: "e-audio", from: { node: "audio", port: "audio" }, to: { node: "studio", port: "audio" } });
    }

    // Required inputs are checked here so the message names the thing, not a port.
    for (const port of studio.inputs) {
      const supplied =
        port.name === "prompt" ? prompt.length > 0
        : port.name === "images" ? images.length > 0
        : port.name === "mask" ? Boolean(input.maskAssetId)
        : port.name === "video" ? Boolean(input.videoAssetId)
        : port.name === "audio" ? Boolean(input.audioAssetId)
        : true;
      if (!supplied && port.name !== "prompt" && port.name !== "mask") {
        const thing = port.label.toLowerCase();
        const article = /^[aeiou]/.test(thing) ? "an" : "a";
        throw new AppError("invalid_input", `${studio.label} needs ${article} ${thing}.`, { action: `Choose ${article} ${thing} first.` });
      }
    }

    nodes.push({
      id: "studio", type: studio.type, version: studio.version,
      config: { modelId: input.modelId ?? "", parameters: input.parameters ?? {} },
      position: { x: 260, y: 0 },
    });

    const out = studio.outputs[0];
    if (!out) throw new AppError("internal", `${studio.label} has no output.`);
    nodes.push({ id: "output", type: "output", version: 1, config: { name: out.name }, position: { x: 520, y: 0 } });
    edges.push({ id: "e-out", from: { node: "studio", port: out.name }, to: { node: "output", port: "value" } });

    return workflowDocumentSchema.parse({
      version: 1, nodes, edges, variables: [],
      settings: { cache: false, maxParallel: 1 },
      meta: { name: `Studio · ${studio.label}` },
    });
  }
}
