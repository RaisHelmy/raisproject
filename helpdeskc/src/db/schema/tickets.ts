import { text, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";
import { accounts, teams, contacts } from "./accounts";
import { agents } from "./agents";
import { templates, templateVersions } from "./templates";
import { slaPolicies } from "./sla";

export const TICKET_STATUSES = [
  "new",
  "open",
  "pending",
  "on_hold",
  "resolved",
  "closed",
] as const;

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    // Per-tenant sequential number shown to humans (CLAUDE.md §10). Minted
    // by a Durable Object, never MAX(number)+1 on D1.
    number: integer("number").notNull(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    teamId: text("team_id").references(() => teams.id),
    contactId: text("contact_id").notNull().references(() => contacts.id),
    templateId: text("template_id").notNull().references(() => templates.id),
    templateVersionId: text("template_version_id").notNull().references(() => templateVersions.id),
    status: text("status", { enum: TICKET_STATUSES }).notNull().default("new"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull(),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    assigneeAgentId: text("assignee_agent_id").references(() => agents.id),
    queue: text("queue"),
    fieldValues: text("field_values").notNull(), // JSON: template field key -> value
    tags: text("tags").notNull().default("[]"), // JSON string[], set by automation rules or agents

    slaPolicyId: text("sla_policy_id").references(() => slaPolicies.id),
    slaFirstResponseDueAt: text("sla_first_response_due_at"),
    slaResolutionDueAt: text("sla_resolution_due_at"),
    slaFirstResponseAt: text("sla_first_response_at"),
    // pending/on_hold pause the SLA clock (CLAUDE.md §10). We track when the
    // current pause started plus accumulated paused seconds so due dates can
    // be recomputed without rewriting history.
    slaPausedAt: text("sla_paused_at"),
    slaPausedTotalSeconds: integer("sla_paused_total_seconds").notNull().default(0),
    slaBreached: boolean("sla_breached").notNull().default(false),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    resolvedAt: text("resolved_at"),
    closedAt: text("closed_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("tickets_tenant_id_idx").on(t.tenantId),
    uniqueIndex("tickets_tenant_number_idx").on(t.tenantId, t.number),
    index("tickets_tenant_status_idx").on(t.tenantId, t.status),
    index("tickets_tenant_assignee_idx").on(t.tenantId, t.assigneeAgentId),
    // Supports the SLA breach cron scanning a due-soon window, not a full
    // table scan (CLAUDE.md §10).
    index("tickets_tenant_resolution_due_idx").on(t.tenantId, t.slaResolutionDueAt),
  ],
);

// Normalised key/value rows for fields the tenant marks filterable
// (CLAUDE.md §9), so filtering doesn't require querying into the
// field_values JSON blob from SQL.
export const ticketFieldValues = pgTable(
  "ticket_field_values",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    ticketId: text("ticket_id").notNull().references(() => tickets.id),
    fieldKey: text("field_key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [
    index("ticket_field_values_tenant_id_idx").on(t.tenantId),
    index("ticket_field_values_ticket_field_idx").on(t.ticketId, t.fieldKey),
  ],
);

// Every state transition is audited here (CLAUDE.md §10); replies/notes are
// also events so the ticket has one linear timeline.
export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    ticketId: text("ticket_id").notNull().references(() => tickets.id),
    type: text("type", {
      enum: ["status_change", "message", "assignment", "field_change", "sla_breach"],
    }).notNull(),
    actorType: text("actor_type", { enum: ["agent", "contact", "system", "automation_rule"] }).notNull(),
    actorId: text("actor_id"),
    data: text("data").notNull(), // JSON, shape depends on type
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("ticket_events_tenant_id_idx").on(t.tenantId),
    index("ticket_events_ticket_id_idx").on(t.ticketId),
  ],
);

// Internal notes are filtered at the query layer (tenantDb), never in the
// view (CLAUDE.md §5.4) — the tenant-scoped client must strip
// isInternalNote rows before returning to a Contact-facing caller.
export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    ticketId: text("ticket_id").notNull().references(() => tickets.id),
    authorType: text("author_type", { enum: ["agent", "contact", "system"] }).notNull(),
    authorId: text("author_id"),
    body: text("body").notNull(),
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("ticket_messages_tenant_id_idx").on(t.tenantId),
    index("ticket_messages_ticket_id_idx").on(t.ticketId),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    ticketId: text("ticket_id").references(() => tickets.id),
    messageId: text("message_id").references(() => ticketMessages.id),
    // {tenant_id}/{ticket_id}/{uuid} — never the client's filename (CLAUDE.md §11).
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedByType: text("uploaded_by_type", { enum: ["agent", "contact"] }).notNull(),
    uploadedById: text("uploaded_by_id").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("attachments_tenant_id_idx").on(t.tenantId),
    index("attachments_ticket_id_idx").on(t.ticketId),
  ],
);

export const automationRules = pgTable(
  "automation_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    trigger: text("trigger", { enum: ["created", "updated", "sla_warning"] }).notNull(),
    conditions: text("conditions").notNull(), // JSON
    actions: text("actions").notNull(), // JSON — assign/priority/tag/notify/queue only at MVP
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("automation_rules_tenant_id_idx").on(t.tenantId)],
);
