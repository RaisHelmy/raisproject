import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { products } from "../schema";
import { withAudit } from "./withAudit";

export interface CreateProductInput {
  vendorId: string;
  groupId?: string | null;
  name: string;
  description?: string;
  priceMinor: number;
}

export async function createProduct(db: Db, input: CreateProductInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    vendorId: input.vendorId,
    groupId: input.groupId ?? null,
    name: input.name,
    description: input.description ?? null,
    priceMinor: input.priceMinor,
    active: true,
  };
  return withAudit(
    db,
    { action: "product.create", entityType: "product", entityId: row.id },
    async () => {
      await db.insert(products).values(row);
      return row;
    },
  );
}

export async function listProductsForVendor(
  db: Db,
  vendorId: string,
  options: { activeOnly?: boolean } = {},
) {
  const clause =
    options.activeOnly === true
      ? and(eq(products.vendorId, vendorId), eq(products.active, true))
      : eq(products.vendorId, vendorId);
  return db.select().from(products).where(clause);
}

export async function setProductActive(db: Db, productId: string, active: boolean) {
  return withAudit(
    db,
    { action: "product.set_active", entityType: "product", entityId: productId },
    async () => {
      await db.update(products).set({ active, updatedAt: nowIso() }).where(eq(products.id, productId));
      return { productId, active };
    },
  );
}

export async function updateProductPrice(db: Db, productId: string, priceMinor: number) {
  return withAudit(
    db,
    { action: "product.update_price", entityType: "product", entityId: productId },
    async () => {
      await db
        .update(products)
        .set({ priceMinor, updatedAt: nowIso() })
        .where(eq(products.id, productId));
      return { productId, priceMinor };
    },
  );
}
