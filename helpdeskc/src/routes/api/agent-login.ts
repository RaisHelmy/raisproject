import { tenantDb } from "../../db/client";
import { verifyPassword } from "../../core/auth/password";
import { generateToken, hashToken, AGENT_SESSION_TTL_SECONDS } from "../../core/auth/tokens";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ForbiddenError, ValidationError } from "../../core/errors";
import { sessionCookie, jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";
import type { Env, RequestData } from "../env";

export const agentLogin: RouteHandler = async (request, env, _ctx, _params, data) => {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  if (!email || !password) throw new ValidationError("email and password are required");

  if (data.tenant.billingState === "suspended") {
    // Suspension disables agent login and write access (CLAUDE.md §12).
    throw new ForbiddenError("This account is suspended");
  }

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const agent = await db.agents.findByEmail(email.toLowerCase().trim());
  // Constant-shape response: don't let a missing agent, or one who hasn't
  // accepted their invite yet, short-circuit the hash comparison.
  const ok = agent?.passwordHash
    ? await verifyPassword(password, agent.passwordHash)
    : await verifyPassword(password, "pbkdf2$1$AA$AA");
  if (!agent || !agent.passwordHash || !ok) throw new UnauthenticatedError("Invalid email or password");

  if (agent.totpEnabled) {
    // TOTP verification step is a separate follow-up endpoint (not built
    // yet) that exchanges a short-lived pre-auth token for a full session.
    return jsonResponse({ requiresTotp: true }, { status: 200 });
  }

  const cookie = await createAgentSession(env, data, agent.id);

  return jsonResponse(
    { agent: { id: agent.id, name: agent.name, email: agent.email } },
    { status: 200, headers: { "Set-Cookie": cookie } },
  );
};

/**
 * The one place an agent session is minted (password login and the
 * super-admin SSO route both go through here). Returns the Set-Cookie value;
 * the raw token is never stored or logged (CLAUDE.md §5.5).
 */
export async function createAgentSession(env: Env, data: RequestData, agentId: string): Promise<string> {
  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AGENT_SESSION_TTL_SECONDS * 1000);

  await db.sessions.create({
    id: uuidv7(),
    subjectType: "agent",
    subjectId: agentId,
    hostname: data.hostname,
    tokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return sessionCookie(token, AGENT_SESSION_TTL_SECONDS);
}
