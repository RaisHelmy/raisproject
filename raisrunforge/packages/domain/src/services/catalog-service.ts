import type { Template } from "@runforge/shared";
import type { DemoWorld } from "@runforge/providers";

/** Application/infrastructure/database templates (spec §62/§63). Read-only catalogue for now. */
export class CatalogService {
  constructor(private readonly world: DemoWorld) {}

  async listTemplates(kind?: Template["kind"]): Promise<Template[]> {
    return kind ? this.world.templates.filter((t) => t.kind === kind) : this.world.templates;
  }
}
