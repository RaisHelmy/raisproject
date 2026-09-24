import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export type PaymentType = "deposit" | "preauth" | "prepaid" | "cancellation_fee" | "order";
export type PaymentStatus = "pending" | "authorized" | "captured" | "failed" | "refunded";

export interface Payment {
  id: string;
  tenant_id: string;
  outlet_id: string;
  guest_id: string | null;
  reservation_id: string | null;
  order_id: string | null;
  type: PaymentType;
  amount_minor: number;
  currency: string;
  provider: string;
  provider_ref: string | null;
  status: PaymentStatus;
  created_at: number;
}

export async function createPayment(
  db: AppDatabase,
  tenantId: string,
  input: {
    outletId: string;
    guestId?: string | null;
    reservationId?: string | null;
    orderId?: string | null;
    type: PaymentType;
    amountMinor: number;
    currency: string;
    providerRef?: string;
    status?: PaymentStatus;
  },
): Promise<Payment> {
  const id = newId();
  const created_at = now();
  const status = input.status ?? "pending";
  await db
    .prepare(
      `INSERT INTO payments
        (id, tenant_id, outlet_id, guest_id, reservation_id, order_id, type, amount_minor, currency, provider, provider_ref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stripe', ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      input.outletId,
      input.guestId ?? null,
      input.reservationId ?? null,
      input.orderId ?? null,
      input.type,
      input.amountMinor,
      input.currency,
      input.providerRef ?? null,
      status,
      created_at,
    )
    .run();
  return {
    id,
    tenant_id: tenantId,
    outlet_id: input.outletId,
    guest_id: input.guestId ?? null,
    reservation_id: input.reservationId ?? null,
    order_id: input.orderId ?? null,
    type: input.type,
    amount_minor: input.amountMinor,
    currency: input.currency,
    provider: "stripe",
    provider_ref: input.providerRef ?? null,
    status,
    created_at,
  };
}

export async function getPaymentByProviderRef(
  db: AppDatabase,
  providerRef: string,
): Promise<Payment | null> {
  const row = await db.prepare(`SELECT * FROM payments WHERE provider_ref = ?`).bind(providerRef).first<Payment>();
  return row ?? null;
}

export async function setPaymentStatus(
  db: AppDatabase,
  tenantId: string,
  paymentId: string,
  status: PaymentStatus,
): Promise<void> {
  await db
    .prepare(`UPDATE payments SET status = ? WHERE tenant_id = ? AND id = ?`)
    .bind(status, tenantId, paymentId)
    .run();
}

export async function listPaymentsForReservation(
  db: AppDatabase,
  tenantId: string,
  reservationId: string,
): Promise<Payment[]> {
  const { results } = await db
    .prepare(`SELECT * FROM payments WHERE tenant_id = ? AND reservation_id = ? ORDER BY created_at DESC`)
    .bind(tenantId, reservationId)
    .all<Payment>();
  return results ?? [];
}
