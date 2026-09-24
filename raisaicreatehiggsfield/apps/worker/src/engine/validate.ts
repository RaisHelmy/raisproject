import { isPortCompatible, type ModelDefinition, type PortType } from "@raisai/shared";
import type { WorkflowDocument } from "./document";
import { incomingEdges, topologicalOrder } from "./graph";
import { getNodeDefinition, portsFor, type PortDef } from "./registry";

export interface ValidationError {
  code:
    | "unknown_node_type" | "node_version_mismatch" | "invalid_config" | "missing_input"
    | "invalid_connection" | "duplicate_connection" | "unknown_port" | "cycle"
    | "no_output" | "unreachable_output" | "missing_variable" | "model_missing"
    | "limit_exceeded" | "empty_workflow";
  message: string;
  action?: string;
  nodeId?: string;
  edgeId?: string;
  port?: string;
}

export interface WorkflowLimits {
  maxNodes: number;
  maxEdges: number;
  maxFanOut: number;
}

export const DEFAULT_LIMITS: WorkflowLimits = { maxNodes: 50, maxEdges: 200, maxFanOut: 10 };

export interface ValidateOptions {
  limits?: WorkflowLimits;
  /** Models referenced by ai nodes, so ports and capabilities can be checked. */
  models?: Map<string, ModelDefinition>;
  /** Variable values supplied for this run, checked against declarations. */
  variables?: Record<string, unknown>;
}

/**
 * Validates a workflow and returns EVERY problem at once (§127), so the editor
 * can highlight all of them instead of making the user fix one per attempt.
 */
