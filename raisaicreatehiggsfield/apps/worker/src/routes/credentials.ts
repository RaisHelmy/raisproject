import { Hono } from "hono";
import { z } from "zod";
import { AppError, SCOPES, type Scope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { CredentialService, MCP_SCOPES, type CredentialKind, type CredentialRow } from "../services/credential-service";

export const credentials = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: CredentialRow) {
  return {
    id: row.id,
    name: row.name,
    // Enough to recognise the key, never enough to use it.
    prefix: `${row.prefix}…`,
    scopes: JSON.parse(row.scopes_json) as Scope[],
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().optional(),
});

function register(path: string, kind: CredentialKind) {
  credentials.get(path, ...guarded, async (c) => {
    const auth = c.get("auth");
    if (auth.actorType !== "user") throw new AppError("forbidden", "Manage keys from the web app.");
    const list = await new CredentialService(c.env).list(auth, kind);
    return c.json({ items: list.map(toDTO) });
  });

  credentials.post(path, ...guarded, async (c) => {
    const auth = c.get("auth");
    // A key cannot mint another key: that would turn one leak into permanent access.
    if (auth.actorType !== "user") throw new AppError("forbidden", "Create keys from the web app.");
    const body = createSchema.parse(await c.req.json());
    const issued = await new CredentialService(c.env).issue(auth, kind, {
      name: body.name,
      scopes: body.scopes as Scope[],
      expiresAt: body.expiresAt,
    });
    return c.json(
      {
        ...toDTO(issued.credential),
        // Shown once. There is no endpoint that can return it again (§105).
        secret: issued.secret,
        warning: "Copy this now. It cannot be shown again.",
      },
      201,
    );
  });

  credentials.delete(`${path}/:id`, ...guarded, async (c) => {
    const auth = c.get("auth");
    if (auth.actorType !== "user") throw new AppError("forbidden", "Manage keys from the web app.");
    await new CredentialService(c.env).revoke(auth, kind, c.req.param("id"));
    return c.body(null, 204);
  });
}

register("/api-keys", "api_key");
register("/mcp-tokens", "mcp");

/** The scope vocabulary, so the UI does not hard-code a list that can drift. */
credentials.get("/scopes", requireAuth(), (c) =>
  c.json({ apiKey: SCOPES, mcp: MCP_SCOPES }),
);
