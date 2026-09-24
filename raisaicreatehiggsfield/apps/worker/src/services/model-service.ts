import { AppError, type Capability, type ModelDefinition } from "@raisai/shared";
import type { Env } from "../env";
import { ModelRepository, type ModelQuery } from "../repositories/models";

export interface ListModelsOptions extends Omit<ModelQuery, "statuses"> {
  /** Admins can see the whole catalog including discovered/deprecated entries. */
  includeAllStatuses?: boolean;
}

export class ModelService {
  private readonly repo: ModelRepository;

  constructor(env: Pick<Env, "DB">) {
    this.repo = new ModelRepository(env);
  }

  async list(options: ListModelsOptions = {}): Promise<ModelDefinition[]> {
    const { includeAllStatuses, ...query } = options;
    return this.repo.list({ ...query, statuses: includeAllStatuses ? undefined : ["enabled"] });
  }

  /** Customer-facing fetch: a model that is not enabled does not exist. */
  async getEnabled(id: string): Promise<ModelDefinition> {
    const model = await this.repo.findById(id);
    if (!model) throw new AppError("model_not_found", `No model with id ${id}.`, { action: "Pick a model from the catalog." });
    if (model.status !== "enabled") {
      throw new AppError("model_not_enabled", `${model.displayName} is not available.`, {
        action: "Choose another model.",
      });
    }
    return model;
  }

  async getAny(id: string): Promise<ModelDefinition | null> {
    return this.repo.findById(id);
  }

  /**
   * Models that can do what the caller needs. Used for the "Compatible models"
   * suggestion when a chosen model lacks a capability (§91).
   */
  async findCompatible(capabilities: Capability[], task?: string): Promise<ModelDefinition[]> {
    return this.repo.list({ statuses: ["enabled"], capabilities, task });
  }

  /** Throws a clear, actionable error when a model cannot satisfy the request (§112). */
  assertSupports(model: ModelDefinition, capabilities: Capability[]): void {
    const missing = capabilities.filter((c) => !model.capabilities.includes(c));
    if (missing.length === 0) return;
    const readable: Partial<Record<Capability, string>> = {
      "image-input": "image references",
      "multiple-images": "multiple reference images",
      "negative-prompt": "a negative prompt",
      duration: "a custom duration",
      seed: "a fixed seed",
      "aspect-ratio": "a custom aspect ratio",
      vision: "image understanding",
    };
    const names = missing.map((c) => readable[c] ?? c).join(", ");
    throw new AppError("model_incompatible", `${model.displayName} does not support ${names}.`, {
      action: "Switch to a compatible model or remove that option.",
      details: { missing },
    });
  }
}
