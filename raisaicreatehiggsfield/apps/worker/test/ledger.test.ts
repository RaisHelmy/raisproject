import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { AppError, newId } from "@raisai/shared";
import { LedgerService } from "../src/services/ledger-service";

async function makeOrg(availableSen = 0): Promise<string> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Ledger User")
    .run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Test workspace", userId)
    .run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen, reserved_sen) VALUES (?,?,0)`)
    .bind(orgId, availableSen)
    .run();
  return orgId;
}

describe("LedgerService", () => {
  let ledger: LedgerService;
  beforeEach(() => {
    ledger = new LedgerService(env);
  });

  it("deposits funds and records a transaction", async () => {
    const orgId = await makeOrg();
    const { balance } = await ledger.deposit(orgId, 5000, { requestId: "req1" });
    expect(balance.availableSen).toBe(5000);

    const { items } = await ledger.listTransactions(orgId);
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe("deposit");
    expect(items[0]!.amount_sen).toBe(5000);
    expect(items[0]!.balance_after_sen).toBe(5000);
  });

  it("reserves against available and moves funds into reserved", async () => {
    const orgId = await makeOrg(5000);
    const { balance } = await ledger.reserve(orgId, 38, { referenceType: "generation", referenceId: "gen1" });
    expect(balance.availableSen).toBe(4962);
    expect(balance.reservedSen).toBe(38);
  });

  it("rejects a reservation larger than available with the shortfall attached", async () => {
    const orgId = await makeOrg(320);
    await expect(ledger.reserve(orgId, 840)).rejects.toMatchObject({
      code: "insufficient_balance",
      details: { estimatedSen: 840, availableSen: 320 },
    });
    const balance = await ledger.getBalance(orgId);
    expect(balance.availableSen).toBe(320);
    expect(balance.reservedSen).toBe(0);
  });

  it("settles a reservation charging actual and refunding the remainder", async () => {
    const orgId = await makeOrg(5000);
    const { reservationId } = await ledger.reserve(orgId, 50, { referenceType: "generation", referenceId: "gen2" });
    const result = await ledger.settleReservation(reservationId, 38);

    expect(result).toMatchObject({ chargedSen: 38, refundedSen: 12, overageSen: 0 });
    expect(result.balance.availableSen).toBe(4962);
    expect(result.balance.reservedSen).toBe(0);

    const { items } = await ledger.listTransactions(orgId);
    expect(items.map((i) => i.type).sort()).toEqual(["charge", "refund", "reservation"]);
  });

  it("charges an overage against available and allows a negative balance", async () => {
    const orgId = await makeOrg(100);
    const { reservationId } = await ledger.reserve(orgId, 100);
    const result = await ledger.settleReservation(reservationId, 150);

    expect(result).toMatchObject({ chargedSen: 100, refundedSen: 0, overageSen: 50 });
    // Provider was already paid, so the debt is recorded rather than failing.
    expect(result.balance.availableSen).toBe(-50);
    expect(result.balance.reservedSen).toBe(0);
  });

  it("releases a reservation in full when nothing was spent", async () => {
    const orgId = await makeOrg(1000);
    const { reservationId } = await ledger.reserve(orgId, 400);
    const result = await ledger.releaseReservation(reservationId);
    expect(result).toMatchObject({ chargedSen: 0, refundedSen: 400 });
    const balance = await ledger.getBalance(orgId);
    expect(balance.availableSen).toBe(1000);
    expect(balance.reservedSen).toBe(0);
  });

  it("refuses to settle the same reservation twice", async () => {
    const orgId = await makeOrg(1000);
    const { reservationId } = await ledger.reserve(orgId, 100);
    await ledger.settleReservation(reservationId, 60);
    await expect(ledger.settleReservation(reservationId, 60)).rejects.toMatchObject({ code: "conflict" });
  });

  it("never lets concurrent reservations overdraw the balance", async () => {
    const orgId = await makeOrg(100);
    // Two 60-sen holds against 100 sen: exactly one must win.
    const results = await Promise.allSettled([ledger.reserve(orgId, 60), ledger.reserve(orgId, 60)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
    expect(((rejected[0] as PromiseRejectedResult).reason as AppError).code).toBe("insufficient_balance");

    const balance = await ledger.getBalance(orgId);
    expect(balance.availableSen).toBe(40);
    expect(balance.reservedSen).toBe(60);
  });

  it("requires a note on adjustments and applies signed amounts", async () => {
    const orgId = await makeOrg(1000);
    await expect(ledger.adjust(orgId, -100, "  ")).rejects.toMatchObject({ code: "invalid_input" });
    const { balance } = await ledger.adjust(orgId, -100, "Goodwill correction");
    expect(balance.availableSen).toBe(900);
  });

  it("rejects non-integer and non-positive amounts", async () => {
    const orgId = await makeOrg(1000);
    await expect(ledger.deposit(orgId, 10.5)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(ledger.reserve(orgId, 0)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("can replay balances from the ledger alone, including overage", async () => {
    const orgId = await makeOrg();
    await ledger.deposit(orgId, 5000);
    const first = await ledger.reserve(orgId, 200);
    await ledger.settleReservation(first.reservationId, 175);
    const second = await ledger.reserve(orgId, 100);
    await ledger.settleReservation(second.reservationId, 130); // 30 sen overage
    await ledger.adjust(orgId, -25, "Support credit reversal");

    const { items } = await ledger.listTransactions(orgId, { limit: 100 });
    const available = items.reduce((acc, t) => acc + t.available_delta_sen, 0);
    const reserved = items.reduce((acc, t) => acc + t.reserved_delta_sen, 0);
    const balance = await ledger.getBalance(orgId);

    // The whole point of a ledger: `balances` is a cache, not the source of truth.
    expect(available).toBe(balance.availableSen);
    expect(reserved).toBe(balance.reservedSen);
    expect(balance.availableSen).toBe(5000 - 175 - 130 - 25);
    expect(balance.reservedSen).toBe(0);
  });


  it("moves no money when the ledger write fails", async () => {
    const orgId = await makeOrg(5000);
    // A duplicate primary key makes the ledger INSERT fail inside the batch.
    // Because the balance update rides in the same transaction, the balance
    // must not move: this is the failure that broke the invariant in dev.
    const { reservationId } = await ledger.reserve(orgId, 100);
    const before = await ledger.getBalance(orgId);

    await env.DB.prepare(
      `INSERT INTO balance_transactions (id, org_id, type, amount_sen, balance_after_sen) VALUES (?,?,'deposit',1,1)`,
    ).bind("dup-key-test", orgId).run();

    const clashing = new LedgerService(env) as unknown as {
      commit(orgId: string, entries: unknown[], options?: unknown): Promise<unknown>;
    };
    await expect(
      clashing.commit(orgId, [
        { id: "dup-key-test", type: "deposit", amountSen: 999, availableDeltaSen: 999, reservedDeltaSen: 0, meta: {} },
      ]),
    ).rejects.toThrow();

    const after = await ledger.getBalance(orgId);
    expect(after.availableSen).toBe(before.availableSen);
    expect(after.reservedSen).toBe(before.reservedSen);
    expect(reservationId).toBeTruthy();
  });

  it("keeps balances equal to the sum of ledger deltas across many operations", async () => {
    const orgId = await makeOrg();
    await ledger.deposit(orgId, 10000);
    for (const [hold, actual] of [[200, 175], [100, 130], [50, 0]] as const) {
      const { reservationId } = await ledger.reserve(orgId, hold);
      await ledger.settleReservation(reservationId, actual);
    }
    await ledger.adjust(orgId, -25, "Correction");

    const { items } = await ledger.listTransactions(orgId, { limit: 100 });
    const available = items.reduce((sum, t) => sum + t.available_delta_sen, 0);
    const reserved = items.reduce((sum, t) => sum + t.reserved_delta_sen, 0);
    const balance = await ledger.getBalance(orgId);

    expect(available).toBe(balance.availableSen);
    expect(reserved).toBe(balance.reservedSen);
    expect(balance.reservedSen).toBe(0);
  });

  it("returns history in the order it happened, even within one millisecond", async () => {
    const orgId = await makeOrg(5000);
    const { reservationId } = await ledger.reserve(orgId, 200);
    // A settlement writes its charge and refund in the same batch, so they
    // share a millisecond and cannot be ordered by their ids.
    await ledger.settleReservation(reservationId, 175);

    const { items } = await ledger.listTransactions(orgId, { limit: 100 });
    expect(items.map((t) => t.type)).toEqual(["refund", "charge", "reservation"]);
  });

  it("pages without repeating or dropping an entry", async () => {
    const orgId = await makeOrg();
    for (let i = 0; i < 7; i++) await ledger.deposit(orgId, 100);

    const first = await ledger.listTransactions(orgId, { limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBeTruthy();

    const second = await ledger.listTransactions(orgId, { limit: 3, cursor: first.nextCursor! });
    const ids = new Set([...first.items, ...second.items].map((t) => t.id));
    expect(ids.size).toBe(6);
  });
});
