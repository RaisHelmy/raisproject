import { AppError, newId, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, type PgDatabase, type PgStatement } from "../db/client";

export type TransactionType = "deposit" | "reservation" | "charge" | "refund" | "adjustment";
export type ReferenceType = "generation" | "workflow_run" | "payment" | "admin";

export interface Balance {
  availableSen: Sen;
  reservedSen: Sen;
  updatedAt: string;
}

export interface TransactionRow {
  id: string;
  org_id: string;
  type: TransactionType;
  amount_sen: number;
  available_delta_sen: number;
  reserved_delta_sen: number;
  balance_after_sen: number;
  reference_type: ReferenceType | null;
  reference_id: string | null;
  reservation_id: string | null;
  note: string | null;
  created_by: string | null;
  request_id: string | null;
  created_at: string;
}

interface WriteMeta {
  referenceType?: ReferenceType;
  referenceId?: string;
  note?: string;
  createdBy?: string;
  requestId?: string;
}

export interface SettlementResult {
  chargedSen: Sen;
  refundedSen: Sen;
  overageSen: Sen;
  balance: Balance;
}

interface BalanceRow {
  available_sen: number;
  reserved_sen: number;
  updated_at: string;
}

/** One accounting event: what the customer sees, and what each bucket does. */
interface LedgerEntry {
  id?: string;
  type: TransactionType;
  amountSen: number;
  availableDeltaSen: number;
  reservedDeltaSen: number;
  reservationId?: string;
  meta: WriteMeta;
}

/**
 * Append-only ledger over `balance_transactions`, with `balances` as a
 * materialized cache.
 *
 * Two properties are enforced by construction rather than by convention:
 *
 * 1. Atomicity. The ledger rows and the balance update go out as a single D1
 *    batch, which is one transaction. A balance can never move without its
 *    entries, and entries can never exist without the matching movement.
 *    `balance_after_sen` is computed inside SQL from the pre-update row, so no
 *    read-then-write round trip is needed to fill it in.
 *
 * 2. Concurrency. Every write carries the same guard on the pre-update balance.
 *    Two concurrent reservations cannot both pass it: one commits, the other
 *    matches zero rows and reports insufficient balance.
 */
export class LedgerService {
  private readonly db: PgDatabase;

  constructor(env: Pick<Env, "DB">) {
    this.db = env.DB;
  }

  async getBalance(orgId: string): Promise<Balance> {
    const row = await this.db
      .prepare(`SELECT available_sen, reserved_sen, updated_at FROM balances WHERE org_id = ?`)
      .bind(orgId)
      .first<BalanceRow>();
    if (!row) throw new AppError("not_found", "This workspace has no balance record.");
    return { availableSen: row.available_sen, reservedSen: row.reserved_sen, updatedAt: row.updated_at };
  }

  async deposit(orgId: string, amountSen: Sen, meta: WriteMeta = {}): Promise<{ transactionId: string; balance: Balance }> {
    this.assertPositive(amountSen, "Deposit amount must be greater than zero.");
    const id = newId();
    const { balance } = await this.commit(orgId, [
      { id, type: "deposit", amountSen, availableDeltaSen: amountSen, reservedDeltaSen: 0, meta: { referenceType: "payment", ...meta } },
    ]);
    return { transactionId: id, balance };
  }

  /**
   * Holds the estimate: available goes down, reserved goes up. Rejects with the
   * shortfall attached so the UI can show cost, available and Add Balance (§29).
   */
  async reserve(orgId: string, amountSen: Sen, meta: WriteMeta = {}): Promise<{ reservationId: string; balance: Balance }> {
    this.assertPositive(amountSen, "Reservation amount must be greater than zero.");
    const reservationId = newId();
    const result = await this.commit(
      orgId,
      [{
        id: reservationId, type: "reservation", amountSen: -amountSen,
        availableDeltaSen: -amountSen, reservedDeltaSen: amountSen, reservationId, meta,
      }],
      { minimumAvailableSen: amountSen },
    );

    if (!result.applied) {
      const current = await this.getBalance(orgId);
      throw new AppError("insufficient_balance", "Your balance does not cover this generation.", {
        action: "Add balance and try again.",
        details: { estimatedSen: amountSen, availableSen: current.availableSen },
      });
    }
    return { reservationId, balance: result.balance };
  }

