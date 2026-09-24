import { CURRENCY } from "@raisai/shared";
import type { Balance, TransactionRow } from "../services/ledger-service";

/** Customer view: what the money is, never where it came from (ADR-006, §164). */
export interface BalanceDTO {
  availableSen: number;
  reservedSen: number;
  currency: string;
  updatedAt: string;
}

export interface TransactionDTO {
  id: string;
  type: TransactionRow["type"];
  amountSen: number;
  balanceAfterSen: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export function toBalanceDTO(balance: Balance): BalanceDTO {
  return {
    availableSen: balance.availableSen,
    reservedSen: balance.reservedSen,
    currency: CURRENCY,
    updatedAt: balance.updatedAt,
  };
}

export function toTransactionDTO(row: TransactionRow): TransactionDTO {
  return {
    id: row.id,
    type: row.type,
    amountSen: row.amount_sen,
    balanceAfterSen: row.balance_after_sen,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Admin view adds the accounting deltas used for reconciliation (§123). */
export interface AdminTransactionDTO extends TransactionDTO {
  availableDeltaSen: number;
  reservedDeltaSen: number;
  reservationId: string | null;
  requestId: string | null;
  createdBy: string | null;
}

export function toAdminTransactionDTO(row: TransactionRow): AdminTransactionDTO {
  return {
    ...toTransactionDTO(row),
    availableDeltaSen: row.available_delta_sen,
    reservedDeltaSen: row.reserved_delta_sen,
    reservationId: row.reservation_id,
    requestId: row.request_id,
    createdBy: row.created_by,
  };
}
