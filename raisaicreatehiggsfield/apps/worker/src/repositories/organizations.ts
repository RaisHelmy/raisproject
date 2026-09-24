import { newId } from "@raisai/shared";
import type { Env } from "../env";
import { BaseRepository } from "./base";
import { nowIso, runBatch } from "../db/client";

export interface OrganizationRow {
  id: string;
  name: string;
  kind: "personal" | "team";
  owner_user_id: string;
  currency: string;
  low_balance_threshold_sen: number;
  created_at: string;
}

export class OrganizationRepository extends BaseRepository {
  constructor(env: Pick<Env, "DB">) {
    super(env);
  }

  /** Creates a personal organization, adds the owner as a member, and seeds a zero balance — one batch. */
  async createPersonal(ownerUserId: string, name: string): Promise<OrganizationRow> {
    const id = newId();
    const now = nowIso();
    await runBatch(this.db, [
      {
        sql: `INSERT INTO organizations (id, name, kind, owner_user_id, currency, low_balance_threshold_sen, created_at)
              VALUES (?, ?, 'personal', ?, 'MYR', 500, ?)`,
        params: [id, name, ownerUserId, now],
      },
      {
        sql: `INSERT INTO organization_members (org_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`,
        params: [id, ownerUserId, now],
      },
      {
        sql: `INSERT INTO balances (org_id, available_sen, reserved_sen, updated_at) VALUES (?, 0, 0, ?)`,
        params: [id, now],
      },
    ]);
    const row = await this.findById(id);
    if (!row) throw new Error("failed to read back created organization");
    return row;
  }

  async findById(id: string): Promise<OrganizationRow | null> {
    const row = await this.db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first<OrganizationRow>();
    return row ?? null;
  }

  /** The org a user lands in by default: their personal org (first membership, owner role, oldest). */
  async findDefaultForUser(userId: string): Promise<OrganizationRow | null> {
    const row = await this.db
      .prepare(
        `SELECT o.* FROM organizations o
         JOIN organization_members m ON m.org_id = o.id
         WHERE m.user_id = ?
         ORDER BY o.kind = 'personal' DESC, o.created_at ASC
         LIMIT 1`,
      )
      .bind(userId)
      .first<OrganizationRow>();
    return row ?? null;
  }
}
