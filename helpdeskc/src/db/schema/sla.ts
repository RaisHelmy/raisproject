import { text, index } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";

// Business hours, holidays, timezone are per tenant (CLAUDE.md §10).
export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(), // IANA tz name, e.g. "Asia/Kuala_Lumpur"
    businessHours: text("business_hours").notNull(), // JSON: per-weekday open/close
    holidays: text("holidays").notNull(), // JSON: ISO date strings
    // JSON: { [priority]: { firstResponseMinutes, resolutionMinutes } }
    targets: text("targets").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("sla_policies_tenant_id_idx").on(t.tenantId)],
);
