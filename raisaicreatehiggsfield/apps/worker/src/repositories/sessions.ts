import { newId } from "@raisai/shared";
import type { Env } from "../env";
import { BaseRepository } from "./base";
import { nowIso } from "../db/client";

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class SessionRepository extends BaseRepository {
  constructor(env: Pick<Env, "DB">) {
    super(env);
  }

  async create(userId: string, meta: { ip?: string; userAgent?: string }): Promise<SessionRow> {
    const id = newId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    await this.db
      .prepare(`INSERT INTO sessions (id, user_id, expires_at, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, userId, expiresAt, meta.ip ?? null, meta.userAgent ?? null, nowIso())
      .run();
    return { id, user_id: userId, expires_at: expiresAt, ip: meta.ip ?? null, user_agent: meta.userAgent ?? null, created_at: nowIso() };
  }

  async findValid(id: string): Promise<SessionRow | null> {
    const row = await this.db
      .prepare(`SELECT * FROM sessions WHERE id = ? AND expires_at > ?`)
      .bind(id, nowIso())
      .first<SessionRow>();
    return row ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
  }
}
