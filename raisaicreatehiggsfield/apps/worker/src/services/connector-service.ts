import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { assertPublicUrl } from "../engine/nodes/http";
import { open, seal } from "../lib/secret-box";

export const CONNECTOR_TYPES = ["mcp_server", "http_auth"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export interface ConnectorRow {
  id: string;
  org_id: string;
  type: ConnectorType;
  name: string;
  config_json: string;
  created_at: string;
}

interface StoredConfig {
  url: string;
  /** Sealed with the environment key; never leaves the Worker in the clear. */
  token?: string;
  headerName?: string;
}

export interface ConnectorInput {
  type: ConnectorType;
  name: string;
  url: string;
  /** Empty string clears the token; undefined leaves an existing one alone. */
  token?: string;
  headerName?: string;
}

/**
 * Saved connections that workflow nodes use instead of holding credentials
 * themselves (§10, §137).
 *
 * The point of the indirection is sharing: a workflow can be exported,
 * published as a template or handed to another person while the token stays
 * behind with the organization that owns it.
 */
export class ConnectorService {
  constructor(private readonly env: Pick<Env, "DB"> & Partial<Pick<Env, "SECRETS_KEY" | "SESSION_SECRET">>) {}

  async list(auth: AuthContext): Promise<ConnectorRow[]> {
    const rows = await this.env.DB
      .prepare(`SELECT * FROM connectors WHERE org_id = ? ORDER BY id DESC`)
      .bind(auth.orgId)
      .all<ConnectorRow>();
    return rows.results ?? [];
  }

  async require(auth: AuthContext, id: string): Promise<ConnectorRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM connectors WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<ConnectorRow>();
    if (!row) throw new AppError("not_found", "That connection does not exist.");
    return row;
  }

  async create(auth: AuthContext, input: ConnectorInput): Promise<ConnectorRow> {
    // The same guard the HTTP and MCP nodes use. A connection must not be a
    // way to point the Worker at internal infrastructure.
    assertPublicUrl(input.url);

    const id = newId();
    const config: StoredConfig = {
      url: input.url,
      headerName: input.headerName,
      ...(input.token ? { token: await seal(this.env as Env, input.token) } : {}),
    };
    const now = nowIso();
    await this.env.DB
      .prepare(`INSERT INTO connectors (id, org_id, type, name, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, auth.orgId, input.type, input.name, JSON.stringify(config), now)
      .run();
    return { id, org_id: auth.orgId, type: input.type, name: input.name, config_json: JSON.stringify(config), created_at: now };
  }

  async update(auth: AuthContext, id: string, input: Partial<ConnectorInput>): Promise<ConnectorRow> {
    const existing = await this.require(auth, id);
    const current = JSON.parse(existing.config_json) as StoredConfig;

    const url = input.url ?? current.url;
    assertPublicUrl(url);

    // An absent token keeps the saved one, so someone can rename a connection
    // without having to paste their token again. An empty string clears it.
    const token =
      input.token === undefined ? current.token
      : input.token === "" ? undefined
      : await seal(this.env as Env, input.token);

    const config: StoredConfig = {
      url,
      headerName: input.headerName ?? current.headerName,
      ...(token ? { token } : {}),
    };
    await this.env.DB
      .prepare(`UPDATE connectors SET name = ?, type = ?, config_json = ? WHERE id = ? AND org_id = ?`)
      .bind(input.name ?? existing.name, input.type ?? existing.type, JSON.stringify(config), id, auth.orgId)
      .run();
    return { ...existing, name: input.name ?? existing.name, type: input.type ?? existing.type, config_json: JSON.stringify(config) };
  }

  async delete(auth: AuthContext, id: string): Promise<void> {
    await this.require(auth, id);
    await this.env.DB.prepare(`DELETE FROM connectors WHERE id = ? AND org_id = ?`).bind(id, auth.orgId).run();
  }

  /** The decrypted connection, for the engine only. Never for a route. */
  async resolve(auth: AuthContext, id: string): Promise<{ url: string; token?: string; headerName?: string } | null> {
    const row = await this.env.DB
      .prepare(`SELECT config_json FROM connectors WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<{ config_json: string }>();
    if (!row) return null;
    const config = JSON.parse(row.config_json) as StoredConfig;
    if (!config.url) return null;
    const token = config.token ? await open(this.env as Env, config.token) : null;
    return { url: config.url, headerName: config.headerName, ...(token ? { token } : {}) };
  }
}

/** What a customer is allowed to see: everything except the secret (§109). */
export function connectorDTO(row: ConnectorRow) {
  const config = JSON.parse(row.config_json) as StoredConfig;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    url: config.url,
    headerName: config.headerName ?? null,
    hasToken: Boolean(config.token),
    createdAt: row.created_at,
  };
}
