import { text, integer, index } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";

// Invoices are records in our DB, not derived on the fly (CLAUDE.md §12).
export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    amountSen: integer("amount_sen").notNull(),
    currency: text("currency").notNull().default("MYR"),
    taxRateBps: integer("tax_rate_bps").notNull(), // basis points, snapshotted from platform_config at issue time
    taxRegistrationNumber: text("tax_registration_number"),
    status: text("status", { enum: ["draft", "issued", "paid", "void"] }).notNull().default("draft"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    issuedAt: text("issued_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("invoices_tenant_id_idx").on(t.tenantId)],
);
