import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

async function setup() {
  const client = new TestClient(testEnv());
  const { json } = await registerTenant(client);
  const outletId = json.data.outlet.id as string;
  return { client, outletId };
}

describe("reservations", () => {
  test("creates a reservation with a guest resolved by name/phone", async () => {
    const { client, outletId } = await setup();

    const res = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Alice Diner",
      guestPhone: "+15551234567",
      startsAt: Date.now() + 3600_000,
      partySize: 4,
      source: "widget",
    });
    const json = (await res.json()) as any;

    expect(res.status).toBe(201);
    expect(json.data.status).toBe("booked");
    expect(json.data.party_size).toBe(4);
    expect(json.data.guest_id).toBeTruthy();
  });

  test("lists reservations for the outlet", async () => {
    const { client, outletId } = await setup();
    await client.post(`/api/reservations/${outletId}`, {
      guestName: "Bob Diner",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "phone",
    });

    const res = await client.get(`/api/reservations/${outletId}`);
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(json.data.length).toBe(1);
    expect(json.meta.total).toBe(1);
  });

  test("updates reservation status through the lifecycle", async () => {
    const { client, outletId } = await setup();
    const create = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Carol Diner",
      startsAt: Date.now() + 3600_000,
      partySize: 3,
      source: "walkin",
    });
    const { data: reservation } = (await create.json()) as any;

    const seat = await client.patch(`/api/reservations/${outletId}/${reservation.id}`, {
      status: "seated",
    });
    expect(((await seat.json()) as any).data.status).toBe("seated");

    const complete = await client.patch(`/api/reservations/${outletId}/${reservation.id}`, {
      status: "completed",
    });
    expect(((await complete.json()) as any).data.status).toBe("completed");
  });

  test("404s for an outlet id belonging to a different tenant sharing the same database", async () => {
    const env = testEnv();
    const clientA = new TestClient(env);
    const outletA = (await registerTenant(clientA)).json.data.outlet.id;

    const clientB = new TestClient(env);
    await registerTenant(clientB);

    const res = await clientB.get(`/api/reservations/${outletA}`);
    expect(res.status).toBe(404);
  });
});
