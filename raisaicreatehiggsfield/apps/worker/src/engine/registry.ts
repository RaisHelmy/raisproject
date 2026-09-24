import type { AuthContext, ModelDefinition, PortType, Sen } from "@raisai/shared";
import type { z } from "zod";
import type { AIProvider, CanonicalInput, ProviderUsage } from "../providers/types";
import type { CostEstimate } from "../services/pricing-service";
import type { AssetHandle, PortValue } from "./values";
import type { NodeInstance } from "./document";

export interface PortDef {
  name: string;
  type: PortType;
  label: string;
  required?: boolean;
  /** Multiple edges may land on this input (used by merge). */
  multiple?: boolean;
}

export type NodeCategory =
  | "ai" | "input" | "output" | "media" | "logic" | "data" | "automation" | "developer" | "mcp" | "utility";

/** Services a node may use. Injected so the engine stays testable without bindings. */
export interface EngineServices {
  provider: AIProvider;
  getModel(id: string): Promise<ModelDefinition>;
  /** Enabled models with all of the given capabilities, best first. */
  findModels(capabilities: string[]): Promise<ModelDefinition[]>;
  /** A saved external connection, so credentials never live in a workflow document. */
  getConnector(id: string): Promise<{ url: string; token?: string } | null>;
  estimateCost(model: ModelDefinition, input: CanonicalInput): Promise<CostEstimate>;
  actualCost(model: ModelDefinition, usage: ProviderUsage | undefined, fallback: CostEstimate): Promise<{ actualSen: Sen; basis: "actual" | "estimated"; providerCostMicroUsd: number }>;
  /** Persists provider output and returns a handle other nodes can pass along. */
  storeAsset(input: { name: string; mime: string; bytes: ArrayBuffer; width?: number; height?: number; durationMs?: number; generationId?: string }): Promise<AssetHandle>;
  readAsset(handle: AssetHandle): Promise<{ bytes: ArrayBuffer; mime: string }>;
  /** Records a generation row for an AI node so it appears in history. */
  recordGeneration(input: RecordGenerationInput): Promise<string>;
  /**
   * Resize / crop / re-encode an image without a model (Cloudflare Images).
   * Absent when the binding is not configured, so the node can say so.
   */
  transformImage?(input: { bytes: ArrayBuffer; mime: string }, options: ImageTransformOptions): Promise<{ bytes: ArrayBuffer; mime: string; width?: number; height?: number }>;
  fetch: typeof fetch;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  gravity?: "auto" | "center" | "left" | "right" | "top" | "bottom";
  /** CSS colour used to fill when `fit` is `pad`. */
  background?: string;
  rotate?: 0 | 90 | 180 | 270;
  blur?: number;
  sharpen?: number;
  format: "image/png" | "image/jpeg" | "image/webp" | "image/avif";
  quality?: number;
}

export interface RecordGenerationInput {
  modelId: string;
  task: string;
  input: Record<string, unknown>;
  parameters: Record<string, unknown>;
  status: "completed" | "failed";
  estimatedCostSen: Sen;
  actualCostSen?: Sen;
  costBasis: "actual" | "estimated";
  providerCostMicroUsd?: number;
  providerRequestId?: string;
  outputs?: Record<string, PortValue>;
  error?: { code: string; message: string };
  durationMs: number;
  nodeRunId: string;
}

export interface NodeRuntimeContext {
  nodeId: string;
  nodeRunId: string;
  workflowRunId: string;
  projectId: string;
  auth: AuthContext;
  config: Record<string, unknown>;
  inputs: Record<string, PortValue | undefined>;
  variables: Record<string, unknown>;
  services: EngineServices;
  signal?: AbortSignal;
}

export type EstimateContext = Omit<NodeRuntimeContext, "nodeRunId" | "workflowRunId" | "services"> & {
  /** `findModels` lets studio presets price their automatic model choice; without it they estimate as approximate. */
  services: Pick<EngineServices, "getModel" | "estimateCost"> & Partial<Pick<EngineServices, "findModels">>;
};

export interface NodeCostEstimate {
  estimatedSen: Sen;
  approximate: boolean;
}

export interface NodeExecutionResult {
  outputs: Record<string, PortValue>;
  actualCostSen?: Sen;
  providerRequestId?: string;
  generationId?: string;
}

export interface NodeDefinition {
  type: string;
  version: number;
  category: NodeCategory;
  label: string;
  description: string;
  /** Shown in the short beginner palette rather than the full library (§78). */
  beginner?: boolean;
  /**
   * For studio presets: capabilities a model must have to serve this node.
   * Lets the editor filter the model picker and the node pick a default
   * model when none is chosen.
   */
  requiredCapabilities?: string[];
  /** The task a studio preset performs, e.g. "inpainting"; informational. */
  task?: string;
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: z.ZodTypeAny;
  /** Ports that depend on configuration, e.g. the model chosen on an AI node. */
  dynamicPorts?(config: Record<string, unknown>, model?: ModelDefinition): { inputs: PortDef[]; outputs: PortDef[] };
  estimate?(ctx: EstimateContext): Promise<NodeCostEstimate>;
  execute(ctx: NodeRuntimeContext): Promise<NodeExecutionResult>;
}

const registry = new Map<string, NodeDefinition>();

/** Nodes are pluggable by design (§132); built-ins register at startup. */
export function registerNode(definition: NodeDefinition): void {
  registry.set(definition.type, definition);
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return registry.get(type);
}

export function listNodeDefinitions(): NodeDefinition[] {
  return [...registry.values()];
}

/** Ports for a node instance, accounting for configuration-driven ports. */
export function portsFor(
  definition: NodeDefinition,
  node: NodeInstance,
  model?: ModelDefinition,
): { inputs: PortDef[]; outputs: PortDef[] } {
  if (definition.dynamicPorts) return definition.dynamicPorts(node.config, model);
  return { inputs: definition.inputs, outputs: definition.outputs };
}

/** Serializable shape for the palette endpoint; functions are dropped. */
export function toPaletteEntry(definition: NodeDefinition) {
  return {
    type: definition.type,
    version: definition.version,
    category: definition.category,
    label: definition.label,
    description: definition.description,
    beginner: definition.beginner ?? false,
    inputs: definition.inputs,
    outputs: definition.outputs,
    ...(definition.requiredCapabilities ? { requiredCapabilities: definition.requiredCapabilities } : {}),
    ...(definition.task ? { task: definition.task } : {}),
  };
}
