import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

/**
 * CLAUDE.md §6 hard rule: every tenant-scoped endpoint needs a cross-tenant
 * isolation test. tests/api/tenant-isolation.test.ts covers Phase 1
 * (guests/reservations/outlets/waitlist); this covers the Phase 2/3 modules
 * added afterward (menu, orders, inventory, staff shifts, tickets, campaigns,
 * feedback, loyalty). Both tenants share one D1 instance so a leaking
 * WHERE clause would actually be exercised.
 */
describe("tenant isolation — phase 2/3 modules", () => {
  async function twoTenants() {
    const env = testEnv();
    const a = new TestClient(env);
    const regA = await registerTenant(a);
    const b = new TestClient(env);
    const regB = await registerTenant(b);
    return { env, a, b, outletA: regA.json.data.outlet.id as string, outletB: regB.json.data.outlet.id as string };
  }

  test("menu items created by tenant A are invisible to tenant B, even via tenant A's outlet id", async () => {
    const { a, b, outletA } = await twoTenants();
    const menu = await a.post(`/api/outlets/${outletA}/menus`, { name: "A's Menu" });
    const menuId = ((await menu.json()) as any).data.id;

    const res = await b.get(`/api/outlets/${outletA}/menus/${menuId}/full`);
    expect(res.status).toBe(404);
  });

  test("orders do not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    const menu = await a.post(`/api/outlets/${outletA}/menus`, { name: "M" });
    const menuId = ((await menu.json()) as any).data.id;
    const section = await a.post(`/api/outlets/${outletA}/menus/${menuId}/sections`, { name: "S", sortOrder: 0 });
    const sectionId = ((await section.json()) as any).data.id;
    const item = await a.post(`/api/outlets/${outletA}/sections/${sectionId}/items`, {
      name: "Item",
      priceMinor: 500,
      currency: "USD",
      available: true,
    });
    const itemId = ((await item.json()) as any).data.id;
    const order = await a.post(`/api/outlets/${outletA}/orders`, { type: "dine_in", items: [{ menuItemId: itemId, qty: 1 }] });
    expect(order.status).toBe(201);

    const listB = await b.get(`/api/outlets/${outletA}/orders`);
    expect(listB.status).toBe(404); // outletA doesn't belong to tenant B
  });

  test("inventory items do not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    const item = await a.post(`/api/outlets/${outletA}/inventory`, { name: "Flour", unit: "kg", qtyOnHand: 10, parLevel: 2 });
    expect(item.status).toBe(201);
    const itemId = ((await item.json()) as any).data.id;

    const adjust = await b.post(`/api/outlets/${outletA}/inventory/${itemId}/adjust`, { delta: -100, reason: "sabotage" });
    expect(adjust.status).toBe(404); // outletA scoping rejects tenant B before the item lookup even matters
  });

  test("staff shifts do not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    const meA = await (await a.get("/api/auth/me")).json() as any;
    const shift = await a.post(`/api/outlets/${outletA}/shifts`, {
      userId: meA.data.userId,
      startsAt: Date.now() + 3600_000,
      endsAt: Date.now() + 7200_000,
      role: "owner",
    });
    expect(shift.status).toBe(201);

    const listB = await b.get(`/api/outlets/${outletA}/shifts`);
    expect(listB.status).toBe(404);
  });

  test("ticket events and orders do not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    const event = await a.post(`/api/outlets/${outletA}/events`, {
      name: "Private Dinner",
      startsAt: Date.now() + 3600_000,
      priceMinor: 5000,
      currency: "USD",
      capacity: 10,
    });
    expect(event.status).toBe(201);

    const listB = await b.get(`/api/outlets/${outletA}/events`);
    expect(listB.status).toBe(404);
  });

  test("campaigns do not leak across tenants", async () => {
    const { a, b } = await twoTenants();
    const campaign = await a.post("/api/campaigns", { channel: "email", trigger: "manual", body: "Hi" });
    const campaignId = ((await campaign.json()) as any).data.id;

    const res = await b.get(`/api/campaigns/${campaignId}`);
    expect(res.status).toBe(404);
  });

  test("feedback does not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    const res = await a.post(`/api/reservations/${outletA}`, {
      guestName: "Feedback Test",
      startsAt: Date.now() - 3600_000,
      partySize: 2,
      source: "walkin",
    });
    const reservationId = ((await res.json()) as any).data.id;
    await a.patch(`/api/reservations/${outletA}/${reservationId}`, { status: "completed" });

    const listB = await b.get(`/api/outlets/${outletA}/feedback`);
    expect(listB.status).toBe(404);
  });

  test("loyalty accounts are scoped per tenant even for the same guest id shape", async () => {
    const { a, b, outletA } = await twoTenants();
    const res = await a.post(`/api/reservations/${outletA}`, {
      guestName: "Loyalty Isolation",
      startsAt: Date.now() - 3600_000,
      partySize: 3,
      source: "walkin",
    });
    const reservation = ((await res.json()) as any).data;
    await a.patch(`/api/reservations/${outletA}/${reservation.id}`, { status: "completed" });

    // tenant B has never seen this guest id — its own tenant-scoped query must not find it.
    const balanceB = await b.get(`/api/loyalty/${reservation.guest_id}`);
    expect(balanceB.status).toBe(404);
  });

  test("R2 image keys from tenant A cannot be read via tenant B's public slug", async () => {
    const { env, a, outletA } = await twoTenants();

    // A key that legitimately belongs to tenant A...
    const meA = ((await (await a.get("/api/auth/me")).json()) as any).data;
    const tenantAKey = `tenants/${meA.tenantId}/${outletA}/menu/some-image.png`;
    await env.BUCKET.put(tenantAKey, new Uint8Array([1, 2, 3]).buffer, {
      httpMetadata: { contentType: "image/png" },
    });

    // ...must 404 when requested through a DIFFERENT tenant's public slug, even
    // though the object physically exists in the (shared) bucket.
    const bClientForImages = new TestClient(env);
    const regBBody = await registerTenant(bClientForImages);
    const res = await bClientForImages.get(`/api/public/${regBBody.body.tenantSlug}/images/${tenantAKey}`);
    expect(res.status).toBe(404);
  });
});
