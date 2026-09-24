import type { Db } from "../client";
import { createDraftJob, postJob } from "../repositories/jobs";
import { listActiveContracts } from "../repositories/vendorContracts";
import { getVendorById } from "../repositories/vendors";
import { getGroupById } from "../repositories/groups";

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Daily spawner for active `vendor_contract` catering agreements
 * (CLAUDE.md "Vendor corporate contracts (catering)"). For each active
 * contract matching today's day of week, creates and posts today's meal
 * delivery job at the contract's fixed price — always as its own
 * cash/gateway transaction charged at order time, never prepaid. The
 * contract's group is billed exactly like any other purchaser; there is no
 * special "contract balance."
 */
export async function spawnContractOrders(db: Db, now: Date = new Date()) {
  const todayCode = DAY_CODES[now.getUTCDay()];
  const contracts = await listActiveContracts(db);
  const created = [];

  for (const contract of contracts) {
    const days = JSON.parse(contract.daysOfWeekJson) as string[];
    if (!days.includes(todayCode as string)) continue;
    if (contract.contractEnd && contract.contractEnd < now.toISOString()) continue;

    const vendor = await getVendorById(db, contract.groupId, contract.vendorId);
    if (!vendor) continue;
    const group = await getGroupById(db, contract.groupId);
    if (!group) continue;

    const [hh, mm] = contract.mealTime.split(":").map(Number);
    const scheduledFor = new Date(now);
    scheduledFor.setUTCHours(hh ?? 0, mm ?? 0, 0, 0);

    // Billed to the group's owner as the purchaser of record for this
    // contract-spawned order — a job's purchaser must be a real user, and
    // the group owner is the natural "the company" stand-in.
    const draft = await createDraftJob(db, {
      groupId: contract.groupId,
      type: "food_order",
      purchaserUserId: group.ownerUserId,
      paymentMethod: "cash",
      deliveryFeeMinor: contract.pricePerMealMinor,
      vendorId: contract.vendorId,
      scheduledFor: scheduledFor.toISOString(),
      vendorContractId: contract.id,
    });
    const posted = await postJob(db, contract.groupId, draft.id);
    created.push(posted);
  }

  return created;
}
