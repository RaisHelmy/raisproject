import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("inventory", () => {
  test("creates an item, adjusts stock, and surfaces it as low-stock once below par", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/outlets/${outletId}/inventory`, {
      name: "House Wine",
      unit: "bottle",
      qtyOnHand: 10,
      parLevel: 5,
    });
    expect(created.status).toBe(201);
    const itemId = ((await created.json()) as any).data.id;

    const adjusted = await client.post(`/api/outlets/${outletId}/inventory/${itemId}/adjust`, {
      delta: -8,
      reason: "service usage",
    });
    expect(adjusted.status).toBe(200);
    expect(((await adjusted.json()) as any).data.qty_on_hand).toBe(2);

    const lowStock = await client.get(`/api/outlets/${outletId}/inventory/low-stock`);
    const lowStockBody = (await lowStock.json()) as any;
    expect(lowStockBody.data.some((i: any) => i.id === itemId)).toBe(true);
  });
});

describe("staff scheduling", () => {
  test("owner can schedule a shift for an invited staff member", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const invite = await client.post("/api/users/invite", {
      name: "Server Sam",
      email: "sam@example.com",
      outletId,
      role: "server",
    });
    const userId = ((await invite.json()) as any).data.userId;

    const shift = await client.post(`/api/outlets/${outletId}/shifts`, {
      userId,
      startsAt: Date.now() + 3600_000,
      endsAt: Date.now() + 8 * 3600_000,
      role: "server",
    });
    expect(shift.status).toBe(201);

    const list = await client.get(`/api/outlets/${outletId}/shifts`);
    expect(((await list.json()) as any).data.length).toBe(1);
  });

  test("rejects a shift where endsAt is before startsAt", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;
    const ownerId = json.data.user.id as string;

    const shift = await client.post(`/api/outlets/${outletId}/shifts`, {
      userId: ownerId,
      startsAt: Date.now() + 8 * 3600_000,
      endsAt: Date.now() + 3600_000,
      role: "owner",
    });
    expect(shift.status).toBe(400);
  });
});
