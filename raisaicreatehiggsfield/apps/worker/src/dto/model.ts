import type { ModelDefinition } from "@raisai/shared";

/**
 * Customer view of a model. Deliberately omits provider hosting details and
 * anything about internal economics (ADR-006). `estimatedCostSen` is attached
 * by the pricing service in task 1.1.2.
 */
export interface ModelDTO {
  id: string;
  displayName: string;
  description: string;
  category: string;
  task: string;
  capabilities: string[];
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  parameters: ModelDefinition["parameters"];
  limits: ModelDefinition["limits"];
  tags: string[];
  docUrl?: string;
  /** Cost of a typical request, so models can be compared at a glance (§92). */
  typicalCostSen?: number;
  typicalCostApproximate?: boolean;
}

export function toModelDTO(model: ModelDefinition): ModelDTO {
  return {
    id: model.id,
    displayName: model.displayName,
    description: model.description,
    category: model.category,
    task: model.task,
    capabilities: model.capabilities,
    inputs: model.inputs,
    outputs: model.outputs,
    parameters: model.parameters,
    limits: model.limits,
    tags: model.tags,
    ...(model.docUrl ? { docUrl: model.docUrl } : {}),
  };
}

export interface AdminModelDTO extends ModelDTO {
  hosting: string;
  status: string;
  version: string;
  sortOrder: number;
}

export function toAdminModelDTO(model: ModelDefinition): AdminModelDTO {
  return {
    ...toModelDTO(model),
    hosting: model.hosting,
    status: model.status,
    version: model.version,
    sortOrder: model.sortOrder,
  };
}
