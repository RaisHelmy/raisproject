import { text, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { plans } from "./platform";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  planId: text("plan_id").notNull().references(() => plans.id),
  billingState: text("billing_state", {
    enum: ["trial", "active", "past_due", "suspended", "cancelled"],
  }).notNull().default("trial"),
  primaryColor: text("primary_color"),
  logoR2Key: text("logo_r2_key"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const domains = pgTable(
  "domains",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    hostname: text("hostname").notNull(),
    status: text("status", {
      enum: ["pending", "verifying", "active", "failed"],
    }).notNull().default("pending"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isSubdomain: boolean("is_subdomain").notNull().default(false),
    verificationToken: text("verification_token").notNull(),
    createdAt: text("created_at").notNull(),
    verifiedAt: text("verified_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("domains_tenant_id_idx").on(t.tenantId),
    uniqueIndex("domains_hostname_idx").on(t.hostname),
  ],
);

export const tenantUsage = pgTable("tenant_usage", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id),
  attachmentBytesTotal: integer("attachment_bytes_total").notNull().default(0),
  ticketCountTotal: integer("ticket_count_total").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
