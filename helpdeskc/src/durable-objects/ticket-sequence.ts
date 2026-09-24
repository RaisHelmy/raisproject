import { DurableObject } from "cloudflare:workers";
import type { Env } from "../routes/env";

/**
 * One instance per tenant (routed via getByName(tenantId)). Mints the
 * per-tenant sequential ticket number shown to humans. MAX(number)+1 on D1
 * would produce duplicates under concurrency (CLAUDE.md §10) — a DO
 * processes one request at a time, so this is race-free without locking.
 */
export class TicketSequence extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS sequence (
          id INTEGER PRIMARY KEY CHECK (id = 0),
          value INTEGER NOT NULL DEFAULT 0
        )
      `);
      this.ctx.storage.sql.exec(`INSERT OR IGNORE INTO sequence (id, value) VALUES (0, 0)`);
    });
  }

  async next(): Promise<number> {
    const result = this.ctx.storage.sql.exec<{ value: number }>(
      `UPDATE sequence SET value = value + 1 WHERE id = 0 RETURNING value`,
    );
    return result.one().value;
  }
}
