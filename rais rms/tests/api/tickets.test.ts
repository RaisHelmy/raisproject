import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("tickets / events", () => {
  test("creates an event and sells tickets up to capacity", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const event = await client.post(`/api/outlets/${outletId}/events`, {
      name: "Chef's Table",
      startsAt: Date.now() + 7 * 24 * 3600_000,
      priceMinor: 5000,
      currency: "USD",
      capacity: 2,
    });
    expect(event.status).toBe(201);
    const eventId = ((await event.json()) as any).data.id;

    const order1 = await client.post(`/api/outlets/${outletId}/events/${eventId}/orders`, {
      guestName: "Guest One",
      quantity: 2,
    });
    expect(order1.status).toBe(201);
    expect(((await order1.json()) as any).data.total_minor).toBe(10000);

    const order2 = await client.post(`/api/outlets/${outletId}/events/${eventId}/orders`, {
      guestName: "Guest Two",
      quantity: 1,
    });
    expect(order2.status).toBe(400);
  });

  test("lists orders for an event", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const event = await client.post(`/api/outlets/${outletId}/events`, {
      name: "Wine Tasting",
      startsAt: Date.now() + 3600_000,
      priceMinor: 2000,
      currency: "USD",
      capacity: 10,
    });
    const eventId = ((await event.json()) as any).data.id;
    await client.post(`/api/outlets/${outletId}/events/${eventId}/orders`, { guestName: "A", quantity: 1 });

    const orders = await client.get(`/api/outlets/${outletId}/events/${eventId}/orders`);
    expect(((await orders.json()) as any).data.length).toBe(1);
  });
});
