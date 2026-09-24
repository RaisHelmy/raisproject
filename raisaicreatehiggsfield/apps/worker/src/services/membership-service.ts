import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, runBatch } from "../db/client";
import { AuditLogService } from "./audit-log-service";

export type MemberRole = "owner" | "admin" | "member";

export interface MemberRow {
  user_id: string;
  role: MemberRole;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Workspace membership (§70).
 *
 * Organizations already carry the balance, projects and everything made in
 * them, so sharing a workspace is sharing a wallet. That is why adding someone
 * is deliberate, roles are explicit, and the last owner cannot be removed.
 */
export class MembershipService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async list(auth: AuthContext): Promise<MemberRow[]> {
    const { results } = await this.env.DB
      .prepare(
        `SELECT m.user_id, m.role, m.created_at, u.name, u.email
           FROM organization_members m JOIN users u ON u.id = m.user_id
          WHERE m.org_id = ? ORDER BY m.created_at`,
      )
      .bind(auth.orgId)
      .all<MemberRow>();
    return results;
  }

  /** Adds an existing account to this workspace. */
  async add(auth: AuthContext, email: string, role: MemberRole = "member"): Promise<MemberRow> {
    await this.assertCanManage(auth);
    if (role === "owner") {
      throw new AppError("invalid_input", "A workspace has one owner.", {
        action: "Add them as an admin instead, or transfer ownership.",
      });
    }

    const user = await this.env.DB
      // Compared case-insensitively on both sides: email case is not
      // meaningful, and matching only lowercase rows would depend on how the
      // account happened to be created.
      .prepare(`SELECT id, name, email FROM users WHERE lower(email) = ?`)
      .bind(email.trim().toLowerCase())
      .first<{ id: string; name: string; email: string }>();
    // Whether an email has an account is not something an outsider should be
    // able to probe, so this says what to do rather than confirming or denying.
    if (!user) {
      throw new AppError("not_found", "No RaisAI account uses that email yet.", {
        action: "Ask them to sign up first, then add them.",
      });
    }

    const existing = await this.env.DB
      .prepare(`SELECT user_id FROM organization_members WHERE org_id = ? AND user_id = ?`)
      .bind(auth.orgId, user.id)
      .first();
    if (existing) throw new AppError("conflict", "They are already in this workspace.");

    await this.env.DB
      .prepare(`INSERT INTO organization_members (org_id, user_id, role, created_at) VALUES (?,?,?,?)`)
      .bind(auth.orgId, user.id, role, nowIso())
      .run();

    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event: "member.added", targetType: "user", targetId: user.id,
      meta: { role }, requestId: auth.requestId,
    });

    return { user_id: user.id, role, name: user.name, email: user.email, created_at: nowIso() };
  }

  async setRole(auth: AuthContext, userId: string, role: MemberRole): Promise<void> {
    await this.assertCanManage(auth);
    if (role === "owner") throw new AppError("invalid_input", "Use transfer ownership to change the owner.");

    const owner = await this.isLastOwner(auth.orgId, userId);
    if (owner) {
      throw new AppError("invalid_input", "The workspace would be left without an owner.", {
        action: "Make someone else the owner first.",
      });
    }
    await this.env.DB
      .prepare(`UPDATE organization_members SET role = ? WHERE org_id = ? AND user_id = ?`)
      .bind(role, auth.orgId, userId)
      .run();
  }

  async remove(auth: AuthContext, userId: string): Promise<void> {
    await this.assertCanManage(auth);
    if (await this.isLastOwner(auth.orgId, userId)) {
      throw new AppError("invalid_input", "A workspace cannot be left without an owner.", {
        action: "Transfer ownership first.",
      });
    }
    await this.env.DB
      .prepare(`DELETE FROM organization_members WHERE org_id = ? AND user_id = ?`)
      .bind(auth.orgId, userId)
      .run();

    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event: "member.removed", targetType: "user", targetId: userId, requestId: auth.requestId,
    });
  }

  /** Hands the workspace to someone else, in one transaction. */
  async transferOwnership(auth: AuthContext, userId: string): Promise<void> {
    const role = await this.roleOf(auth.orgId, auth.userId);
    if (role !== "owner") throw new AppError("forbidden", "Only the owner can transfer a workspace.");

    const target = await this.roleOf(auth.orgId, userId);
    if (!target) throw new AppError("not_found", "They are not in this workspace.");

    await runBatch(this.env.DB, [
      { sql: `UPDATE organization_members SET role = 'admin' WHERE org_id = ? AND user_id = ?`, params: [auth.orgId, auth.userId] },
      { sql: `UPDATE organization_members SET role = 'owner' WHERE org_id = ? AND user_id = ?`, params: [auth.orgId, userId] },
      { sql: `UPDATE organizations SET owner_user_id = ? WHERE id = ?`, params: [userId, auth.orgId] },
    ]);

    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event: "ownership.transferred", targetType: "user", targetId: userId, requestId: auth.requestId,
    });
  }

  async roleOf(orgId: string, userId: string): Promise<MemberRole | null> {
    const row = await this.env.DB
      .prepare(`SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?`)
      .bind(orgId, userId)
      .first<{ role: MemberRole }>();
    return row?.role ?? null;
  }

  private async assertCanManage(auth: AuthContext): Promise<void> {
    // Managing members means granting access to a shared balance, so it stays
    // with signed-in owners and admins; a bearer key cannot do it.
    if (auth.actorType !== "user") {
      throw new AppError("forbidden", "Manage members from the web app.");
    }
    const role = await this.roleOf(auth.orgId, auth.userId);
    if (role !== "owner" && role !== "admin") {
      throw new AppError("forbidden", "Only an owner or admin can manage members.");
    }
  }

  private async isLastOwner(orgId: string, userId: string): Promise<boolean> {
    const role = await this.roleOf(orgId, userId);
    if (role !== "owner") return false;
    const { results } = await this.env.DB
      .prepare(`SELECT user_id FROM organization_members WHERE org_id = ? AND role = 'owner'`)
      .bind(orgId)
      .all();
    return results.length <= 1;
  }
}

export { newId };
