import { platformDb } from "../../db/platform-client";
import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { applyTransition, isDueForAutoClose } from "../../core/ticket/state";
import type { Env } from "../../routes/env";

// No per-tenant settings table yet (CLAUDE.md §10 default) — a per-tenant
// override belongs on a future tenant-settings table, not hardcoded here.
const AUTO_CLOSE_WINDOW_DAYS = 7;

export async function runAutoCloseResolved(env: Env): Promise<void> {
  const platform = platformDb(env.HYPERDRIVE);
  const tenantIds = await platform.tenants.listNonCancelledIds();
  const now = new Date().toISOString();
  const threshold = new Date(Date.now() - AUTO_CLOSE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const tenantId of tenantIds) {
    const db = tenantDb(env.HYPERDRIVE, tenantId);
    const resolved = await db.tickets.resolvedBefore(threshold);

    for (const ticket of resolved) {
      if (!isDueForAutoClose(ticket.resolvedAt!, now, AUTO_CLOSE_WINDOW_DAYS)) continue;

      const result = applyTransition({
        from: ticket.status,
        to: "closed",
        actor: "system",
        now,
        slaPausedAt: ticket.slaPausedAt,
        slaPausedTotalSeconds: ticket.slaPausedTotalSeconds,
      });

      await db.tickets.update(ticket.id, {
        status: result.status,
        updatedAt: now,
        closedAt: result.closedAt,
        slaPausedAt: result.slaPausedAt,
        slaPausedTotalSeconds: result.slaPausedTotalSeconds,
      });

      await db.ticketEvents.create({
        id: uuidv7(),
        ticketId: ticket.id,
        type: "status_change",
        actorType: "system",
        actorId: null,
        data: JSON.stringify({ from: "resolved", to: "closed", reason: "auto_close" }),
        createdAt: now,
      });
    }
  }
}
