import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { generateToken, hashToken, AGENT_INVITE_TTL_SECONDS } from "../../core/auth/tokens";
import { tenantUrl } from "../../core/domain/tenant-url";
import { ValidationError, ConflictError } from "../../core/errors";
import { enqueueEmail } from "../../jobs/email";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const inviteAgent: RouteHandler = async (request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "agent.manage");

  const { email, name } = (await request.json()) as { email?: string; name?: string };
  if (!email || !name) throw new ValidationError("email and name are required");
  const normalizedEmail = email.toLowerCase().trim();

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const existing = await db.agents.findByEmail(normalizedEmail);
  if (existing) throw new ConflictError("An agent with this email already exists in this tenant");

  const now = new Date();
  const agentId = uuidv7();
  await db.agents.create({ id: agentId, email: normalizedEmail, name, totpSecret: null, totpEnabled: false, createdAt: now.toISOString(), deletedAt: null });

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(now.getTime() + AGENT_INVITE_TTL_SECONDS * 1000);
  await db.agentInvites.create({ id: uuidv7(), agentId, tokenHash, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString(), consumedAt: null });

  const inviteUrl = tenantUrl({ slug: data.tenant.slug, primaryHostname: data.hostname }, `/accept-invite?token=${encodeURIComponent(token)}`);
  await enqueueEmail(env.JOBS, { type: "agent_invite", tenantId: data.tenantId, to: normalizedEmail, inviteUrl });

  return jsonResponse({ id: agentId }, { status: 201 });
};
