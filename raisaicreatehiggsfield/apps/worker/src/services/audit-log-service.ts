import { newId } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, type PgDatabase } from "../db/client";

export interface AuditEventInput {
  orgId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "api_key" | "mcp" | "system";
  event: string; // e.g. "login", "signup", "api_key.created" (§111)
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export class AuditLogService {
  private readonly db: PgDatabase;
  constructor(env: Pick<Env, "DB">) {
    this.db = env.DB;
  }

  async record(input: AuditEventInput): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_log (id, org_id, actor_user_id, actor_type, event, target_type, target_id, meta_json, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        input.orgId ?? null,
        input.actorUserId ?? null,
        input.actorType,
        input.event,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.meta ?? {}),
        input.requestId ?? null,
        nowIso(),
      )
      .run();
  }
}
