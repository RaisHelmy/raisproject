import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { assertPublicUrl } from "../engine/nodes/http";
import { CONNECTOR_TYPES, ConnectorService, connectorDTO } from "../services/connector-service";

export const connectors = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

const bodySchema = z.object({
  type: z.enum(CONNECTOR_TYPES),
  name: z.string().min(1, "Give the connection a name."),
  url: z.string().url("Enter the server address."),
  token: z.string().optional(),
  headerName: z.string().optional(),
});

connectors.get("/connectors", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:read")) throw new AppError("insufficient_scope", "This token cannot read connections.");
  const list = await new ConnectorService(c.env).list(auth);
  return c.json({ items: list.map(connectorDTO), types: CONNECTOR_TYPES });
});

connectors.post("/connectors", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:write")) throw new AppError("insufficient_scope", "This token cannot add connections.");
  const created = await new ConnectorService(c.env).create(auth, bodySchema.parse(await c.req.json()));
  return c.json(connectorDTO(created), 201);
});

connectors.patch("/connectors/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:write")) throw new AppError("insufficient_scope", "This token cannot change connections.");
  const body = bodySchema.partial().parse(await c.req.json());
  const updated = await new ConnectorService(c.env).update(auth, c.req.param("id"), body);
  return c.json(connectorDTO(updated));
});

connectors.delete("/connectors/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:write")) throw new AppError("insufficient_scope", "This token cannot delete connections.");
  await new ConnectorService(c.env).delete(auth, c.req.param("id"));
  return c.body(null, 204);
});

/**
 * Asks the server what tools it has (§112).
 *
 * Two things at once: it proves the address and token work before anyone
 * builds a workflow on them, and it gives the MCP node a list of tool names to
 * choose from instead of a free-text field to mistype.
 */
connectors.post("/connectors/:id/test", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:read")) throw new AppError("insufficient_scope", "This token cannot read connections.");

  const connection = await new ConnectorService(c.env).resolve(auth, c.req.param("id"));
  if (!connection) throw new AppError("not_found", "That connection does not exist.");
  const url = assertPublicUrl(connection.url);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(connection.token ? { [connection.headerName ?? "authorization"]: connection.headerName ? connection.token : `Bearer ${connection.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, reason: `${url.host} could not be reached: ${message}`, action: "Check the address and that the server is running." });
  }

  if (!response.ok) {
    return c.json({
      ok: false,
      reason: `The server answered ${response.status}.`,
      action: response.status === 401 ? "Check the token." : "Check the address and try again.",
    });
  }

  const body = (await response.json().catch(() => null)) as
    | { result?: { tools?: { name: string; description?: string }[] }; error?: { message: string } }
    | null;
  if (!body || body.error) {
    return c.json({ ok: false, reason: body?.error?.message ?? "The server did not return valid JSON.", action: "Check that this is an MCP server." });
  }

  return c.json({
    ok: true,
    tools: (body.result?.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description ?? null })),
  });
});
