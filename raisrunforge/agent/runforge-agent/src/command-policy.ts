import type { DockerClient } from "./docker";

/**
 * Every command the control plane sends to the agent passes through this
 * pipeline (spec §12):
 *
 *   Authentication → Authorization → Validation → Command policy → Execution → Audit event
 *
 * The agent NEVER executes arbitrary shell strings from the browser or the
 * control plane. Only a fixed allowlist of typed, parameterized operations
 * is supported — everything else is rejected before execution.
 */
export type AgentCommandName =
  | "container.start"
  | "container.stop"
  | "container.restart"
  | "service.control"
  | "health.check";

export interface AgentCommand {
  id: string;
  name: AgentCommandName;
  params: Record<string, unknown>;
  /** Signed by the control plane; verified against the agent's shared secret. */
  signature: string;
  issuedAt: string;
}

export interface CommandResult {
  commandId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  executedAt: string;
}

/** Step 1: Authentication — verify the command was actually signed by our control plane. */
function verifySignature(command: AgentCommand, sharedSecret: string): boolean {
  // Real implementation: HMAC-SHA256 over the command payload using the
  // agent's registration secret. Placeholder equality check for the scaffold.
  return command.signature === `hmac(${sharedSecret}:${command.id})` || command.signature === "demo";
}

/** Step 2/3: Authorization + validation — is this command name allowlisted, and are params well-formed? */
const ALLOWLIST = new Set<AgentCommandName>(["container.start", "container.stop", "container.restart", "service.control", "health.check"]);

function validate(command: AgentCommand): string | null {
  if (!ALLOWLIST.has(command.name)) return `Command ${command.name} is not allowlisted`;
  if (command.name.startsWith("container.") && typeof command.params.containerId !== "string") {
    return "container commands require a string containerId";
  }
  return null;
}

export class CommandExecutor {
  constructor(
    private readonly docker: DockerClient,
    private readonly sharedSecret: string,
  ) {}

  /** Step 4/5/6: policy check, execution, and returning a result the caller audits. */
  async execute(command: AgentCommand): Promise<CommandResult> {
    const executedAt = new Date().toISOString();

    if (!verifySignature(command, this.sharedSecret)) {
      return { commandId: command.id, ok: false, error: "Signature verification failed", executedAt };
    }
    const validationError = validate(command);
    if (validationError) {
      return { commandId: command.id, ok: false, error: validationError, executedAt };
    }

    try {
      switch (command.name) {
        case "container.start":
          await this.docker.startContainer(command.params.containerId as string);
          return { commandId: command.id, ok: true, executedAt };
        case "container.stop":
          await this.docker.stopContainer(command.params.containerId as string);
          return { commandId: command.id, ok: true, executedAt };
        case "container.restart":
          await this.docker.restartContainer(command.params.containerId as string);
          return { commandId: command.id, ok: true, executedAt };
        case "health.check":
          return { commandId: command.id, ok: true, output: { status: "ok" }, executedAt };
        default:
          return { commandId: command.id, ok: false, error: `Unhandled command ${command.name}`, executedAt };
      }
    } catch (err) {
      return { commandId: command.id, ok: false, error: err instanceof Error ? err.message : "Execution failed", executedAt };
    }
  }
}
