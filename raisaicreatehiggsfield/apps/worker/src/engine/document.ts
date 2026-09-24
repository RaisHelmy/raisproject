import { z } from "zod";
import { PORT_TYPES } from "@raisai/shared";

/**
 * The workflow format is a backend/domain document, not a React data structure
 * (§131). React is one editor; the API, MCP and SDK manipulate the same JSON.
 */

const portTypeSchema = z.enum(PORT_TYPES);

export const retryPolicySchema = z.object({
  count: z.number().int().min(0).max(5).default(0),
  delayMs: z.number().int().min(0).max(60_000).default(1000),
  /** Only these failure codes are retried; invalid input never is (§63). */
  on: z.array(z.enum(["provider_timeout", "provider_error", "rate_limited"])).default(["provider_timeout", "rate_limited"]),
});
export type RetryPolicy = z.infer<typeof retryPolicySchema>;

export const nodeInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().positive().default(1),
  config: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  retry: retryPolicySchema.optional(),
  cache: z.boolean().optional(),
  label: z.string().optional(),
});
export type NodeInstance = z.infer<typeof nodeInstanceSchema>;

export const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.object({ node: z.string().min(1), port: z.string().min(1) }),
  to: z.object({ node: z.string().min(1), port: z.string().min(1) }),
});
export type Edge = z.infer<typeof edgeSchema>;

export const variableDefSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/i, "Use letters, numbers and underscores."),
  type: portTypeSchema,
  required: z.boolean().default(true),
  default: z.unknown().optional(),
  label: z.string().optional(),
  enum: z.array(z.string()).optional(),
});
export type VariableDef = z.infer<typeof variableDefSchema>;

export const workflowSettingsSchema = z.object({
  /** Hard ceiling for a run; the engine pauses rather than exceeding it (§139). */
  maxCostSen: z.number().int().positive().optional(),
  cache: z.boolean().default(false),
  maxParallel: z.number().int().min(1).max(10).default(3),
});
export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;

export const workflowDocumentSchema = z.object({
  version: z.literal(1),
  nodes: z.array(nodeInstanceSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  variables: z.array(variableDefSchema).default([]),
  settings: workflowSettingsSchema.default({ cache: false, maxParallel: 3 }),
  meta: z.object({ name: z.string().optional(), description: z.string().optional() }).default({}),
});
export type WorkflowDocument = z.infer<typeof workflowDocumentSchema>;

export function emptyDocument(): WorkflowDocument {
  return workflowDocumentSchema.parse({ version: 1 });
}

/** Stable hash of a document, used to detect real changes before versioning. */
export async function hashDocument(doc: WorkflowDocument): Promise<string> {
  // Node positions are editor state and must not create a new version.
  const significant = {
    version: doc.version,
    nodes: doc.nodes.map(({ position: _position, ...rest }) => rest),
    edges: doc.edges,
    variables: doc.variables,
    settings: doc.settings,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(significant));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
