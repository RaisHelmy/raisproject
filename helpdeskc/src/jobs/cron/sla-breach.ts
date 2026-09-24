import { platformDb } from "../../db/platform-client";
import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { enqueueEmail } from "../email";
import type { Env } from "../../routes/env";

/**
 * Runs on the cron trigger. Iterates tenants, then within each tenant
 * queries the (tenant_id, sla_resolution_due_at) index for tickets due
 * now-or-earlier that aren't already flagged — never a full ticket scan
 * (CLAUDE.md §10).
 */
export async function runSlaBreachCheck(env: Env): Promise<void> {
  const platform = platformDb(env.HYPERDRIVE);
  const tenantIds = await platform.tenants.listNonCancelledIds();
  const now = new Date().toISOString();

  for (const tenantId of tenantIds) {
    const db = tenantDb(env.HYPERDRIVE, tenantId);
    const dueSoon = await db.tickets.dueSoon(now);

    for (const ticket of dueSoon) {
      await db.tickets.update(ticket.id, { slaBreached: true, updatedAt: now });
      await db.ticketEvents.create({
        id: uuidv7(),
        ticketId: ticket.id,
        type: "sla_breach",
        actorType: "system",
        actorId: null,
        data: JSON.stringify({ slaResolutionDueAt: ticket.slaResolutionDueAt }),
        createdAt: now,
      });

      if (ticket.assigneeAgentId) {
        const agent = await db.agents.get(ticket.assigneeAgentId);
        if (agent) {
          await enqueueEmail(env.JOBS, {
            type: "ticket_notification",
            tenantId,
            to: agent.email,
            ticketId: ticket.id,
            message: `Ticket #${ticket.number} has breached its SLA.`,
          });
        }
      }
    }
  }
}
