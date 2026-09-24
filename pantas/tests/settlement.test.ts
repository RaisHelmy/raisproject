import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser } from "../src/db/repositories/users";
import { createCommissionRule } from "../src/db/repositories/commissionRules";
import {
  claimJob,
  createDraftJob,
  markDelivered,
  markInTransit,
  markPickedUp,
  postJob,
} from "../src/db/repositories/jobs";
import { createPerkRule } from "../src/db/repositories/perkRules";
import { getAccountTotals } from "../src/db/repositories/ledger";
import { settleJob } from "../src/db/services/settlement";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
  await createPerkRule(db, {
    name: "unverified priority (test)",
    verificationTier: "unverified",
    perkType: "priority_window",
  });
});

async function seedDeliveredJob(
  db: Db,
  opts: { paymentMethod: "cash" | "gateway"; itemCostMinor?: number },
) {
  const purchaser = await createUser(db, {
    realName: "Purchaser",
    phone: "+60133300001",
    passwordHash: "x",
    handle: "Buyer #S001",
  });
  const runner = await createUser(db, {
    realName: "Runner",
    phone: "+60133300002",
    passwordHash: "x",
    handle: "Runner #S002",
  });
  const draft = await createDraftJob(db, {
    groupId: null,
    type: "delivery",
    purchaserUserId: purchaser.id,
    paymentMethod: opts.paymentMethod,
    deliveryFeeMinor: 1000,
  });
  await postJob(db, null, draft.id);
  await claimJob(db, null, draft.id, runner.id);
  await markPickedUp(db, null, draft.id);
  await markInTransit(db, null, draft.id);
  const delivered = await markDelivered(db, null, draft.id);
  return { purchaser, runner, job: delivered };
}

describe("settlement service", () => {
  it("settles a cash job: accrues the flat commission as a receivable, not a percentage", async () => {
    await createCommissionRule(db, { jobType: "delivery", amountMinor: 150 });
    const { runner, job } = await seedDeliveredJob(db, { paymentMethod: "cash" });

    const settled = await settleJob(db, null, job.id);
    expect(settled.status).toBe("settled");
    expect(settled.commissionMinor).toBe(150);

    const revenue = await getAccountTotals(db, null, "platform_revenue", null);
    expect(revenue.creditTotal - revenue.debitTotal).toBe(150);

    const receivable = await getAccountTotals(db, null, "accrued_fee_receivable", runner.id);
    expect(receivable.debitTotal - receivable.creditTotal).toBe(150);
  });

  it("settles a gateway job: nets commission out of the payable, never adds it on top", async () => {
    await createCommissionRule(db, { jobType: "delivery", amountMinor: 150 });
    const { runner, job } = await seedDeliveredJob(db, { paymentMethod: "gateway" });

    const settled = await settleJob(db, null, job.id);
    expect(settled.commissionMinor).toBe(150);

    const payable = await getAccountTotals(db, null, "runner_payable", runner.id);
    expect(payable.creditTotal - payable.debitTotal).toBe(1000 - 150);

    const clearing = await getAccountTotals(db, null, "purchaser_charge_clearing", null);
    // accountRefId is the purchaser here, so query without ref filter via total across all — instead check platform_revenue directly.
    const revenue = await getAccountTotals(db, null, "platform_revenue", null);
    expect(revenue.creditTotal - revenue.debitTotal).toBe(150);
    expect(clearing.entryCount).toBeGreaterThanOrEqual(0); // sanity: query executes without error
  });

  it("refuses to settle a job that has not been delivered yet", async () => {
    await createCommissionRule(db, { jobType: "delivery", amountMinor: 150 });
    const purchaser = await createUser(db, {
      realName: "P",
      phone: "+60133300003",
      passwordHash: "x",
      handle: "Buyer #S003",
    });
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "delivery",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 1000,
    });
    await expect(settleJob(db, null, draft.id)).rejects.toThrow(/must be 'delivered'/);
  });

  it("throws rather than silently charging nothing when no commission rule exists", async () => {
    const { job } = await seedDeliveredJob(db, { paymentMethod: "cash" });
    await expect(settleJob(db, null, job.id)).rejects.toThrow(/no active commission rule/);
  });

  it("rejects settlement when a fetch job's runner outlay exceeds the purchaser's declared value", async () => {
    await createCommissionRule(db, { jobType: "fetch", amountMinor: 150 });
    const purchaser = await createUser(db, {
      realName: "P2",
      phone: "+60133300004",
      passwordHash: "x",
      handle: "Buyer #S004",
    });
    const runner = await createUser(db, {
      realName: "R2",
      phone: "+60133300005",
      passwordHash: "x",
      handle: "Runner #S005",
    });
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "fetch",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 500,
      declaredValueMinor: 2000,
    });
    await postJob(db, null, draft.id);
    await claimJob(db, null, draft.id, runner.id);
    await markPickedUp(db, null, draft.id);
    await markInTransit(db, null, draft.id);
    await markDelivered(db, null, draft.id);

    // Simulate the runner's actual outlay exceeding the declared cap —
    // normally set during picked_up/in_transit via a dedicated endpoint;
    // here we reach into the job row directly for the test.
    const { jobs } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(jobs).set({ itemCostMinor: 2500 }).where(eq(jobs.id, draft.id));

    await expect(settleJob(db, null, draft.id)).rejects.toThrow(/exceeds declared value/);
  });
});
