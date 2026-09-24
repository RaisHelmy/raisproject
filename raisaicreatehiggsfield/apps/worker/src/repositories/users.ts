import { newId } from "@raisai/shared";
import type { Env } from "../env";
import { BaseRepository } from "./base";
import { nowIso } from "../db/client";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: "user" | "admin";
  settings_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export class UserRepository extends BaseRepository {
  constructor(env: Pick<Env, "DB">) {
    super(env);
  }

  async create(input: CreateUserInput): Promise<UserRow> {
    const id = newId();
    const now = nowIso();
    await this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, role, settings_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', '{}', ?, ?)`,
      )
      .bind(id, input.email.toLowerCase(), input.passwordHash, input.name, now, now)
      .run();
    const row = await this.findById(id);
    if (!row) throw new Error("failed to read back created user");
    return row;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE lower(email) = ?`)
      .bind(email.toLowerCase())
      .first<UserRow>();
    return row ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const row = await this.db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<UserRow>();
    return row ?? null;
  }
}
