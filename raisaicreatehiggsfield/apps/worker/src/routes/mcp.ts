import { Hono } from "hono";
import { AppError, isAppError } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { assertToolAllowed, findTool, MCP_TOOLS } from "../mcp/tools";

export const mcp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const PROTOCOL_VERSION = "2025-06-18";
const MCP_RATE_RULE = { bucket: "mcp", limit: 300, windowMs: 60_000 };

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcRequest["id"], value: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result: value };
}

function failure(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

/**
 * MCP over Streamable HTTP (§56).
 *
 * Every tool call goes through the same application services the web app uses,
 * so an agent inherits balance checks, ownership and model rules rather than
 * getting a parallel path around them (§161). Authentication is an MCP token
 * with scopes; there is no admin surface here (§59).
 */
mcp.post("/mcp", requireAuth(), rateLimit(MCP_RATE_RULE), async (c) => {
  const auth = c.get("auth");
  if (auth.actorType === "api_key") {
    throw new AppError("forbidden", "Use an MCP token, not an API key, for the MCP endpoint.", {
      action: "Create an MCP token in Developer settings.",
    });
  }

  const body = (await c.req.json()) as JsonRpcRequest | JsonRpcRequest[];
  const requests = Array.isArray(body) ? body : [body];
  const responses = [];

  for (const request of requests) {
    // A notification has no id and expects no reply.
    const isNotification = request.id === undefined;
    try {
      const value = await dispatch(c.env, auth, request);
      if (!isNotification) responses.push(result(request.id, value));
    } catch (error) {
      if (isNotification) continue;
      if (isAppError(error)) {
        responses.push(
          failure(request.id, error.code === "not_found" ? -32601 : -32000, error.message, {
            code: error.code,
            ...(error.action ? { action: error.action } : {}),
            requestId: auth.requestId,
          }),
        );
      } else {
        responses.push(failure(request.id, -32603, "Internal error.", { requestId: auth.requestId }));
      }
    }
  }

  if (responses.length === 0) return c.body(null, 202);
  return c.json(Array.isArray(body) ? responses : responses[0]);
});

/** Advertises the endpoint so a client can discover it without a round trip. */
mcp.get("/mcp", requireAuth(), (c) =>
  c.json({
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: { name: "raisai-create", version: "0.1.0" },
    tools: MCP_TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, requiredScope: t.scope })),
  }),
);

async function dispatch(env: Env, auth: Parameters<typeof assertToolAllowed>[0], request: JsonRpcRequest): Promise<unknown> {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "raisai-create", version: "0.1.0" },
        instructions:
          "RaisAI Create generates images, video, speech and text, and runs saved workflows and templates. " +
          "Every generation spends real prepaid balance, so check estimate_cost and get_balance before running " +
          "anything expensive, and tell the user what it will cost.",
      };

    case "notifications/initialized":
      return null;

    case "ping":
      return {};

    case "tools/list":
      // Only the tools this token can actually use are advertised, so an agent
      // does not plan around a tool it will be refused.
      return {
        tools: MCP_TOOLS.filter((tool) => auth.actorType === "user" || auth.scopes.includes(tool.scope)).map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };

    case "tools/call": {
      const name = String(request.params?.name ?? "");
      const args = (request.params?.arguments as Record<string, unknown>) ?? {};
      const tool = findTool(name);
      assertToolAllowed(auth, tool);

      const value = await tool.handler(env, auth, args);
      return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
      };
    }

    default:
      throw new AppError("not_found", `Unsupported method "${request.method}".`);
  }
}
