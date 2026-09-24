import { tenantDb } from "../../db/client";
import { hashPassword } from "../../core/auth/password";
import { generateToken, hashToken, AGENT_SESSION_TTL_SECONDS } from "../../core/auth/tokens";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ValidationError } from "../../core/errors";
import { sessionCookie, jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

export const acceptAgentInvite: RouteHandler = async (request, env, _ctx, _params, data) => {
  const { token, password } = (await request.json()) as { token?: string; password?: string };
  if (!token || !password || password.length < 8) throw new ValidationError("token and an 8+ character password are required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const tokenHash = await hashToken(token);
  const invite = await db.agentInvites.findByTokenHash(tokenHash);

  if (!invite || invite.consumedAt || Date.parse(invite.expiresAt) <= Date.now()) {
    throw new UnauthenticatedError("This invite is invalid or has expired");
  }

  const passwordHash = await hashPassword(password);
  await db.agents.setPasswordHash(invite.agentId, passwordHash);
  await db.agentInvites.consume(invite.id);

  const agent = await db.agents.get(invite.agentId);
  if (!agent) throw new UnauthenticatedError();

  const sessionToken = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AGENT_SESSION_TTL_SECONDS * 1000);
  await db.sessions.create({
    id: uuidv7(),
    subjectType: "agent",
    subjectId: agent.id,
    hostname: data.hostname,
    tokenHash: await hashToken(sessionToken),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return jsonResponse(
    { agent: { id: agent.id, name: agent.name, email: agent.email } },
    { status: 200, headers: { "Set-Cookie": sessionCookie(sessionToken, AGENT_SESSION_TTL_SECONDS) } },
  );
};
