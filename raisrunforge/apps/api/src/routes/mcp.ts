import { Hono } from "hono";
import { getRunForge } from "../runforge-instance";
import { requireAuth } from "../middleware/auth";
import { ok, fail } from "../response";

/**
 * MCP-over-HTTP endpoint. A dedicated MCP transport (stdio/SSE) can wrap this
 * same McpService; the point is there's exactly one place tool calls are
 * dispatched (spec §42-§45): auth is resolved by authMiddleware, then every
 * call still goes Authentication → Authorization → Domain Service → Provider
 * → Audit Event inside McpService/the domain services it calls.
 */
export const mcpRoutes = new Hono();

mcpRoutes.get("/mcp/tools", async (c) => {
  try {
    return ok(c, await getRunForge().mcp.listTools());
  } catch (err) {
    return fail(c, err);
  }
});

mcpRoutes.post("/mcp/call", async (c) => {
  try {
    const rf = getRunForge();
    const ctx = requireAuth(c);
    const body = await c.req.json();
    const result = await rf.mcp.callTool(ctx, body.name, body.arguments ?? {}, body.confirmationToken);
    return ok(c, result);
  } catch (err) {
    return fail(c, err);
  }
});
