import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser, getUserById } from "../src/db/repositories/users";
import { createDraftJob } from "../src/db/repositories/jobs";
import {
  NON_PAYMENT_AUTO_SUSPEND_THRESHOLD,
  reportNonPaymentAndMaybeSuspend,
} from "../src/db/services/nonPaymentGuard";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
});

describe("non-payment tracking & auto-suspend", () => {
  it("tracks incidents against the real identity and does not suspend below threshold", async () => {
    const purchaser = await createUser(db, {
      realName: "Purchaser",
      phone: "+60155500001",
      passwordHash: "x",
      handle: "Buyer #N001",
    });
    const runner = await createUser(db, {
      realName: "Runner",
      phone: "+60155500002",
      passwordHash: "x",
      handle: "Runner #N002",
    });

    for (let i = 0; i < NON_PAYMENT_AUTO_SUSPEND_THRESHOLD - 1; i++) {
      const job = await createDraftJob(db, {
        groupId: null,
        type: "delivery",
        purchaserUserId: purchaser.id,
        paymentMethod: "cash",
        deliveryFeeMinor: 1000,
      });
      const result = await reportNonPaymentAndMaybeSuspend(db, {
        jobId: job.id,
        purchaserUserId: purchaser.id,
        reportedByUserId: runner.id,
        amountMinor: 1000,
      });
      expect(result.suspended).toBe(false);
    }

    const stillActive = await getUserById(db, purchaser.id);
    expect(stillActive?.status).toBe("active");
  });

  it("auto-suspends once unresolved incidents reach the threshold", async () => {
    const purchaser = await createUser(db, {
      realName: "Purchaser2",
      phone: "+60155500003",
      passwordHash: "x",
      handle: "Buyer #N003",
    });
    const runner = await createUser(db, {
      realName: "Runner2",
      phone: "+60155500004",
      passwordHash: "x",
      handle: "Runner #N004",
    });

    let last;
    for (let i = 0; i < NON_PAYMENT_AUTO_SUSPEND_THRESHOLD; i++) {
      const job = await createDraftJob(db, {
        groupId: null,
        type: "delivery",
        purchaserUserId: purchaser.id,
        paymentMethod: "cash",
        deliveryFeeMinor: 1000,
      });
      last = await reportNonPaymentAndMaybeSuspend(db, {
        jobId: job.id,
        purchaserUserId: purchaser.id,
        reportedByUserId: runner.id,
        amountMinor: 1000,
      });
    }

    expect(last?.suspended).toBe(true);
    const suspended = await getUserById(db, purchaser.id);
    expect(suspended?.status).toBe("suspended");
  });
});
