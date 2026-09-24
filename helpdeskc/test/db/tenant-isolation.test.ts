import { describe, expect, test, beforeEach } from "bun:test";
import postgres from "postgres";
import { createTestHyperdrive, resetTestDb } from "../helpers/pg-test-client";
import { tenantDb } from "../../src/db/client";
import { platformDb } from "../../src/db/platform-client";
import { uuidv7 } from "../../src/core/id/uuid7";

/**
 * The test CLAUDE.md §5.3 and §14 require on every tenant table: two
 * seeded tenants, proving tenant A cannot read tenant B's rows through the
 * tenant-scoped client. Runs the real src/db/client.ts against the actual
 * Postgres database (migrated off D1/SQLite — CLAUDE.md §4), reached
 * through the SSH tunnel configured via DATABASE_URL (see .dev.vars).
 */
describe("tenant isolation", () => {
  let hyperdrive: Hyperdrive;
  let tenantAId: string;
  let tenantBId: string;

  beforeEach(async () => {
    await resetTestDb();
    hyperdrive = createTestHyperdrive();
    const now = new Date().toISOString();
    const platform = platformDb(hyperdrive);

    await platform.plans.list(); // sanity: schema is queryable

    const planId = uuidv7();
    // platformDb has no plans.create() (plans are platform-seeded, never
    // written by app code) — insert directly, same as the old raw
    // d1.prepare() call this replaces.
    const sql = postgres(hyperdrive.connectionString, { max: 1, connection: { search_path: "helpdeskc" } });
    await sql`INSERT INTO plans (id, name, price_sen, currency, created_at) VALUES (${planId}, 'Standard', 500000, 'MYR', ${now})`;
    await sql.end();

    tenantAId = uuidv7();
    tenantBId = uuidv7();
    await platform.tenants.create({ id: tenantAId, slug: "acme", name: "Acme", planId, billingState: "active", primaryColor: null, logoR2Key: null, createdAt: now, deletedAt: null });
    await platform.tenants.create({ id: tenantBId, slug: "globex", name: "Globex", planId, billingState: "active", primaryColor: null, logoR2Key: null, createdAt: now, deletedAt: null });
  });

  test("tenant A cannot read tenant B's accounts", async () => {
    const dbA = tenantDb(hyperdrive, tenantAId);
    const dbB = tenantDb(hyperdrive, tenantBId);
    const now = new Date().toISOString();

    await dbA.accounts.create({ id: uuidv7(), name: "Acme Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });
    await dbB.accounts.create({ id: uuidv7(), name: "Globex Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });

    const accountsA = await dbA.accounts.list();
    const accountsB = await dbB.accounts.list();

    expect(accountsA).toHaveLength(1);
    expect(accountsB).toHaveLength(1);
    expect(accountsA[0]!.name).toBe("Acme Client Co");
    expect(accountsB[0]!.name).toBe("Globex Client Co");
  });

  test("get() by id scopes to the caller's tenant even with a valid id from the other tenant", async () => {
    const dbA = tenantDb(hyperdrive, tenantAId);
    const dbB = tenantDb(hyperdrive, tenantBId);
    const now = new Date().toISOString();

    const accountBId = uuidv7();
    await dbB.accounts.create({ id: accountBId, name: "Globex Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });

    // Tenant A tries to fetch tenant B's (unguessable but valid) account id.
    const result = await dbA.accounts.get(accountBId);
    expect(result).toBeNull();

    // Tenant B can fetch its own.
    expect(await dbB.accounts.get(accountBId)).not.toBeNull();
  });

  test("contacts.findByEmail is scoped per tenant even for the same email address", async () => {
    const dbA = tenantDb(hyperdrive, tenantAId);
    const dbB = tenantDb(hyperdrive, tenantBId);
    const now = new Date().toISOString();

    const accountAId = uuidv7();
    const accountBId = uuidv7();
    await dbA.accounts.create({ id: accountAId, name: "Acme Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });
    await dbB.accounts.create({ id: accountBId, name: "Globex Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });

    // CLAUDE.md §7: the same email may be a Contact at two different
    // tenants — these must be separate records with separate credentials.
    await dbA.contacts.create({ id: uuidv7(), accountId: accountAId, teamId: null, email: "shared@client.test", name: "Alice at Acme", passwordHash: "hashA", emailVerifiedAt: now, createdAt: now, deletedAt: null });
    await dbB.contacts.create({ id: uuidv7(), accountId: accountBId, teamId: null, email: "shared@client.test", name: "Alice at Globex", passwordHash: "hashB", emailVerifiedAt: now, createdAt: now, deletedAt: null });

    const contactA = await dbA.contacts.findByEmail("shared@client.test");
    const contactB = await dbB.contacts.findByEmail("shared@client.test");

    expect(contactA!.name).toBe("Alice at Acme");
    expect(contactB!.name).toBe("Alice at Globex");
    expect(contactA!.id).not.toBe(contactB!.id);
  });

  test("tickets.list never returns another tenant's tickets regardless of scope", async () => {
    const dbA = tenantDb(hyperdrive, tenantAId);
    const dbB = tenantDb(hyperdrive, tenantBId);
    const now = new Date().toISOString();

    const accountAId = uuidv7();
    const accountBId = uuidv7();
    await dbA.accounts.create({ id: accountAId, name: "Acme Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });
    await dbB.accounts.create({ id: accountBId, name: "Globex Client Co", scopeByTeam: false, createdAt: now, deletedAt: null });

    const contactAId = uuidv7();
    const contactBId = uuidv7();
    await dbA.contacts.create({ id: contactAId, accountId: accountAId, teamId: null, email: "a@acme-client.test", name: "A", passwordHash: null, emailVerifiedAt: null, createdAt: now, deletedAt: null });
    await dbB.contacts.create({ id: contactBId, accountId: accountBId, teamId: null, email: "b@globex-client.test", name: "B", passwordHash: null, emailVerifiedAt: null, createdAt: now, deletedAt: null });

    const templateAId = uuidv7();
    const templateBId = uuidv7();
    await dbA.templates.create({ id: templateAId, name: "Bug Report", description: null, isDefault: true, accountId: null, teamId: null, createdAt: now, deletedAt: null });
    await dbB.templates.create({ id: templateBId, name: "Bug Report", description: null, isDefault: true, accountId: null, teamId: null, createdAt: now, deletedAt: null });

    const versionAId = uuidv7();
    const versionBId = uuidv7();
    await dbA.templateVersions.create({ id: versionAId, templateId: templateAId, version: 1, fields: "[]", defaults: JSON.stringify({ category: "bug", priority: "medium" }), createdAt: now });
    await dbB.templateVersions.create({ id: versionBId, templateId: templateBId, version: 1, fields: "[]", defaults: JSON.stringify({ category: "bug", priority: "medium" }), createdAt: now });

    await dbA.tickets.create({
      id: uuidv7(), number: 1, accountId: accountAId, teamId: null, contactId: contactAId, templateId: templateAId, templateVersionId: versionAId,
      status: "new", priority: "medium", category: "bug", subject: "Acme issue", assigneeAgentId: null, queue: null, fieldValues: "{}", tags: "[]",
      slaPolicyId: null, slaFirstResponseDueAt: null, slaResolutionDueAt: null, slaFirstResponseAt: null, slaPausedAt: null, slaPausedTotalSeconds: 0, slaBreached: false,
      createdAt: now, updatedAt: now, resolvedAt: null, closedAt: null, deletedAt: null,
    });
    await dbB.tickets.create({
      id: uuidv7(), number: 1, accountId: accountBId, teamId: null, contactId: contactBId, templateId: templateBId, templateVersionId: versionBId,
      status: "new", priority: "medium", category: "bug", subject: "Globex issue", assigneeAgentId: null, queue: null, fieldValues: "{}", tags: "[]",
      slaPolicyId: null, slaFirstResponseDueAt: null, slaResolutionDueAt: null, slaFirstResponseAt: null, slaPausedAt: null, slaPausedTotalSeconds: 0, slaBreached: false,
      createdAt: now, updatedAt: now, resolvedAt: null, closedAt: null, deletedAt: null,
    });

    const ticketsA = await dbA.tickets.list({ scope: "all" });
    const ticketsB = await dbB.tickets.list({ scope: "all" });

    expect(ticketsA).toHaveLength(1);
    expect(ticketsB).toHaveLength(1);
    expect(ticketsA[0]!.subject).toBe("Acme issue");
    expect(ticketsB[0]!.subject).toBe("Globex issue");

    // Also true for the Contact-facing listing path.
    const contactTicketsA = await dbA.tickets.listForContact({ accountId: accountAId, teamId: null });
    expect(contactTicketsA).toHaveLength(1);
    expect(contactTicketsA[0]!.subject).toBe("Acme issue");
  });

  test("roles, agents and agent invites are isolated per tenant", async () => {
    const dbA = tenantDb(hyperdrive, tenantAId);
    const dbB = tenantDb(hyperdrive, tenantBId);
    const now = new Date().toISOString();

    await dbA.roles.create({ id: uuidv7(), name: "Support", ticketScope: "all", permissions: "[]", isPreset: false, createdAt: now, deletedAt: null });
    await dbB.roles.create({ id: uuidv7(), name: "Support", ticketScope: "all", permissions: "[]", isPreset: false, createdAt: now, deletedAt: null });
    expect(await dbA.roles.list()).toHaveLength(1);
    expect(await dbB.roles.list()).toHaveLength(1);

    const agentAId = uuidv7();
    const agentBId = uuidv7();
    await dbA.agents.create({ id: agentAId, email: "shared@agents.test", name: "Agent A", totpSecret: null, totpEnabled: false, createdAt: now, deletedAt: null });
    await dbB.agents.create({ id: agentBId, email: "shared@agents.test", name: "Agent B", totpSecret: null, totpEnabled: false, createdAt: now, deletedAt: null });

    // Same email at two tenants stays separate (CLAUDE.md §7), same as Contacts.
    const foundA = await dbA.agents.findByEmail("shared@agents.test");
    const foundB = await dbB.agents.findByEmail("shared@agents.test");
    expect(foundA!.name).toBe("Agent A");
    expect(foundB!.name).toBe("Agent B");

    // Tenant A cannot fetch tenant B's agent by a valid id from tenant B.
    expect(await dbA.agents.get(agentBId)).toBeNull();

    const inviteBId = uuidv7();
    await dbB.agentInvites.create({ id: inviteBId, agentId: agentBId, tokenHash: "somehash", createdAt: now, expiresAt: now });
    expect(await dbA.agentInvites.findByTokenHash("somehash")).toBeNull();
    expect(await dbB.agentInvites.findByTokenHash("somehash")).not.toBeNull();
  });
});
