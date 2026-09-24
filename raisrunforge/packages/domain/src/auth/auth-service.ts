import type { AuthContext, Member, PermissionLevel, Role, User } from "@runforge/shared";
import { newId } from "@runforge/shared";
import { DomainError } from "../errors";
import type { DataStore } from "../store/repository";
import { ROLE_MAX_LEVEL } from "./permissions";
import { verifyPassword } from "./password";

export interface Credentials {
  /** `Authorization: Bearer <token>` */
  bearerToken?: string;
  /** Session cookie value (future real auth). */
  sessionId?: string;
  /** Real email+password login (see PasswordAuthProvider). */
  email?: string;
  password?: string;
  /** Demo mode: impersonate a seeded user id (X-RunForge-Demo-User). */
  demoUserId?: string;
  /** Demo mode: impersonate a role (X-RunForge-Demo-Role) for testing authorization. */
  demoRole?: Role;
  organizationId?: string;
  correlationId?: string;
}

/**
 * AuthProvider resolves credentials into an AuthContext. Real providers (OAuth,
 * email+password sessions, API tokens) plug in here without touching services.
 */
export interface AuthProvider {
  readonly mode: "demo" | "token" | "session";
  authenticate(credentials: Credentials): Promise<AuthContext | null>;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Demo mode: every request is the seeded owner unless a demo header overrides it. */
export class DemoAuthProvider implements AuthProvider {
  readonly mode = "demo" as const;
  constructor(
    private readonly store: DataStore,
    private readonly defaults: { userId: string; organizationId: string },
  ) {}

  async authenticate(credentials: Credentials): Promise<AuthContext | null> {
    if (credentials.bearerToken) {
      const viaToken = await new TokenAuthProvider(this.store).authenticate(credentials);
      if (viaToken) return { ...viaToken, demo: true };
    }
    const organizationId = credentials.organizationId ?? this.defaults.organizationId;
    const userId = credentials.demoUserId ?? this.defaults.userId;
    const members = await this.store.members.list(organizationId, { where: { userId } as Partial<Member> });
    const member = members[0];
    if (!member) return null;
    const role = credentials.demoRole ?? member.role;
    return {
      actorType: role === "ai_agent" ? "ai" : "user",
      actorId: userId,
      userId,
      organizationId,
      role,
      maxLevel: ROLE_MAX_LEVEL[role],
      correlationId: credentials.correlationId ?? newId("corr"),
      demo: true,
    };
  }
}

/**
 * Real email+password login, checked against `users.passwordHash`. Looks up
 * the user by email across every organization's membership (email is not
 * scoped to one org here — same simplification the demo/token providers
 * already make), and resolves the AuthContext from their first active
 * membership.
 */
export class PasswordAuthProvider implements AuthProvider {
  readonly mode = "session" as const;
  constructor(private readonly store: DataStore) {}

  async authenticate(credentials: Credentials): Promise<AuthContext | null> {
    if (!credentials.email || !credentials.password) return null;
    const orgs = await this.store.organizations.list();
    for (const org of orgs) {
      const members = await this.store.members.list(org.id, {});
      for (const member of members) {
        const user = await this.store.users.get(member.userId);
        if (!user || user.email.toLowerCase() !== credentials.email.toLowerCase()) continue;
        if (!user.passwordHash) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          actorType: member.role === "ai_agent" ? "ai" : "user",
          actorId: user.id,
          userId: user.id,
          organizationId: org.id,
          role: member.role,
          maxLevel: ROLE_MAX_LEVEL[member.role],
          correlationId: credentials.correlationId ?? newId("corr"),
          demo: false,
        };
      }
    }
    return null;
  }
}

/** API / MCP bearer tokens stored as hashes in mcp_tokens. */
export class TokenAuthProvider implements AuthProvider {
  readonly mode = "token" as const;
  constructor(private readonly store: DataStore) {}

  async authenticate(credentials: Credentials): Promise<AuthContext | null> {
    const raw = credentials.bearerToken;
    if (!raw) return null;
    const hash = await sha256Hex(raw);
    // Tokens are org-scoped; we look across orgs by hash (indexed in D1).
    const orgs = await this.store.organizations.list();
    for (const org of orgs) {
      const tokens = await this.store.mcpTokens.list(org.id, { where: { status: "active" } as never });
      const token = tokens.find((t) => t.tokenHash === hash || (t.tokenHash === "demo" && raw === "rf_mcp_demo") || (t.tokenHash === "demo-ro" && raw === "rf_mcp_ro"));
      if (!token) continue;
      if (token.expiresAt && Date.parse(token.expiresAt) < Date.now()) return null;
      await this.store.mcpTokens.update(org.id, token.id, { lastUsedAt: new Date().toISOString() });
      return {
        actorType: token.role === "ai_agent" ? "ai" : "user",
        actorId: token.id,
        organizationId: org.id,
        role: token.role,
        maxLevel: token.level as PermissionLevel,
        tokenId: token.id,
        correlationId: credentials.correlationId ?? newId("corr"),
        demo: false,
      };
    }
    return null;
  }
}

export class AuthService {
  constructor(
    private readonly providers: AuthProvider[],
    private readonly store: DataStore,
  ) {}

  /** Tries each provider in order; the first non-null context wins. */
  async authenticate(credentials: Credentials): Promise<AuthContext> {
    for (const provider of this.providers) {
      const ctx = await provider.authenticate(credentials);
      if (ctx) return ctx;
    }
    throw new DomainError("UNAUTHORIZED", "Authentication required");
  }

  async currentUser(ctx: AuthContext): Promise<User | null> {
    return ctx.userId ? this.store.users.get(ctx.userId) : null;
  }

  /** Creates an MCP/API token; returns the plaintext exactly once. */
  async createToken(ctx: AuthContext, input: { name: string; level: PermissionLevel; role: Role }): Promise<{ token: string; id: string }> {
    const secret = `rf_${input.level.toLowerCase()}_${newId("tok").slice(4)}${newId("x").slice(2)}`;
    const now = new Date().toISOString();
    const id = newId("mcp");
    await this.store.mcpTokens.insert({
      id,
      organizationId: ctx.organizationId,
      name: input.name,
      tokenHash: await sha256Hex(secret),
      tokenPrefix: secret.slice(0, 10),
      level: input.level,
      role: input.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { token: secret, id };
  }
}
