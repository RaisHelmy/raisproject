import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { NotFoundError, ValidationError, ConflictError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

export const createContact: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "account.manage");

  const { email, name, teamId } = (await request.json()) as { email?: string; name?: string; teamId?: string };
  if (!email || !name) throw new ValidationError("email and name are required");
  const normalizedEmail = email.toLowerCase().trim();

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const account = await db.accounts.get(params.id!);
  if (!account) throw new NotFoundError("Account");

  if (teamId) {
    const team = await db.teams.get(teamId);
    if (!team || team.accountId !== account.id) throw new ValidationError("teamId does not belong to this account");
  }

  // Unique per (tenant_id, email) — CLAUDE.md §7.
  const existing = await db.contacts.findByEmail(normalizedEmail);
  if (existing) throw new ConflictError("A contact with this email already exists in this tenant");

  const id = uuidv7();
  await db.contacts.create({
    id,
    accountId: account.id,
    teamId: teamId ?? null,
    email: normalizedEmail,
    name,
    passwordHash: null,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  });

  return jsonResponse({ id }, { status: 201 });
};
