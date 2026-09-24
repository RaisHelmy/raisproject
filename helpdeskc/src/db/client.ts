import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull, desc, asc, lt, lte, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";
import type { TicketScope } from "../core/authz/permissions";
import type { TicketStatus } from "../core/ticket/state";

export type Schema = typeof schema;

/**
 * The ONLY place a bare Drizzle client is constructed (CLAUDE.md §5.2). Every
 * repository method below scopes its query to `tenantId` — there is no
 * method here that can return another tenant's rows. Code outside src/db/
 * must go through tenantDb(), never drizzle(postgres(...)) directly.
 *
 * Migrated from D1 to Postgres via Hyperdrive. `hyperdrive.connectionString`
 * is resolved by the Workers runtime to the private-VPC Postgres origin — no
 * host/port lives in this codebase. A fresh postgres.js client per call is
 * the documented Hyperdrive pattern (Workers isolates are ephemeral, and
 * Hyperdrive itself pools connections at the edge), so `max: 5` here just
 * caps concurrent connections from a single isolate, not a long-lived pool.
 */
export function tenantDb(hyperdrive: Hyperdrive, tenantId: string) {
  // Shared `raishelmy` Postgres database, this app isolated into schema
  // `helpdeskc`. Tables are schema-qualified directly in src/db/schema/
  // (via `_schema.ts`'s `pgSchema("helpdeskc")`) rather than relying on
  // `search_path` — Hyperdrive pools connections at the transaction/
  // statement level and doesn't preserve session state like search_path
  // across statements.
  const sql_ = postgres(hyperdrive.connectionString, { max: 5 });
  const db: PostgresJsDatabase<Schema> = drizzle(sql_, { schema });
  const t = tenantId;

  return {
    /** Escape hatch for raw SQL that genuinely needs it. Still tenant-filters. Name and justify every call site (CLAUDE.md §4). */
    _raw: db,

    accounts: {
      async list() {
        return db.select().from(schema.accounts).where(and(eq(schema.accounts.tenantId, t), isNull(schema.accounts.deletedAt)));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.accounts)
          .where(and(eq(schema.accounts.tenantId, t), eq(schema.accounts.id, id), isNull(schema.accounts.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.accounts.$inferInsert, "tenantId">) {
        await db.insert(schema.accounts).values({ ...values, tenantId: t });
      },
      async update(id: string, values: Partial<Omit<typeof schema.accounts.$inferInsert, "tenantId" | "id">>) {
        await db.update(schema.accounts).set(values).where(and(eq(schema.accounts.tenantId, t), eq(schema.accounts.id, id)));
      },
    },

    teams: {
      async listForAccount(accountId: string) {
        return db
          .select()
          .from(schema.teams)
          .where(and(eq(schema.teams.tenantId, t), eq(schema.teams.accountId, accountId), isNull(schema.teams.deletedAt)));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.teams)
          .where(and(eq(schema.teams.tenantId, t), eq(schema.teams.id, id), isNull(schema.teams.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.teams.$inferInsert, "tenantId">) {
        await db.insert(schema.teams).values({ ...values, tenantId: t });
      },
      async update(id: string, values: Partial<Omit<typeof schema.teams.$inferInsert, "tenantId" | "id">>) {
        await db.update(schema.teams).set(values).where(and(eq(schema.teams.tenantId, t), eq(schema.teams.id, id)));
      },
    },

    contacts: {
      /** Unique constraint is (tenant_id, email) — CLAUDE.md §7. Never call without tenantId in scope. */
      async findByEmail(email: string) {
        const rows = await db
          .select()
          .from(schema.contacts)
          .where(and(eq(schema.contacts.tenantId, t), eq(schema.contacts.email, email), isNull(schema.contacts.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.contacts)
          .where(and(eq(schema.contacts.tenantId, t), eq(schema.contacts.id, id), isNull(schema.contacts.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async listForAccount(accountId: string) {
        return db
          .select()
          .from(schema.contacts)
          .where(and(eq(schema.contacts.tenantId, t), eq(schema.contacts.accountId, accountId), isNull(schema.contacts.deletedAt)));
      },
      async create(values: Omit<typeof schema.contacts.$inferInsert, "tenantId">) {
        await db.insert(schema.contacts).values({ ...values, tenantId: t });
      },
      /** Profile fields an agent can edit — never email (that's an access-control change, CLAUDE.md §7) or passwordHash (setPasswordHash below). */
      async update(id: string, values: Partial<Pick<typeof schema.contacts.$inferInsert, "name" | "teamId">>) {
        await db.update(schema.contacts).set(values).where(and(eq(schema.contacts.tenantId, t), eq(schema.contacts.id, id)));
      },
      async setPasswordHash(id: string, passwordHash: string) {
        await db
          .update(schema.contacts)
          .set({ passwordHash })
          .where(and(eq(schema.contacts.tenantId, t), eq(schema.contacts.id, id)));
      },
    },

    agents: {
      async findByEmail(email: string) {
        const rows = await db
          .select()
          .from(schema.agents)
          .where(and(eq(schema.agents.tenantId, t), eq(schema.agents.email, email), isNull(schema.agents.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.agents)
          .where(and(eq(schema.agents.tenantId, t), eq(schema.agents.id, id), isNull(schema.agents.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async list() {
        return db.select().from(schema.agents).where(and(eq(schema.agents.tenantId, t), isNull(schema.agents.deletedAt)));
      },
      /** Created with no password — invite-only (CLAUDE.md §7). Pair with agentInvites.create(). */
      async create(values: Omit<typeof schema.agents.$inferInsert, "tenantId" | "passwordHash">) {
        await db.insert(schema.agents).values({ ...values, tenantId: t, passwordHash: null });
      },
      async setPasswordHash(id: string, passwordHash: string) {
        await db.update(schema.agents).set({ passwordHash }).where(and(eq(schema.agents.tenantId, t), eq(schema.agents.id, id)));
      },
    },

    agentInvites: {
      async create(values: Omit<typeof schema.agentInvites.$inferInsert, "tenantId">) {
        await db.insert(schema.agentInvites).values({ ...values, tenantId: t });
      },
      async findByTokenHash(tokenHash: string) {
        const rows = await db
          .select()
          .from(schema.agentInvites)
          .where(and(eq(schema.agentInvites.tenantId, t), eq(schema.agentInvites.tokenHash, tokenHash)))
          .limit(1);
        return rows[0] ?? null;
      },
      async consume(id: string) {
        await db.update(schema.agentInvites).set({ consumedAt: new Date().toISOString() }).where(and(eq(schema.agentInvites.tenantId, t), eq(schema.agentInvites.id, id)));
      },
    },

    roles: {
      async list() {
        return db.select().from(schema.roles).where(and(eq(schema.roles.tenantId, t), isNull(schema.roles.deletedAt)));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.roles)
          .where(and(eq(schema.roles.tenantId, t), eq(schema.roles.id, id), isNull(schema.roles.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.roles.$inferInsert, "tenantId">) {
        await db.insert(schema.roles).values({ ...values, tenantId: t });
      },
      async update(id: string, values: Partial<Pick<typeof schema.roles.$inferInsert, "name" | "ticketScope" | "permissions">>) {
        await db.update(schema.roles).set(values).where(and(eq(schema.roles.tenantId, t), eq(schema.roles.id, id)));
      },
      async archive(id: string) {
        await db.update(schema.roles).set({ deletedAt: new Date().toISOString() }).where(and(eq(schema.roles.tenantId, t), eq(schema.roles.id, id)));
      },
      /** All roles held by an agent, for building their AuthContext. */
      async listForAgent(agentId: string) {
        return db
          .select({ role: schema.roles })
          .from(schema.memberships)
          .innerJoin(schema.roles, eq(schema.roles.id, schema.memberships.roleId))
          .where(and(
            eq(schema.memberships.tenantId, t),
            eq(schema.memberships.agentId, agentId),
            isNull(schema.roles.deletedAt),
          ))
          .then((rows) => rows.map((r) => r.role));
      },
    },

    memberships: {
      async create(values: Omit<typeof schema.memberships.$inferInsert, "tenantId">) {
        await db.insert(schema.memberships).values({ ...values, tenantId: t });
      },
      async listForAgent(agentId: string) {
        return db.select().from(schema.memberships).where(and(eq(schema.memberships.tenantId, t), eq(schema.memberships.agentId, agentId)));
      },
      async remove(agentId: string, roleId: string) {
        await db
          .delete(schema.memberships)
          .where(and(eq(schema.memberships.tenantId, t), eq(schema.memberships.agentId, agentId), eq(schema.memberships.roleId, roleId)));
      },
    },

    agentTeamAssignments: {
      async listAccountIdsForAgent(agentId: string) {
        const rows = await db
          .select({ accountId: schema.agentTeamAssignments.accountId })
          .from(schema.agentTeamAssignments)
          .where(and(eq(schema.agentTeamAssignments.tenantId, t), eq(schema.agentTeamAssignments.agentId, agentId)));
        return rows.map((r) => r.accountId);
      },
    },

    sessions: {
      async create(values: Omit<typeof schema.sessions.$inferInsert, "tenantId">) {
        await db.insert(schema.sessions).values({ ...values, tenantId: t });
      },
      /** Caller must also check hostname === session.hostname (CLAUDE.md §6.3) and expiresAt/revokedAt. */
      async findByTokenHash(tokenHash: string) {
        const rows = await db
          .select()
          .from(schema.sessions)
          .where(and(eq(schema.sessions.tenantId, t), eq(schema.sessions.tokenHash, tokenHash)))
          .limit(1);
        return rows[0] ?? null;
      },
      async revoke(id: string) {
        await db
          .update(schema.sessions)
          .set({ revokedAt: new Date().toISOString() })
          .where(and(eq(schema.sessions.tenantId, t), eq(schema.sessions.id, id)));
      },
    },

    magicLinkTokens: {
      async create(values: Omit<typeof schema.magicLinkTokens.$inferInsert, "tenantId">) {
        await db.insert(schema.magicLinkTokens).values({ ...values, tenantId: t });
      },
      async findByTokenHash(tokenHash: string) {
        const rows = await db
          .select()
          .from(schema.magicLinkTokens)
          .where(and(eq(schema.magicLinkTokens.tenantId, t), eq(schema.magicLinkTokens.tokenHash, tokenHash)))
          .limit(1);
        return rows[0] ?? null;
      },
      /** Invalidate any earlier, still-unconsumed links for this email (CLAUDE.md §7). */
      async invalidateActiveForEmail(email: string, hostname: string) {
        await db
          .update(schema.magicLinkTokens)
          .set({ invalidatedAt: new Date().toISOString() })
          .where(and(
            eq(schema.magicLinkTokens.tenantId, t),
            eq(schema.magicLinkTokens.email, email),
            eq(schema.magicLinkTokens.hostname, hostname),
            isNull(schema.magicLinkTokens.consumedAt),
            isNull(schema.magicLinkTokens.invalidatedAt),
          ));
      },
      async consume(id: string) {
        await db
          .update(schema.magicLinkTokens)
          .set({ consumedAt: new Date().toISOString() })
          .where(and(eq(schema.magicLinkTokens.tenantId, t), eq(schema.magicLinkTokens.id, id)));
      },
    },

    templates: {
      async listActive() {
        return db.select().from(schema.templates).where(and(eq(schema.templates.tenantId, t), isNull(schema.templates.deletedAt)));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.templates)
          .where(and(eq(schema.templates.tenantId, t), eq(schema.templates.id, id), isNull(schema.templates.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.templates.$inferInsert, "tenantId">) {
        await db.insert(schema.templates).values({ ...values, tenantId: t });
      },
      async update(id: string, values: Partial<Pick<typeof schema.templates.$inferInsert, "name" | "description" | "isDefault" | "accountId" | "teamId">>) {
        await db.update(schema.templates).set(values).where(and(eq(schema.templates.tenantId, t), eq(schema.templates.id, id)));
      },
      async archive(id: string) {
        await db.update(schema.templates).set({ deletedAt: new Date().toISOString() }).where(and(eq(schema.templates.tenantId, t), eq(schema.templates.id, id)));
      },
    },

    templateVersions: {
      async latest(templateId: string) {
        const rows = await db
          .select()
          .from(schema.templateVersions)
          .where(and(eq(schema.templateVersions.tenantId, t), eq(schema.templateVersions.templateId, templateId)))
          .orderBy(desc(schema.templateVersions.version))
          .limit(1);
        return rows[0] ?? null;
      },
      async listForTemplate(templateId: string) {
        return db
          .select()
          .from(schema.templateVersions)
          .where(and(eq(schema.templateVersions.tenantId, t), eq(schema.templateVersions.templateId, templateId)))
          .orderBy(desc(schema.templateVersions.version));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.templateVersions)
          .where(and(eq(schema.templateVersions.tenantId, t), eq(schema.templateVersions.id, id)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.templateVersions.$inferInsert, "tenantId">) {
        await db.insert(schema.templateVersions).values({ ...values, tenantId: t });
      },
    },

    slaPolicies: {
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.slaPolicies)
          .where(and(eq(schema.slaPolicies.tenantId, t), eq(schema.slaPolicies.id, id), isNull(schema.slaPolicies.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
    },

    tickets: {
      /**
       * `scope` resolves to a where fragment here — never enforced only in
       * React (CLAUDE.md §8). `viewerId` is the agent id for assigned/own
       * scopes, `visibleAccountIds` the account ids the agent is assigned
       * to for team scope.
       */
      async list(opts: {
        scope: TicketScope;
        viewerId?: string;
        visibleAccountIds?: string[];
        status?: TicketStatus;
        cursor?: string; // ticket id, for keyset pagination
        limit?: number;
      }) {
        if (opts.scope === "none") return [];

        const conditions: SQL[] = [eq(schema.tickets.tenantId, t), isNull(schema.tickets.deletedAt)];

        if (opts.scope === "assigned") {
          if (!opts.viewerId) return [];
          conditions.push(eq(schema.tickets.assigneeAgentId, opts.viewerId));
        } else if (opts.scope === "own") {
          if (!opts.viewerId) return [];
          conditions.push(eq(schema.tickets.contactId, opts.viewerId));
        } else if (opts.scope === "team") {
          if (!opts.visibleAccountIds || opts.visibleAccountIds.length === 0) return [];
          conditions.push(inArray(schema.tickets.accountId, opts.visibleAccountIds));
        }
        if (opts.status) conditions.push(eq(schema.tickets.status, opts.status));
        if (opts.cursor) conditions.push(lt(schema.tickets.id, opts.cursor));

        return db
          .select()
          .from(schema.tickets)
          .where(and(...conditions))
          .orderBy(desc(schema.tickets.id))
          .limit(opts.limit ?? 25);
      },

      /**
       * Contact-facing listing. Contacts are not on the role/scope model
       * (CLAUDE.md §8) — visibility is Account, narrowed to Team when the
       * Account is configured that way.
       */
      async listForContact(opts: {
        accountId: string;
        teamId: string | null;
        status?: TicketStatus;
        cursor?: string;
        limit?: number;
      }) {
        const conditions: SQL[] = [
          eq(schema.tickets.tenantId, t),
          isNull(schema.tickets.deletedAt),
          eq(schema.tickets.accountId, opts.accountId),
        ];
        if (opts.teamId) conditions.push(eq(schema.tickets.teamId, opts.teamId));
        if (opts.status) conditions.push(eq(schema.tickets.status, opts.status));
        if (opts.cursor) conditions.push(lt(schema.tickets.id, opts.cursor));

        return db
          .select()
          .from(schema.tickets)
          .where(and(...conditions))
          .orderBy(desc(schema.tickets.id))
          .limit(opts.limit ?? 25);
      },

      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.tickets)
          .where(and(eq(schema.tickets.tenantId, t), eq(schema.tickets.id, id), isNull(schema.tickets.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },

      async create(values: Omit<typeof schema.tickets.$inferInsert, "tenantId">) {
        await db.insert(schema.tickets).values({ ...values, tenantId: t });
      },

      async update(id: string, values: Partial<typeof schema.tickets.$inferInsert>) {
        await db
          .update(schema.tickets)
          .set(values)
          .where(and(eq(schema.tickets.tenantId, t), eq(schema.tickets.id, id)));
      },

      /** Due-soon window for the SLA breach cron — indexed, not a full scan (CLAUDE.md §10). */
      async dueSoon(beforeIso: string) {
        return db
          .select()
          .from(schema.tickets)
          .where(and(
            eq(schema.tickets.tenantId, t),
            isNull(schema.tickets.deletedAt),
            eq(schema.tickets.slaBreached, false),
            lte(schema.tickets.slaResolutionDueAt, beforeIso),
            notInArray(schema.tickets.status, ["resolved", "closed"]),
          ));
      },

      /** Resolved tickets due for auto-close — uses the (tenant_id, status) index (CLAUDE.md §10). */
      async resolvedBefore(beforeIso: string) {
        return db
          .select()
          .from(schema.tickets)
          .where(and(
            eq(schema.tickets.tenantId, t),
            isNull(schema.tickets.deletedAt),
            eq(schema.tickets.status, "resolved"),
            lte(schema.tickets.resolvedAt, beforeIso),
          ));
      },
    },

    ticketFieldValues: {
      async bulkCreate(rows: Omit<typeof schema.ticketFieldValues.$inferInsert, "tenantId">[]) {
        if (rows.length === 0) return;
        await db.insert(schema.ticketFieldValues).values(rows.map((r) => ({ ...r, tenantId: t })));
      },
      async listForTicket(ticketId: string, fieldKey?: string) {
        const conditions = [eq(schema.ticketFieldValues.tenantId, t), eq(schema.ticketFieldValues.ticketId, ticketId)];
        if (fieldKey) conditions.push(eq(schema.ticketFieldValues.fieldKey, fieldKey));
        return db.select().from(schema.ticketFieldValues).where(and(...conditions));
      },
    },

    ticketEvents: {
      async listForTicket(ticketId: string) {
        return db
          .select()
          .from(schema.ticketEvents)
          .where(and(eq(schema.ticketEvents.tenantId, t), eq(schema.ticketEvents.ticketId, ticketId)))
          .orderBy(asc(schema.ticketEvents.createdAt));
      },
      async create(values: Omit<typeof schema.ticketEvents.$inferInsert, "tenantId">) {
        await db.insert(schema.ticketEvents).values({ ...values, tenantId: t });
      },
    },

    ticketMessages: {
      /**
       * Internal notes are filtered here, at the query layer, never in the
       * view (CLAUDE.md §5.4). Contacts must always call with
       * `includeInternalNotes: false`.
       */
      async listForTicket(ticketId: string, opts: { includeInternalNotes: boolean }) {
        const conditions = [
          eq(schema.ticketMessages.tenantId, t),
          eq(schema.ticketMessages.ticketId, ticketId),
          isNull(schema.ticketMessages.deletedAt),
        ];
        if (!opts.includeInternalNotes) {
          conditions.push(eq(schema.ticketMessages.isInternalNote, false));
        }
        return db
          .select()
          .from(schema.ticketMessages)
          .where(and(...conditions))
          .orderBy(asc(schema.ticketMessages.createdAt));
      },
      async create(values: Omit<typeof schema.ticketMessages.$inferInsert, "tenantId">) {
        await db.insert(schema.ticketMessages).values({ ...values, tenantId: t });
      },
    },

    attachments: {
      async listForTicket(ticketId: string) {
        return db
          .select()
          .from(schema.attachments)
          .where(and(eq(schema.attachments.tenantId, t), eq(schema.attachments.ticketId, ticketId), isNull(schema.attachments.deletedAt)));
      },
      async get(id: string) {
        const rows = await db
          .select()
          .from(schema.attachments)
          .where(and(eq(schema.attachments.tenantId, t), eq(schema.attachments.id, id), isNull(schema.attachments.deletedAt)))
          .limit(1);
        return rows[0] ?? null;
      },
      async create(values: Omit<typeof schema.attachments.$inferInsert, "tenantId">) {
        await db.insert(schema.attachments).values({ ...values, tenantId: t });
      },
    },

    automationRules: {
      async listEnabled() {
        return db
          .select()
          .from(schema.automationRules)
          .where(and(eq(schema.automationRules.tenantId, t), eq(schema.automationRules.enabled, true), isNull(schema.automationRules.deletedAt)));
      },
    },

    /** Reporting-only fair-use figures (CLAUDE.md §12) — nothing here is billed on. The row is seeded at tenant creation, so these are always UPDATEs, never an upsert. */
    tenantUsage: {
      async incrementAttachmentBytes(bytes: number) {
        await db
          .update(schema.tenantUsage)
          .set({ attachmentBytesTotal: sql`${schema.tenantUsage.attachmentBytesTotal} + ${bytes}`, updatedAt: new Date().toISOString() })
          .where(eq(schema.tenantUsage.tenantId, t));
      },
      async incrementTicketCount() {
        await db
          .update(schema.tenantUsage)
          .set({ ticketCountTotal: sql`${schema.tenantUsage.ticketCountTotal} + 1`, updatedAt: new Date().toISOString() })
          .where(eq(schema.tenantUsage.tenantId, t));
      },
      async get() {
        const rows = await db.select().from(schema.tenantUsage).where(eq(schema.tenantUsage.tenantId, t)).limit(1);
        return rows[0] ?? null;
      },
    },

    domains: {
      async listVerified() {
        return db
          .select()
          .from(schema.domains)
          .where(and(eq(schema.domains.tenantId, t), eq(schema.domains.status, "active"), isNull(schema.domains.deletedAt)));
      },
      async create(values: Omit<typeof schema.domains.$inferInsert, "tenantId">) {
        await db.insert(schema.domains).values({ ...values, tenantId: t });
      },
    },
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;
