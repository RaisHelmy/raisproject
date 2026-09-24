import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { vendors } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

export async function createVendor(
  db: Db,
  groupId: string | null,
  userId: string,
  businessName: string,
) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    userId,
    groupId,
    businessName,
    status: "active" as const,
  };
  return withAudit(
    db,
    { action: "vendor.create", entityType: "vendor", entityId: row.id },
    async () => {
      await db.insert(vendors).values(row);
      return row;
    },
  );
}

export async function getVendorById(db: Db, groupId: string | null, vendorId: string) {
  const rows = await db
    .select()
    .from(vendors)
    .where(and(groupScope(vendors.groupId, groupId), eq(vendors.id, vendorId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listVendorsForGroup(db: Db, groupId: string | null) {
  return db.select().from(vendors).where(groupScope(vendors.groupId, groupId));
}
