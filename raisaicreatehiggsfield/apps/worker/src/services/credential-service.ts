import { AppError, newId, SCOPES, type AuthContext, type Scope } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { AuditLogService } from "./audit-log-service";

export type CredentialKind = "api_key" | "mcp";

export interface CredentialRow {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes_json: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface IssuedCredential {
  credential: CredentialRow;
  /** Returned once at creation and never retrievable again (§105). */
  secret: string;
}

const TABLE: Record<CredentialKind, string> = { api_key: "api_keys", mcp: "mcp_tokens" };
const PREFIX: Record<CredentialKind, string> = { api_key: "rk", mcp: "rmcp" };

/** Scopes an MCP token may hold. Admin actions are never reachable over MCP (§59). */
const MCP_ALLOWED: Scope[] = [
  "models:read", "generations:read", "generations:write",
  "workflows:read", "workflows:execute", "templates:read", "templates:execute",
  "assets:read", "projects:read", "billing:read",
];

/**
 * API keys and MCP tokens. Both are bearer credentials with scopes, stored only
 * as a hash: the secret is shown once and cannot be recovered (§105, §106).
 */
export class CredentialService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async issue(
    auth: AuthContext,
    kind: CredentialKind,
    input: { name: string; scopes: Scope[]; expiresAt?: string },
  ): Promise<IssuedCredential> {
    const name = input.name.trim();
    if (!name) throw new AppError("invalid_input", "Give the key a name so you can recognise it later.");

    const requested = input.scopes.length > 0 ? input.scopes : (["models:read"] as Scope[]);
    const unknown = requested.filter((s) => !SCOPES.includes(s));
    if (unknown.length > 0) {
      throw new AppError("invalid_input", `Unknown scope: ${unknown.join(", ")}.`, {
        action: "Use one of the documented scopes.",
      });
    }
    if (kind === "mcp") {
      const disallowed = requested.filter((s) => !MCP_ALLOWED.includes(s));
      if (disallowed.length > 0) {
        throw new AppError("invalid_input", `An MCP token cannot hold: ${disallowed.join(", ")}.`, {
          action: "Remove those scopes, or use an API key instead.",
        });
      }
    }
    // A credential can never exceed the rights of whoever created it.
    const excessive = requested.filter((s) => auth.actorType !== "user" && !auth.scopes.includes(s));
    if (excessive.length > 0) {
      throw new AppError("insufficient_scope", "You cannot grant a scope you do not hold.");
    }

    const id = newId();
    const secret = `${PREFIX[kind]}_${crypto.randomUUID().replace(/-/g, "")}${newId().toLowerCase()}`;
    const prefix = secret.slice(0, PREFIX[kind].length + 9);

    await this.env.DB
      .prepare(
        `INSERT INTO ${TABLE[kind]} (id, org_id, user_id, name, prefix, key_hash, scopes_json, expires_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(id, auth.orgId, auth.userId, name, prefix, await hashSecret(secret), JSON.stringify(requested), input.expiresAt ?? null, nowIso())
      .run();

    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event: kind === "api_key" ? "api_key.created" : "mcp_token.created",
      targetType: kind, targetId: id, meta: { name, scopes: requested }, requestId: auth.requestId,
    });

    const credential = await this.findById(auth, kind, id);
    if (!credential) throw new AppError("internal", "The key could not be read back.");
    return { credential, secret };
  }

  async list(auth: AuthContext, kind: CredentialKind): Promise<CredentialRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM ${TABLE[kind]} WHERE org_id = ? ORDER BY created_at DESC`)
      .bind(auth.orgId)
      .all<CredentialRow>();
    return results;
  }

  async revoke(auth: AuthContext, kind: CredentialKind, id: string): Promise<void> {
    const credential = await this.findById(auth, kind, id);
    if (!credential) throw new AppError("not_found", "Key not found.");
    await this.env.DB
      .prepare(`UPDATE ${TABLE[kind]} SET revoked_at = ? WHERE id = ? AND org_id = ?`)
      .bind(nowIso(), id, auth.orgId)
      .run();
    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event: kind === "api_key" ? "api_key.revoked" : "mcp_token.revoked",
      targetType: kind, targetId: id, requestId: auth.requestId,
    });
  }

  /**
   * Resolves a bearer secret to an auth context, or null. Revoked and expired
   * credentials resolve to null rather than an error, so a caller cannot tell
   * a wrong key from a revoked one.
   */
  async authenticate(secret: string, requestId: string): Promise<AuthContext | null> {
    const kind: CredentialKind = secret.startsWith("rmcp_") ? "mcp" : "api_key";
    const hash = await hashSecret(secret);

    const row = await this.env.DB
      .prepare(`SELECT * FROM ${TABLE[kind]} WHERE key_hash = ?`)
      .bind(hash)
      .first<CredentialRow>();
    if (!row || row.revoked_at) return null;
    if (row.expires_at && row.expires_at <= nowIso()) return null;

    // Recorded for the "last used" column; a failure here must not block the call.
    await this.env.DB
      .prepare(`UPDATE ${TABLE[kind]} SET last_used_at = ? WHERE id = ?`)
      .bind(nowIso(), row.id)
      .run()
      .catch(() => undefined);

    return {
      userId: row.user_id,
      orgId: row.org_id,
      actorType: kind === "mcp" ? "mcp" : "api_key",
      scopes: JSON.parse(row.scopes_json) as Scope[],
      requestId,
      // A bearer credential never carries admin rights, even when the person who
      // created it is an admin: administration stays a signed-in, CSRF-checked
      // action so a leaked key cannot reprice models or mint balance.
      isAdmin: false,
      credentialId: row.id,
    };
  }

  private async findById(auth: AuthContext, kind: CredentialKind, id: string): Promise<CredentialRow | null> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM ${TABLE[kind]} WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<CredentialRow>();
    return row ?? null;
  }
}

export const MCP_SCOPES = MCP_ALLOWED;

async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