export function validateWorkflow(doc: WorkflowDocument, options: ValidateOptions = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const limits = options.limits ?? DEFAULT_LIMITS;

  if (doc.nodes.length === 0) {
    return [{ code: "empty_workflow", message: "This workflow has no nodes yet.", action: "Add a node to get started." }];
  }
  if (doc.nodes.length > limits.maxNodes) {
    errors.push({ code: "limit_exceeded", message: `A workflow can have at most ${limits.maxNodes} nodes.` });
  }
  if (doc.edges.length > limits.maxEdges) {
    errors.push({ code: "limit_exceeded", message: `A workflow can have at most ${limits.maxEdges} connections.` });
  }

  const nodesById = new Map(doc.nodes.map((n) => [n.id, n]));
  const portsByNode = new Map<string, { inputs: PortDef[]; outputs: PortDef[] }>();

  for (const node of doc.nodes) {
    const definition = getNodeDefinition(node.type);
    if (!definition) {
      errors.push({
        code: "unknown_node_type", nodeId: node.id,
        message: `Unknown node type "${node.type}".`,
        action: "Delete this node or update RaisAI.",
      });
      continue;
    }
    if (node.version > definition.version) {
      errors.push({
        code: "node_version_mismatch", nodeId: node.id,
        message: `${definition.label} was saved by a newer version of RaisAI.`,
      });
    }

    const parsed = definition.configSchema.safeParse(node.config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          code: "invalid_config", nodeId: node.id, port: issue.path.join("."),
          message: `${definition.label}: ${issue.message}`,
          action: "Open the node and complete its settings.",
        });
      }
    }

    // An AI node needs a model that exists and is enabled before it can run.
    let model: ModelDefinition | undefined;
    if (definition.category === "ai") {
      const modelId = typeof node.config.modelId === "string" && node.config.modelId ? node.config.modelId : undefined;
      if (!modelId) {
        // Studio presets choose the best enabled model at run time, so an
        // empty selection is a valid "automatic" rather than a mistake.
        if (!definition.requiredCapabilities) {
          errors.push({
            code: "model_missing", nodeId: node.id,
            message: `${definition.label} has no model selected.`, action: "Pick a model.",
          });
        }
      } else {
        model = options.models?.get(modelId);
        if (options.models && !model) {
          errors.push({
            code: "model_missing", nodeId: node.id,
            message: `The model "${modelId}" is not available.`,
            action: "Choose a different model.",
          });
        }
      }
    }
    portsByNode.set(node.id, portsFor(definition, node, model));
  }

  // Connections
  const seenTargets = new Set<string>();
  const fanOut = new Map<string, number>();

  for (const edge of doc.edges) {
    const fromNode = nodesById.get(edge.from.node);
    const toNode = nodesById.get(edge.to.node);
    if (!fromNode || !toNode) {
      errors.push({ code: "invalid_connection", edgeId: edge.id, message: "A connection points at a node that no longer exists." });
      continue;
    }
    const fromPorts = portsByNode.get(edge.from.node);
    const toPorts = portsByNode.get(edge.to.node);
    if (!fromPorts || !toPorts) continue;

    const output = fromPorts.outputs.find((p) => p.name === edge.from.port);
    const input = toPorts.inputs.find((p) => p.name === edge.to.port);
    if (!output) {
      errors.push({ code: "unknown_port", edgeId: edge.id, nodeId: edge.from.node, port: edge.from.port, message: `No output called "${edge.from.port}".` });
      continue;
    }
    if (!input) {
      errors.push({ code: "unknown_port", edgeId: edge.id, nodeId: edge.to.node, port: edge.to.port, message: `No input called "${edge.to.port}".` });
      continue;
    }
    if (!isPortCompatible(output.type as PortType, input.type as PortType)) {
      errors.push({
        code: "invalid_connection", edgeId: edge.id,
        message: `${output.label} (${output.type}) cannot connect to ${input.label} (${input.type}).`,
        action: "Connect ports of matching types.",
      });
    }
    const targetKey = `${edge.to.node}:${edge.to.port}`;
    if (seenTargets.has(targetKey) && !input.multiple) {
      errors.push({
        code: "duplicate_connection", edgeId: edge.id, nodeId: edge.to.node, port: edge.to.port,
        message: `${input.label} already has a connection.`,
        action: "Remove one of the connections.",
      });
    }
    seenTargets.add(targetKey);

    const count = (fanOut.get(edge.from.node) ?? 0) + 1;
    fanOut.set(edge.from.node, count);
    if (count > limits.maxFanOut) {
      errors.push({ code: "limit_exceeded", nodeId: edge.from.node, message: `A node can feed at most ${limits.maxFanOut} others.` });
    }
  }

  // Required inputs must be connected or satisfiable from config.
  for (const node of doc.nodes) {
    const ports = portsByNode.get(node.id);
    if (!ports) continue;
    const connected = new Set(incomingEdges(doc, node.id).map((e) => e.to.port));
    for (const input of ports.inputs) {
      if (!input.required || connected.has(input.name)) continue;
      const hasConfigValue = node.config[input.name] !== undefined;
      if (!hasConfigValue) {
        const definition = getNodeDefinition(node.type);
        errors.push({
          code: "missing_input", nodeId: node.id, port: input.name,
          message: `${definition?.label ?? node.type} needs ${input.label}.`,
          action: "Connect something to this input.",
        });
      }
    }
  }

  // Cycles
  const { order, cycleNodes } = topologicalOrder(doc);
  if (order === null) {
    for (const nodeId of cycleNodes) {
      errors.push({
        code: "cycle", nodeId,
        message: "These nodes form a loop, so the workflow cannot run.",
        action: "Remove a connection to break the loop.",
      });
    }
  }

  // Outputs
  const outputNodes = doc.nodes.filter((n) => n.type === "output");
  if (outputNodes.length === 0) {
    errors.push({
      code: "no_output", message: "This workflow has no output.",
      action: "Add an Output node so the result is kept.",
    });
  } else {
    for (const outputNode of outputNodes) {
      if (incomingEdges(doc, outputNode.id).length === 0) {
        errors.push({
          code: "unreachable_output", nodeId: outputNode.id,
          message: "This output is not connected to anything.",
          action: "Connect a result to the output.",
        });
      }
    }
  }

  // Declared variables must be supplied when running.
  if (options.variables) {
    for (const variable of doc.variables) {
      const provided = options.variables[variable.name];
      if (variable.required && provided === undefined && variable.default === undefined) {
        errors.push({
          code: "missing_variable", port: variable.name,
          message: `Missing value for ${variable.label ?? variable.name}.`,
          action: "Fill in every required input.",
        });
      }
    }
  }

  return dedupe(errors);
}

/**
 * Two rules can catch the same mistake: an AI node with no model fails both the
 * config schema and the model check. Reporting it twice makes the panel look
 * broken, so identical (node, field) pairs collapse to the more specific one.
 */
function dedupe(errors: ValidationError[]): ValidationError[] {
  const specific = new Set(
    errors.filter((e) => e.code === "model_missing" && e.nodeId).map((e) => `${e.nodeId}:modelId`),
  );
  return errors.filter((e) => !(e.code === "invalid_config" && e.port === "modelId" && specific.has(`${e.nodeId}:modelId`)));
}
