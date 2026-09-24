import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { vendorContractOffers, vendorContracts } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

export interface CreateContractInput {
  groupId: string;
  vendorId: string;
  pricePerMealMinor: number;
  daysOfWeek: string[];
  mealTime: string;
  menuTerms?: string;
  contractStart: string;
  contractEnd?: string;
}

/** A contract starts in `negotiating` — see acceptContractOffer for how it becomes `active`. */
export async function createContract(db: Db, input: CreateContractInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    groupId: input.groupId,
    vendorId: input.vendorId,
    pricePerMealMinor: input.pricePerMealMinor,
    daysOfWeekJson: JSON.stringify(input.daysOfWeek),
    mealTime: input.mealTime,
    menuTerms: input.menuTerms ?? null,
    contractStart: input.contractStart,
    contractEnd: input.contractEnd ?? null,
    status: "negotiating" as const,
  };
  return withAudit(
    db,
    { action: "vendor_contract.create", entityType: "vendor_contract", entityId: row.id },
    async () => {
      await db.insert(vendorContracts).values(row);
      return row;
    },
  );
}

export async function getContractById(db: Db, groupId: string | null, contractId: string) {
  const rows = await db
    .select()
    .from(vendorContracts)
    .where(and(groupScope(vendorContracts.groupId, groupId), eq(vendorContracts.id, contractId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listContractsForGroup(db: Db, groupId: string | null) {
  return db.select().from(vendorContracts).where(groupScope(vendorContracts.groupId, groupId));
}

/** All active contracts — used by the daily meal-order spawner cron. */
export async function listActiveContracts(db: Db) {
  return db.select().from(vendorContracts).where(eq(vendorContracts.status, "active"));
}

export interface CreateContractOfferInput {
  contractId: string;
  proposedByRole: "group" | "vendor";
  proposedByUserId: string;
  proposedPricePerMealMinor: number;
  proposedTerms?: string;
}

export async function createContractOffer(db: Db, input: CreateContractOfferInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    contractId: input.contractId,
    proposedByRole: input.proposedByRole,
    proposedByUserId: input.proposedByUserId,
    proposedPricePerMealMinor: input.proposedPricePerMealMinor,
    proposedTerms: input.proposedTerms ?? null,
    status: "pending" as const,
    respondedAt: null,
  };
  return withAudit(
    db,
    {
      action: "vendor_contract.offer_create",
      entityType: "vendor_contract_offer",
      entityId: row.id,
    },
    async () => {
      await db.insert(vendorContractOffers).values(row);
      return row;
    },
  );
}

export async function listOffersForContract(db: Db, contractId: string) {
  return db
    .select()
    .from(vendorContractOffers)
    .where(eq(vendorContractOffers.contractId, contractId));
}

/**
 * Accepting a proposal activates the contract at that price/terms and
 * auto-rejects every other pending proposal on it — same pattern as
 * job_offers. Billing itself stays per-meal (see the daily spawner in
 * src/db/services/contractSpawner.ts) — accepting a contract never charges
 * anything by itself.
 */
export async function acceptContractOffer(db: Db, offerId: string) {
  return withAudit(
    db,
    {
      action: "vendor_contract.offer_accept",
      entityType: "vendor_contract_offer",
      entityId: offerId,
    },
    async () => {
      const [offer] = await db
        .select()
        .from(vendorContractOffers)
        .where(eq(vendorContractOffers.id, offerId))
        .limit(1);
      if (!offer) throw new Error(`contract offer ${offerId} not found`);
      if (offer.status !== "pending") {
        throw new Error(`cannot accept offer in status ${offer.status}`);
      }

      const now = nowIso();
      await db
        .update(vendorContractOffers)
        .set({ status: "accepted", respondedAt: now, updatedAt: now })
        .where(eq(vendorContractOffers.id, offerId));

      const others = await db
        .select()
        .from(vendorContractOffers)
        .where(
          and(
            eq(vendorContractOffers.contractId, offer.contractId),
            eq(vendorContractOffers.status, "pending"),
          ),
        );
      for (const other of others) {
        await db
          .update(vendorContractOffers)
          .set({ status: "rejected", respondedAt: now, updatedAt: now })
          .where(eq(vendorContractOffers.id, other.id));
      }

      await db
        .update(vendorContracts)
        .set({
          pricePerMealMinor: offer.proposedPricePerMealMinor,
          status: "active",
          updatedAt: now,
        })
        .where(eq(vendorContracts.id, offer.contractId));

      return offer;
    },
  );
}

export async function setContractStatus(
  db: Db,
  contractId: string,
  status: "active" | "ended" | "cancelled",
) {
  return withAudit(
    db,
    { action: "vendor_contract.set_status", entityType: "vendor_contract", entityId: contractId },
    async () => {
      await db
        .update(vendorContracts)
        .set({ status, updatedAt: nowIso() })
        .where(eq(vendorContracts.id, contractId));
      return { contractId, status };
    },
  );
}
