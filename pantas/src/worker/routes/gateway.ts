import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import { getJobById } from "../../db/repositories/jobs";
import { appendAuditLog, listAuditLogForEntity } from "../../db/repositories/auditLog";
import { getGatewayProvider } from "../payments/gatewayProvider";
import { getRequestContext } from "../requestContext";

const gateway = new Hono<AppEnv>();

/**
 * Charges the purchaser at the point of the order for a `gateway`-payment
 * job (CLAUDE.md "Money"). Idempotent per job: a prior successful charge
 * short-circuits rather than double-charging. Uses the sandbox provider
 * until real gateway credentials exist — see
 * src/worker/payments/gatewayProvider.ts.
 */
gateway.post("/jobs/:id/charge", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const job = await getJobById(db, session.groupId, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.purchaserUserId !== session.userId) return c.json({ error: "forbidden" }, 403);
  if (job.paymentMethod !== "gateway") {
    return c.json({ error: "job is not a gateway-payment job" }, 400);
  }

  const existing = await listAuditLogForEntity(db, "job", job.id);
  const alreadyCharged = existing.some(
    (e) => e.action === "payment.charge" && e.result === "success",
  );
  if (alreadyCharged) return c.json({ ok: true, alreadyCharged: true });

  const provider = getGatewayProvider(c.env);
  const total = job.deliveryFeeMinor + (job.itemCostMinor ?? 0);
  const result = await provider.charge({
    amountMinor: total,
    currency: "MYR",
    idempotencyKey: `job:${job.id}:charge`,
    description: `Pantas job ${job.id}`,
  });

  const ctx = getRequestContext();
  await appendAuditLog(db, {
    actorUserId: session.userId,
    actorRole: session.activeRole,
    groupId: session.groupId,
    action: "payment.charge",
    entityType: "job",
    entityId: job.id,
    afterJson: result,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
    requestId: c.get("requestId"),
    result: result.status === "succeeded" ? "success" : "failure",
    resultReason: result.status === "succeeded" ? undefined : "gateway declined",
  });

  return c.json(result, result.status === "succeeded" ? 201 : 402);
});

export default gateway;
