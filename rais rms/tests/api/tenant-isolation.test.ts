import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

/**
 * CLAUDE.md §6 hard rule: every tenant-scoped endpoint must be covered by a
 * cross-tenant isolation test. Both tenants below share one D1 instance so a
 * leaking WHERE clause would actually be exercised.
 */
describe("tenant isolation", () => {
  async function twoTenants() {
    const env = testEnv();
    const a = new TestClient(env);
    const regA = await registerTenant(a);
    const b = new TestClient(env);
    const regB = await registerTenant(b);
    return { env, a, b, outletA: regA.json.data.outlet.id, outletB: regB.json.data.outlet.id };
  }

  test("guests created by tenant A are invisible to tenant B", async () => {
    const { a, b } = await twoTenants();

    const created = await a.post("/api/guests", { name: "Tenant A Guest", marketingConsent: false });
    const guestId = ((await created.json()) as any).data.id;

    const listB = await b.get("/api/guests");
    const namesB = ((await listB.json()) as any).data.map((g: any) => g.name);
    expect(namesB).not.toContain("Tenant A Guest");

    const getB = await b.get(`/api/guests/${guestId}`);
    expect(getB.status).toBe(404);
  });

  test("reservations created by tenant A are invisible to tenant B, even via tenant A's outlet id", async () => {
    const { a, b, outletA } = await twoTenants();

    const created = await a.post(`/api/reservations/${outletA}`, {
      guestName: "Isolated Diner",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "widget",
    });
    const reservationId = ((await created.json()) as any).data.id;

    // Tenant B doesn't own outletA, so the outlet-scope check 404s first.
    const listB = await b.get(`/api/reservations/${outletA}`);
    expect(listB.status).toBe(404);

    const getB = await b.get(`/api/reservations/${outletA}/${reservationId}`);
    expect(getB.status).toBe(404);
  });

  test("tenant B cannot see tenant A's outlets", async () => {
    const { b, outletA } = await twoTenants();
    const res = await b.get(`/api/outlets/${outletA}`);
    expect(res.status).toBe(404);
  });

  test("waitlist entries do not leak across tenants", async () => {
    const { a, b, outletA } = await twoTenants();
    await a.post(`/api/waitlist/${outletA}`, { guestName: "Waiting Guest", partySize: 2 });

    const res = await b.get(`/api/waitlist/${outletA}`);
    expect(res.status).toBe(404);
  });
});
