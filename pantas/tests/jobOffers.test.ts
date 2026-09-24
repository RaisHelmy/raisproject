import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser } from "../src/db/repositories/users";
import { createDraftJob, getJobById, postJob } from "../src/db/repositories/jobs";
import {
  acceptOffer,
  createOffer,
  listOffersForJob,
  rejectOffer,
  withdrawOffer,
} from "../src/db/repositories/jobOffers";

let db: Db;

async function seedPostedJob(db: Db) {
  const purchaser = await createUser(db, {
    realName: "Purchaser",
    phone: "+60100000001",
    passwordHash: "x",
    handle: "Buyer #0001",
  });
  const draft = await createDraftJob(db, {
    groupId: null,
    type: "delivery",
    purchaserUserId: purchaser.id,
    paymentMethod: "cash",
    deliveryFeeMinor: 1000,
  });
  const job = await postJob(db, null, draft.id);
  return { purchaser, job };
}

beforeEach(async () => {
  db = await createPgTestDb();
});

describe("job offers (negotiation)", () => {
  it("lets a runner counter-offer without claiming the job", async () => {
    const { job } = await seedPostedJob(db);
    const runner = await createUser(db, {
      realName: "Runner",
      phone: "+60100000002",
      passwordHash: "x",
      handle: "Runner #A72K",
    });

    const offer = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runner.id,
      proposedFeeMinor: 1500,
    });
    expect(offer.status).toBe("pending");

    // Counter-offering must not itself claim the job or touch its price —
    // FCFS claiming stays the default, unaffected path.
    const untouchedJob = await getJobById(db, null, job.id);
    expect(untouchedJob?.status).toBe("posted");
    expect(untouchedJob?.deliveryFeeMinor).toBe(1000);
  });

  it("accepting an offer sets the negotiated price, assigns the runner, and claims the job", async () => {
    const { job } = await seedPostedJob(db);
    const runner = await createUser(db, {
      realName: "Runner",
      phone: "+60100000003",
      passwordHash: "x",
      handle: "Runner #B91X",
    });
    const offer = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runner.id,
      proposedFeeMinor: 1200,
    });

    await acceptOffer(db, null, offer.id);

    const updatedJob = await getJobById(db, null, job.id);
    expect(updatedJob?.status).toBe("claimed");
    expect(updatedJob?.deliveryFeeMinor).toBe(1200);
    expect(updatedJob?.runnerUserId).toBe(runner.id);
  });

  it("auto-rejects every other pending offer on the same job when one is accepted", async () => {
    const { job } = await seedPostedJob(db);
    const runnerA = await createUser(db, {
      realName: "Runner A",
      phone: "+60100000004",
      passwordHash: "x",
      handle: "Runner #C10A",
    });
    const runnerB = await createUser(db, {
      realName: "Runner B",
      phone: "+60100000005",
      passwordHash: "x",
      handle: "Runner #D20B",
    });

    const offerA = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runnerA.id,
      proposedFeeMinor: 1100,
    });
    const offerB = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runnerB.id,
      proposedFeeMinor: 1300,
    });

    await acceptOffer(db, null, offerA.id);

    const offers = await listOffersForJob(db, null, job.id);
    const statusById = new Map(offers.map((o) => [o.id, o.status]));
    expect(statusById.get(offerA.id)).toBe("accepted");
    expect(statusById.get(offerB.id)).toBe("rejected");
  });

  it("refuses to accept an offer that is no longer pending", async () => {
    const { job } = await seedPostedJob(db);
    const runner = await createUser(db, {
      realName: "Runner",
      phone: "+60100000006",
      passwordHash: "x",
      handle: "Runner #E30C",
    });
    const offer = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runner.id,
      proposedFeeMinor: 900,
    });
    await withdrawOffer(db, null, offer.id);
    await expect(acceptOffer(db, null, offer.id)).rejects.toThrow(/withdrawn/);
  });

  it("refuses to reject an offer twice", async () => {
    const { job } = await seedPostedJob(db);
    const runner = await createUser(db, {
      realName: "Runner",
      phone: "+60100000007",
      passwordHash: "x",
      handle: "Runner #F40D",
    });
    const offer = await createOffer(db, {
      groupId: null,
      jobId: job.id,
      runnerUserId: runner.id,
      proposedFeeMinor: 900,
    });
    await rejectOffer(db, null, offer.id);
    await expect(rejectOffer(db, null, offer.id)).rejects.toThrow(/rejected/);
  });
});
