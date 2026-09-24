import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("deposits / payments", () => {
  test("deposit creation 501s until Stripe is configured, instead of pretending to charge", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/reservations/${outletId}`, {
      guestName: "Depositor",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "phone",
    });
    const reservationId = ((await created.json()) as any).data.id;

    const deposit = await client.post(`/api/reservations/${outletId}/${reservationId}/deposit`, {
      amountMinor: 2000,
      currency: "USD",
      type: "deposit",
    });
    expect(deposit.status).toBe(501);
    const body = (await deposit.json()) as any;
    expect(body.error.code).toBe("PAYMENTS_NOT_CONFIGURED");
  });

  test("payments list starts empty for a fresh reservation", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const created = await client.post(`/api/reservations/${outletId}`, {
      guestName: "No Deposit Yet",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "phone",
    });
    const reservationId = ((await created.json()) as any).data.id;

    const list = await client.get(`/api/reservations/${outletId}/${reservationId}/payments`);
    expect(list.status).toBe(200);
    expect(((await list.json()) as any).data).toEqual([]);
  });
});
