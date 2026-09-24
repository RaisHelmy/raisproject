import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import { listPayoutBatchesForPayee, markPayoutBatchPaid } from "../../db/repositories/payouts";

const payouts = new Hono<AppEnv>();

payouts.get("/mine", requireRole("runner", "vendor"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listPayoutBatchesForPayee(db, session.groupId, session.userId));
});

payouts.post("/:id/mark-paid", requireRole("admin"), async (c) => {
  const db = await createDb(c.env);
  await markPayoutBatchPaid(db, c.req.param("id"));
  return c.json({ ok: true });
});

export default payouts;
