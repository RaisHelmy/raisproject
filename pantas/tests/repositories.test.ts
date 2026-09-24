import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { users } from "../src/db/schema";
import { createUser, getUserByPhone, setAnonymousMode } from "../src/db/repositories/users";
import { createGroup } from "../src/db/repositories/groups";
import { createDraftJob, getJobById, listJobsForGroup } from "../src/db/repositories/jobs";
import { writeBalancedLedgerEntries, getAccountTotals } from "../src/db/repositories/ledger";
import { appendAuditLog, listAuditLogForEntity } from "../src/db/repositories/auditLog";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
});

describe("users repository", () => {
  it("creates a user as unverified and anonymous-COD-averse by default", async () => {
    const user = await createUser(db, {
      realName: "Ahmad bin Ismail",
      phone: "+60123456789",
      passwordHash: "hashed",
      handle: "Buyer #9QJD",
    });
    expect(user.verificationTier).toBe("unverified");
    expect(user.autoRejectAnonymousCod).toBe(true);

    const found = await getUserByPhone(db, "+60123456789");
    expect(found?.id).toBe(user.id);
  });

  it("refuses to let a verified user enable anonymous mode", async () => {
    const user = await createUser(db, {
      realName: "Siti Aminah",
      phone: "+60123456780",
      passwordHash: "hashed",
      handle: "Buyer #1122",
    });
    // Verified users can never be anonymous per CLAUDE.md — simulate the
    // tier bump an admin would perform, then assert the guard fires.
    await db
      .update(users)
      .set({ verificationTier: "verified" })
      .where(eq(users.id, user.id));
    await expect(setAnonymousMode(db, user.id, true)).rejects.toThrow();
  });
});

describe("group scoping", () => {
  it("never returns another group's jobs from a group-scoped list", async () => {
    const owner = await createUser(db, {
      realName: "Owner",
      phone: "+60111111111",
      passwordHash: "x",
      handle: "Owner #0001",
    });
    const groupA = await createGroup(db, { name: "Condo A", ownerUserId: owner.id });
    const groupB = await createGroup(db, { name: "Condo B", ownerUserId: owner.id });

    const jobA = await createDraftJob(db, {
      groupId: groupA.id,
      type: "delivery",
      purchaserUserId: owner.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 500,
    });
    await createDraftJob(db, {
      groupId: groupB.id,
      type: "delivery",
      purchaserUserId: owner.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 500,
    });

    const groupAJobs = await listJobsForGroup(db, groupA.id);
    expect(groupAJobs.map((j) => j.id)).toEqual([jobA.id]);

    // Cross-group lookup by id must miss, not silently return the row.
    const crossGroupLookup = await getJobById(db, groupB.id, jobA.id);
    expect(crossGroupLookup).toBeNull();
  });

  it("scopes platform-wide (null-group) jobs separately from any real group", async () => {
    const owner = await createUser(db, {
      realName: "Owner2",
      phone: "+60111111112",
      passwordHash: "x",
      handle: "Owner #0002",
    });
    const group = await createGroup(db, { name: "Campus", ownerUserId: owner.id });
    await createDraftJob(db, {
      groupId: null,
      type: "fetch",
      purchaserUserId: owner.id,
      paymentMethod: "cash",
      deliveryFeeMinor: 300,
    });

    expect(await listJobsForGroup(db, group.id)).toHaveLength(0);
    expect(await listJobsForGroup(db, null)).toHaveLength(1);
  });
});

describe("ledger", () => {
  it("rejects an unbalanced batch and writes nothing", async () => {
    await expect(
      writeBalancedLedgerEntries(db, "test:unbalanced", [
        {
          groupId: null,
          jobId: null,
          accountType: "platform_revenue",
          accountRefId: null,
          direction: "credit",
          amountMinor: 200,
        },
        {
          groupId: null,
          jobId: null,
          accountType: "accrued_fee_receivable",
          accountRefId: "runner-1",
          direction: "debit",
          amountMinor: 199,
        },
      ]),
    ).rejects.toThrow(/unbalanced/);

    const totals = await getAccountTotals(db, null, "platform_revenue", null);
    expect(totals.entryCount).toBe(0);
  });

  it("posts a balanced cash-job commission accrual and derives totals from the entries", async () => {
    // Cash job settlement: runner owes the platform a flat fee, modeled as
    // an accrued receivable debited against the runner and credited to
    // platform revenue — never netted into the runner's own outlay.
    await writeBalancedLedgerEntries(db, "job:job-1:settle-fee", [
      {
        groupId: null,
        jobId: null,
        accountType: "accrued_fee_receivable",
        accountRefId: "runner-1",
        direction: "debit",
        amountMinor: 150,
      },
      {
        groupId: null,
        jobId: null,
        accountType: "platform_revenue",
        accountRefId: null,
        direction: "credit",
        amountMinor: 150,
      },
    ]);

    const revenue = await getAccountTotals(db, null, "platform_revenue", null);
    expect(revenue.creditTotal - revenue.debitTotal).toBe(150);

    const receivable = await getAccountTotals(
      db,
      null,
      "accrued_fee_receivable",
      "runner-1",
    );
    expect(receivable.debitTotal - receivable.creditTotal).toBe(150);
  });
});

describe("audit log", () => {
  it("is append-only: the repository exposes no update or delete", async () => {
    const entry = await appendAuditLog(db, {
      actorUserId: "user-1",
      actorRole: "purchaser",
      groupId: null,
      action: "anonymity.enable",
      entityType: "user",
      entityId: "user-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
      requestId: "req-1",
      result: "success",
    });

    const rows = await listAuditLogForEntity(db, "user", "user-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(entry.id);

    const auditLogRepo: Record<string, unknown> = await import(
      "../src/db/repositories/auditLog"
    );
    expect(Object.keys(auditLogRepo)).not.toContain("updateAuditLog");
    expect(Object.keys(auditLogRepo)).not.toContain("deleteAuditLog");
  });
});
