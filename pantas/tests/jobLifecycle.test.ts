import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser } from "../src/db/repositories/users";
import { createPerkRule } from "../src/db/repositories/perkRules";
import {
  cancelJob,
  claimJob,
  createDraftJob,
  isPriorityRunner,
  markDelivered,
  markInTransit,
  markPickedUp,
  postJob,
  PRIORITY_WINDOW_SECONDS,
} from "../src/db/repositories/jobs";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
});

async function seedPurchaserAndRunner(db: Db) {
  const purchaser = await createUser(db, {
    realName: "Purchaser",
    phone: "+60122200001",
    passwordHash: "x",
    handle: "Buyer #L001",
  });
  const runner = await createUser(db, {
    realName: "Runner",
    phone: "+60122200002",
    passwordHash: "x",
    handle: "Runner #L002",
  });
  return { purchaser, runner };
}

describe("job lifecycle state machine", () => {
  it("walks the full happy path draft -> posted -> claimed -> picked_up -> in_transit -> delivered", async () => {
    const { purchaser, runner } = await seedPurchaserAndRunner(db);
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "delivery",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 800,
    });
    expect(draft.status).toBe("draft");

    const posted = await postJob(db, null, draft.id);
    expect(posted.status).toBe("posted");
    expect(posted.postedAt).toBeTruthy();

    // Outside the 60s priority window in these tests (postedAt is "now",
    // so we're actually inside it) — grant priority via a perk rule so the
    // claim isn't rejected by the window check.
    await createPerkRule(db, {
      name: "unverified priority (test)",
      verificationTier: "unverified",
      perkType: "priority_window",
    });

    const claimed = await claimJob(db, null, draft.id, runner.id);
    expect(claimed.status).toBe("claimed");
    expect(claimed.runnerUserId).toBe(runner.id);

    const pickedUp = await markPickedUp(db, null, draft.id);
    expect(pickedUp.status).toBe("picked_up");

    const inTransit = await markInTransit(db, null, draft.id);
    expect(inTransit.status).toBe("in_transit");

    const delivered = await markDelivered(db, null, draft.id);
    expect(delivered.status).toBe("delivered");
  });

  it("rejects a skipped transition (posted straight to picked_up)", async () => {
    const { purchaser } = await seedPurchaserAndRunner(db);
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "delivery",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 800,
    });
    await postJob(db, null, draft.id);
    await expect(markPickedUp(db, null, draft.id)).rejects.toThrow(/invalid job transition/);
  });

  it("rejects claiming a job still in its priority window without perk eligibility", async () => {
    const { purchaser, runner } = await seedPurchaserAndRunner(db);
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "delivery",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 800,
    });
    await postJob(db, null, draft.id);
    // No priority_window perk rule exists — runner is unverified and not eligible.
    await expect(claimJob(db, null, draft.id, runner.id)).rejects.toThrow(/priority window/);
  });

  it("allows claiming after the priority window elapses, even without perk eligibility", async () => {
    // Postgres cutover note: fake ALL timers (the vi.useFakeTimers()
    // default) also faked setTimeout/setInterval, which the postgres.js
    // driver's real TCP socket handling depends on — that hung every query
    // against the real Postgres connection until the test timed out. Only
    // Date needs faking here (claimJob compares against the real clock via
    // `new Date()`), so scope it to that.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { purchaser, runner } = await seedPurchaserAndRunner(db);
      const draft = await createDraftJob(db, {
        groupId: null,
        type: "delivery",
        purchaserUserId: purchaser.id,
        paymentMethod: "cash",
        deliveryFeeMinor: 800,
      });
      await postJob(db, null, draft.id);
      vi.advanceTimersByTime((PRIORITY_WINDOW_SECONDS + 1) * 1000);
      const claimed = await claimJob(db, null, draft.id, runner.id);
      expect(claimed.status).toBe("claimed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("isPriorityRunner is driven by perk_rules data, not a hardcoded check", async () => {
    const { runner } = await seedPurchaserAndRunner(db);
    expect(await isPriorityRunner(db, null, runner.id)).toBe(false);
    await createPerkRule(db, {
      name: "unverified priority (test)",
      verificationTier: "unverified",
      perkType: "priority_window",
    });
    expect(await isPriorityRunner(db, null, runner.id)).toBe(true);
  });

  it("allows cancelling from draft/posted/claimed but not after pickup", async () => {
    const { purchaser } = await seedPurchaserAndRunner(db);
    const draft = await createDraftJob(db, {
      groupId: null,
      type: "delivery",
      purchaserUserId: purchaser.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 800,
    });
    const cancelled = await cancelJob(db, null, draft.id, "purchaser changed their mind");
    expect(cancelled.status).toBe("cancelled");
  });
});
