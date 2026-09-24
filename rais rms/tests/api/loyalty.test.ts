import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("loyalty", () => {
  test("completing a reservation accrues points automatically", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Loyal Guest",
      startsAt: Date.now() - 3600_000,
      partySize: 4,
      source: "walkin",
    });
    const reservation = ((await created.json()) as any).data;

    await client.patch(`/api/reservations/${outletId}/${reservation.id}`, { status: "seated" });
    await client.patch(`/api/reservations/${outletId}/${reservation.id}`, { status: "completed" });

    const account = await client.get(`/api/loyalty/${reservation.guest_id}`);
    const body = (await account.json()) as any;
    expect(body.data.points_balance).toBe(40); // 4 guests * 10 points
    expect(body.data.transactions.length).toBe(1);
  });

  test("accrual is idempotent — re-marking the same reservation completed doesn't double-award", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Repeat Complete",
      startsAt: Date.now() - 3600_000,
      partySize: 2,
      source: "walkin",
    });
    const reservation = ((await created.json()) as any).data;

    await client.patch(`/api/reservations/${outletId}/${reservation.id}`, { status: "completed" });
    await client.patch(`/api/reservations/${outletId}/${reservation.id}`, { status: "completed" });

    const account = await client.get(`/api/loyalty/${reservation.guest_id}`);
    const body = (await account.json()) as any;
    expect(body.data.points_balance).toBe(20); // 2 guests * 10, only once
  });

  test("staff can redeem points, but not more than the balance", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Redeemer",
      startsAt: Date.now() - 3600_000,
      partySize: 5,
      source: "walkin",
    });
    const reservation = ((await created.json()) as any).data;
    await client.patch(`/api/reservations/${outletId}/${reservation.id}`, { status: "completed" });

    const overRedeem = await client.post(`/api/loyalty/${reservation.guest_id}/redeem`, {
      points: 1000,
      reason: "free dessert",
    });
    expect(overRedeem.status).toBe(400);

    const redeem = await client.post(`/api/loyalty/${reservation.guest_id}/redeem`, {
      points: 20,
      reason: "free dessert",
    });
    expect(redeem.status).toBe(200);
    expect(((await redeem.json()) as any).data.points_balance).toBe(30); // 50 - 20
  });
});
