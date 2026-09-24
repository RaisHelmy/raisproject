import { CURRENCY } from "@raisai/shared";
import type { GenerationRow } from "../services/generation-service";

/**
 * Customer view of a generation. Provider request ids and provider cost stay
 * out of it (ADR-006); the customer sees estimate, charged and outputs.
 */
export interface GenerationDTO {
  id: string;
  modelId: string;
  task: string;
  status: GenerationRow["status"];
  prompt: string;
  projectId: string;
  estimatedCostSen: number;
  chargedSen: number | null;
  /** True when the provider reported no usage and the estimate stands (§5). */
  costEstimated: boolean;
  currency: string;
  outputs: Record<string, unknown>;
  error: { code: string; message: string } | null;
  durationMs: number | null;
  createdAt: string;
  workflowRunId: string | null;
}

export function toGenerationDTO(row: GenerationRow, outputs: Record<string, unknown>): GenerationDTO {
  const input = JSON.parse(row.input_json) as { prompt?: string };
  return {
    id: row.id,
    modelId: row.model_id,
    task: row.task,
    status: row.status,
    prompt: input.prompt ?? "",
    projectId: row.project_id,
    estimatedCostSen: row.estimated_cost_sen,
    chargedSen: row.actual_cost_sen,
    costEstimated: row.cost_basis === "estimated",
    currency: CURRENCY,
    outputs,
    error: row.error_code ? { code: row.error_code, message: row.error_message ?? "" } : null,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    workflowRunId: row.workflow_run_id,
  };
}