  /**
   * Settles a hold once the real cost is known:
   *   charge  = min(actual, reserved)     reserved -=
   *   refund  = reserved - charge         reserved -=, available +=
   *   overage = max(0, actual - reserved) available -=  (may go negative)
   *
   * The overage path deliberately allows a negative balance: the provider has
   * already been paid, so the debt is recorded rather than failing after spend.
   */
  async settleReservation(reservationId: string, actualSen: Sen, meta: WriteMeta = {}): Promise<SettlementResult> {
    if (actualSen < 0) throw new AppError("invalid_input", "Actual cost cannot be negative.");
    const reservation = await this.db
      .prepare(`SELECT * FROM balance_transactions WHERE id = ? AND type = 'reservation'`)
      .bind(reservationId)
      .first<TransactionRow>();
    if (!reservation) throw new AppError("not_found", "Reservation not found.");

    const alreadySettled = await this.db
      .prepare(`SELECT id FROM balance_transactions WHERE reservation_id = ? AND type IN ('charge','refund') LIMIT 1`)
      .bind(reservationId)
      .first<{ id: string }>();
    if (alreadySettled) throw new AppError("conflict", "This reservation has already been settled.");

    const orgId = reservation.org_id;
    const reservedSen = Math.abs(reservation.amount_sen);
    const chargedSen = Math.min(actualSen, reservedSen);
    const refundedSen = reservedSen - chargedSen;
    const overageSen = Math.max(0, actualSen - reservedSen);

    const inherited: WriteMeta = {
      referenceType: meta.referenceType ?? reservation.reference_type ?? undefined,
      referenceId: meta.referenceId ?? reservation.reference_id ?? undefined,
      requestId: meta.requestId,
      createdBy: meta.createdBy,
    };

    const entries: LedgerEntry[] = [
      { type: "charge", amountSen: -chargedSen, availableDeltaSen: 0, reservedDeltaSen: -chargedSen, reservationId, meta: { ...inherited, note: meta.note } },
    ];
    if (refundedSen > 0) {
      entries.push({
        type: "refund", amountSen: refundedSen, availableDeltaSen: refundedSen, reservedDeltaSen: -refundedSen,
        reservationId, meta: { ...inherited, note: "Unused reservation returned" },
      });
    }
    if (overageSen > 0) {
      entries.push({
        type: "charge", amountSen: -overageSen, availableDeltaSen: -overageSen, reservedDeltaSen: 0,
        reservationId, meta: { ...inherited, note: "Cost exceeded estimate" },
      });
    }

    const { balance } = await this.commit(orgId, entries);
    return { chargedSen, refundedSen, overageSen, balance };
  }

  /** Releases a hold in full when nothing was spent. */
  async releaseReservation(reservationId: string, meta: WriteMeta = {}): Promise<SettlementResult> {
    return this.settleReservation(reservationId, 0, { ...meta, note: meta.note ?? "Reservation released" });
  }

  /** Admin-only correction. A note is required so the ledger stays auditable. */
  async adjust(orgId: string, amountSen: Sen, note: string, meta: WriteMeta = {}): Promise<{ transactionId: string; balance: Balance }> {
    if (!Number.isInteger(amountSen)) throw new AppError("invalid_input", "Amounts must be whole sen.");
    if (amountSen === 0) throw new AppError("invalid_input", "Adjustment amount cannot be zero.");
    if (!note.trim()) throw new AppError("invalid_input", "An adjustment needs a note explaining why.");
    const id = newId();
    const { balance } = await this.commit(orgId, [
      { id, type: "adjustment", amountSen, availableDeltaSen: amountSen, reservedDeltaSen: 0, meta: { referenceType: "admin", ...meta, note } },
    ]);
    return { transactionId: id, balance };
  }

