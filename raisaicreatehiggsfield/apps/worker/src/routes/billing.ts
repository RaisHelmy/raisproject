import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { requireAdmin } from "../middleware/admin";
import { LedgerService } from "../services/ledger-service";
import { AuditLogService } from "../services/audit-log-service";
import { toBalanceDTO, toTransactionDTO } from "../dto/billing";

export const billing = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Middleware is attached per route, not with a wildcard `use`: this router is
// mounted at "/" so a wildcard would also guard unmatched paths and turn
// their 404 into a 401.
const guarded = [requireAuth(), requireCsrf()] as const;

billing.get("/balance", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "billing:read")) throw new AppError("insufficient_scope", "This token cannot read billing.");
  const ledger = new LedgerService(c.env);
  return c.json(toBalanceDTO(await ledger.getBalance(auth.orgId)));
});

billing.get("/balance/transactions", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "billing:read")) throw new AppError("insufficient_scope", "This token cannot read billing.");
  const limit = Number(c.req.query("limit") ?? 25);
  const cursor = c.req.query("cursor");
  const ledger = new LedgerService(c.env);
  const { items, nextCursor } = await ledger.listTransactions(auth.orgId, {
    limit: Number.isFinite(limit) ? limit : 25,
    cursor,
  });
  return c.json({ items: items.map(toTransactionDTO), nextCursor });
});

const depositSchema = z.object({
  orgId: z.string().min(1),
  amountSen: z.number().int().positive(),
  note: z.string().optional(),
});

/**
 * Manual top-up for MVP. A real payment provider writes deposits through
 * PaymentService in task 2.6.4; AI execution never touches the gateway (§121).
 */
billing.post("/admin/balance/deposits", ...guarded, requireAdmin(), async (c) => {
  const auth = c.get("auth");
  const body = depositSchema.parse(await c.req.json());
  const ledger = new LedgerService(c.env);
  const { transactionId, balance } = await ledger.deposit(body.orgId, body.amountSen, {
    referenceType: "admin",
    note: body.note ?? "Manual admin deposit",
    createdBy: auth.userId,
    requestId: auth.requestId,
  });
  await new AuditLogService(c.env).record({
    orgId: body.orgId,
    actorUserId: auth.userId,
    actorType: "user",
    event: "balance.deposit",
    targetType: "balance_transaction",
    targetId: transactionId,
    meta: { amountSen: body.amountSen },
    requestId: auth.requestId,
  });
  return c.json({ transactionId, balance: toBalanceDTO(balance) }, 201);
});
