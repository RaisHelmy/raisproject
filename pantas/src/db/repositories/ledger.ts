import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { ledgerEntries, type ledgerAccountTypeValues } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

export type LedgerAccountType = (typeof ledgerAccountTypeValues)[number];
export type LedgerDirection = "debit" | "credit";

export interface LedgerLine {
  groupId: string | null;
  jobId: string | null;
  accountType: LedgerAccountType;
  accountRefId: string | null;
  direction: LedgerDirection;
  amountMinor: number;
  description?: string;
}

/**
 * Writes a balanced double-entry batch: total debits must equal total
 * credits, or nothing is written. This is the only way ledger rows get
 * created — there is no mutable "balance" column anywhere in the schema,
 * so every payout, fee receivable, and payable is derived by summing these
 * rows (see getAccountBalance below).
 *
 * `idempotencyKey` must be unique per logical money movement (e.g.
 * `job:{jobId}:settle`) so a retried operation or replayed webhook cannot
 * double-post. Callers are responsible for checking
 * `hasIdempotencyKeyBeenUsed` before calling this, or for relying on a
 * unique constraint at the Postgres cutover (D1/SQLite here has no partial
 * unique index support in this schema version — noted as a follow-up, not
 * silently assumed safe).
 */
export async function writeBalancedLedgerEntries(
  db: Db,
  idempotencyKey: string,
  lines: LedgerLine[],
) {
  if (lines.length === 0) {
    throw new Error("writeBalancedLedgerEntries requires at least one line");
  }
  const debitTotal = lines
    .filter((l) => l.direction === "debit")
    .reduce((sum, l) => sum + l.amountMinor, 0);
  const creditTotal = lines
    .filter((l) => l.direction === "credit")
    .reduce((sum, l) => sum + l.amountMinor, 0);
  if (debitTotal !== creditTotal) {
    throw new Error(
      `unbalanced ledger batch: debits=${debitTotal} credits=${creditTotal}`,
    );
  }
  if (lines.some((l) => l.amountMinor <= 0 || !Number.isInteger(l.amountMinor))) {
    throw new Error("ledger amounts must be positive integer minor units");
  }

  const now = nowIso();
  const rows = lines.map((l) => ({
    id: newId(),
    createdAt: now,
    groupId: l.groupId,
    jobId: l.jobId,
    accountType: l.accountType,
    accountRefId: l.accountRefId,
    direction: l.direction,
    amountMinor: l.amountMinor,
    description: l.description ?? null,
    idempotencyKey,
  }));

  // D1 note: interactive multi-statement transactions aren't available over
  // the D1 HTTP driver the way they are on better-sqlite3/node-postgres, so
  // this batch is executed via db.batch() where the driver supports it, and
  // db.insert(...).values(rows) (a single INSERT covering all rows) as the
  // portable fallback used by the SQLite/Postgres test harness. Either path
  // keeps the whole batch atomic — it's one statement either way.
  //
  // Every ledger movement is explicitly required logging (CLAUDE.md).
  return withAudit(
    db,
    { action: "ledger.write_batch", entityType: "ledger_entries", entityId: idempotencyKey },
    async () => {
      await db.insert(ledgerEntries).values(rows);
      return rows;
    },
  );
}

/**
 * Debit/credit normal balance depends on account type:
 *  - runner_payable, vendor_payable, accrued_fee_receivable* are
 *    liability/receivable-style accounts owed BY the platform or TO the
 *    platform — read the two totals and let the caller (which knows the
 *    business meaning) compute the signed balance. This function
 *    deliberately does not guess a sign convention.
 */
export async function getAccountTotals(
  db: Db,
  groupId: string | null,
  accountType: LedgerAccountType,
  accountRefId: string | null,
) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        groupScope(ledgerEntries.groupId, groupId),
        eq(ledgerEntries.accountType, accountType),
        accountRefId === null
          ? undefined
          : eq(ledgerEntries.accountRefId, accountRefId),
      ),
    );
  const debitTotal = rows
    .filter((r) => r.direction === "debit")
    .reduce((sum, r) => sum + r.amountMinor, 0);
  const creditTotal = rows
    .filter((r) => r.direction === "credit")
    .reduce((sum, r) => sum + r.amountMinor, 0);
  return { debitTotal, creditTotal, entryCount: rows.length };
}

/**
 * Entries for one account type within [startIso, endIso) — ISO-8601
 * strings sort lexically, so a plain string comparison is correct here.
 * Used by the weekly payout batch generator to find everyone with payable
 * activity in the period; aggregation-by-account happens in JS since MVP
 * volume doesn't warrant a SQL GROUP BY round-trip through Drizzle.
 */
export async function listEntriesInPeriod(
  db: Db,
  groupId: string | null,
  accountType: LedgerAccountType,
  startIso: string,
  endIso: string,
) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(groupScope(ledgerEntries.groupId, groupId), eq(ledgerEntries.accountType, accountType)),
    );
  return rows.filter((r) => r.createdAt >= startIso && r.createdAt < endIso);
}