  /**
   * History, newest first.
   *
   * Ordered and paged by id. Ids are ULIDs, so their leading characters are
   * the creation time and sorting by id is creation order (Postgres has no
   * SQLite-style rowid). Two entries written in the same millisecond — a
   * settlement's charge and refund, say — keep a stable, if arbitrary, order
   * within that millisecond, which is what keyset paging needs.
   */
  async listTransactions(
    orgId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<{ items: TransactionRow[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const cursor = opts.cursor?.trim() || null;

    const rows = cursor
      ? await this.db
          .prepare(`SELECT * FROM balance_transactions WHERE org_id = ? AND id < ? ORDER BY id DESC LIMIT ?`)
          .bind(orgId, cursor, limit + 1)
          .all<TransactionRow>()
      : await this.db
          .prepare(`SELECT * FROM balance_transactions WHERE org_id = ? ORDER BY id DESC LIMIT ?`)
          .bind(orgId, limit + 1)
          .all<TransactionRow>();

    const page = rows.results.slice(0, limit);
    const nextCursor = rows.results.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page, nextCursor };
  }

  /**
   * Writes entries and moves the balance in one transaction.
   *
   * Every statement carries the same guard against the pre-update row, so a
   * batch either applies completely or not at all. `balance_after_sen` is
   * derived in SQL as (pre-update available + the running available delta).
   */
  private async commit(
    orgId: string,
    entries: LedgerEntry[],
    options: { minimumAvailableSen?: Sen } = {},
  ): Promise<{ applied: boolean; balance: Balance }> {
    const guardSql = options.minimumAvailableSen !== undefined ? " AND available_sen >= ?" : "";
    const guardParams = options.minimumAvailableSen !== undefined ? [options.minimumAvailableSen] : [];
    const now = nowIso();

    const statements: PgStatement[] = [];
    let runningAvailableDelta = 0;

    for (const entry of entries) {
      runningAvailableDelta += entry.availableDeltaSen;
      statements.push(
        this.db
          .prepare(
            `INSERT INTO balance_transactions
               (id, org_id, type, amount_sen, available_delta_sen, reserved_delta_sen, balance_after_sen,
                reference_type, reference_id, reservation_id, note, created_by, request_id, created_at)
             SELECT ?, ?, ?, ?, ?, ?, b.available_sen + ?, ?, ?, ?, ?, ?, ?, ?
             FROM balances b WHERE b.org_id = ?${guardSql}`,
          )
          .bind(
            entry.id ?? newId(), orgId, entry.type, entry.amountSen,
            entry.availableDeltaSen, entry.reservedDeltaSen, runningAvailableDelta,
            entry.meta.referenceType ?? null, entry.meta.referenceId ?? null, entry.reservationId ?? null,
            entry.meta.note ?? null, entry.meta.createdBy ?? null, entry.meta.requestId ?? null, now,
            orgId, ...guardParams,
          ),
      );
    }

    const totalAvailable = entries.reduce((sum, e) => sum + e.availableDeltaSen, 0);
    const totalReserved = entries.reduce((sum, e) => sum + e.reservedDeltaSen, 0);
    statements.push(
      this.db
        .prepare(
          `UPDATE balances SET available_sen = available_sen + ?, reserved_sen = reserved_sen + ?, updated_at = ?
           WHERE org_id = ?${guardSql}`,
        )
        .bind(totalAvailable, totalReserved, now, orgId, ...guardParams),
    );

    const results = await this.db.batch(statements);
    const applied = (results[results.length - 1]?.meta.changes ?? 0) > 0;
    if (!applied && options.minimumAvailableSen === undefined) {
      throw new AppError("not_found", "This workspace has no balance record.");
    }
    return { applied, balance: await this.getBalance(orgId) };
  }

  private assertPositive(amountSen: number, message: string): void {
    if (!Number.isInteger(amountSen)) throw new AppError("invalid_input", "Amounts must be whole sen.");
    if (amountSen <= 0) throw new AppError("invalid_input", message);
  }
}
