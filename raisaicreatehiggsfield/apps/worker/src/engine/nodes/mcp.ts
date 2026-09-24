import { z } from "zod";
import { AppError } from "@raisai/shared";
import { registerNode, type NodeDefinition } from "../registry";
import type { PortValue } from "../values";
import { assertPublicUrl } from "./http";

/**
 * Calls a tool on an external MCP server (§137).
 *
 * MCP is both how agents reach RaisAI and how a RaisAI workflow reaches
 * elsewhere. The credential lives in a connector rather than in the workflow
 * document, so a shared or exported workflow never carries someone's token.
 */
const configSchema = z.object({
  connectorId: z.string().optional(),
  serverUrl: z.string().optional(),
  toolName: z.string().min(1, "Name the tool to call."),
  arguments: z.record(z.unknown()).default({}),
  timeoutMs: z.number().int().min(1000).max(60_000).default(30_000),
});

interface JsonRpcReply {
  result?: { content?: { type: string; text?: string }[]; structuredContent?: unknown };
  error?: { code: number; message: string; data?: { code?: string; action?: string } };
}

const mcpToolNode: NodeDefinition = {
  type: "mcp.tool",
  version: 1,
  category: "mcp",
  label: "MCP tool",
  description: "Calls a tool on an MCP server and returns what it gives back.",
  inputs: [{ name: "arguments", type: "json", label: "Arguments" }],
  outputs: [
    { name: "result", type: "json", label: "Result" },
    { name: "text", type: "text", label: "Text" },
  ],
  configSchema,

  async execute(ctx) {
    const config = configSchema.parse(ctx.config);

    const connection = await resolveConnection(ctx, config);
    const url = assertPublicUrl(connection.url);

    // Arguments from an upstream node override the ones typed into the node,
    // so a graph can drive the same tool with different inputs.
    const incoming = ctx.inputs.arguments;
    const args =
      incoming && typeof incoming === "object" && !Array.isArray(incoming)
        ? { ...config.arguments, ...(incoming as Record<string, unknown>) }
        : config.arguments;

    let response: Response;
    try {
      response = await ctx.services.fetch(url.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(connection.token ? { authorization: `Bearer ${connection.token}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: config.toolName, arguments: args },
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(message.includes("abort") || message.includes("timeout") ? "provider_timeout" : "provider_error",
        `The MCP server at ${url.host} could not be reached: ${message}`,
        { action: "Check the server address and that it is running." });
    }

    if (!response.ok) {
      throw new AppError("provider_error", `The MCP server answered ${response.status}.`, {
        action: response.status === 401 ? "Check the connector's token." : "Check the server and try again.",
      });
    }

    const body = (await response.json().catch(() => null)) as JsonRpcReply | null;
    if (!body) throw new AppError("provider_error", "The MCP server did not return valid JSON.");

    if (body.error) {
      // The remote server's own message is passed through: it knows why it
      // refused better than we do.
      throw new AppError("provider_error", `${config.toolName}: ${body.error.message}`, {
        action: body.error.data?.action,
      });
    }

    const structured = body.result?.structuredContent;
    const text = body.result?.content?.find((c) => c.type === "text")?.text ?? "";
    return { outputs: { result: (structured ?? text ?? null) as PortValue, text } };
  },
};

async function resolveConnection(
  ctx: Parameters<NodeDefinition["execute"]>[0],
  config: z.infer<typeof configSchema>,
): Promise<{ url: string; token?: string }> {
  if (config.connectorId) {
    const connector = await ctx.services.getConnector(config.connectorId);
    if (!connector) {
      throw new AppError("not_found", "That MCP connection no longer exists.", {
        action: "Pick a connection, or add one in Connectors.",
      });
    }
    return connector;
  }
  if (!config.serverUrl) {
    throw new AppError("invalid_input", "This node has no MCP server to call.", {
      action: "Choose a saved connection, or enter a server address.",
    });
  }
  // A bare URL with no credential is allowed for open servers only.
  return { url: config.serverUrl };
}

export function registerMcpNode(): void {
  registerNode(mcpToolNode);
}
