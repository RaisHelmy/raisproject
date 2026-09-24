import type { AIProvider, ChangePlan, CommandIntent } from "./provider";
import { DemoPlanner } from "./demoPlanner";

/**
 * Provider-neutral HTTP adapter skeleton (section 109).
 * A real provider is only enabled when an API key is bound as a Worker secret and the organization
 * has selected PLATFORM or BYOK AI. Until then, calls fall back to the DemoPlanner and the UI shows DEMO.
 *
 * TODO(phase-2): implement Anthropic Messages API and OpenAI Responses API adapters behind this interface.
 * Secrets are read from the secret provider by reference and never passed to MCP tools or logged.
 */
export interface ProviderConfig { kind: "ANTHROPIC" | "OPENAI" | "GOOGLE"; model: string; credentialRef: string; getSecret?: (ref: string) => Promise<string | undefined> }

export class ConfiguredProviderPlaceholder implements AIProvider {
  readonly kind;
  readonly model;
  private fallback = new DemoPlanner();
  constructor(private config: ProviderConfig) { this.kind = config.kind; this.model = config.model; }
  async isConfigured(): Promise<boolean> { return Boolean(this.config.getSecret && (await this.config.getSecret(this.config.credentialRef))); }
  planChange(intent: string, ctx: { applications: { slug: string; name: string; runtime: string }[] }): Promise<ChangePlan> { return this.fallback.planChange(intent, ctx); }
  interpretCommand(text: string): Promise<CommandIntent> { return this.fallback.interpretCommand(text); }
  diagnose(input: { error: string; taskType: import("../types").TaskType; context: string[] }) { return this.fallback.diagnose(input); }
}

export function createProvider(config?: ProviderConfig): AIProvider {
  if (!config) return new DemoPlanner();
  return new ConfiguredProviderPlaceholder(config);
}
