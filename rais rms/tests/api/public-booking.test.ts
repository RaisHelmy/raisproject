import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

async function setupWithFloorAndService(env: ReturnType<typeof testEnv>) {
  const owner = new TestClient(env);
  const { json, body } = await registerTenant(owner);
  const outletId = json.data.outlet.id as string;

  const area = await owner.post(`/api/outlets/${outletId}/areas`, { name: "Main" });
  const areaId = ((await area.json()) as any).data.id;
  await owner.post(`/api/outlets/${outletId}/tables`, {
    areaId,
    label: "T1",
    seatsMin: 1,
    seatsMax: 4,
    x: 0,
    y: 0,
    combinable: true,
  });
  await owner.post(`/api/outlets/${outletId}/services`, {
    name: "Dinner",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startTime: "17:00",
    endTime: "22:00",
  });

  return { owner, tenantSlug: body.tenantSlug, outletId };
}

function nextFridayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

describe("public booking widget (no auth)", () => {
  test("lists outlets for a tenant slug without a session", async () => {
    const env = testEnv();
    const { tenantSlug } = await setupWithFloorAndService(env);
    const client = new TestClient(env);
    const res = await client.get(`/api/public/${tenantSlug}/outlets`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.length).toBe(1);
  });

  test("an unknown outlet id 404s instead of leaking existence", async () => {
    const env = testEnv();
    const { tenantSlug } = await setupWithFloorAndService(env);
    const client = new TestClient(env);
    const date = nextFridayISO();
    const res = await client.get(
      `/api/public/${tenantSlug}/outlets/00000000-0000-0000-0000-000000000000/availability?date=${date}&partySize=2`,
    );
    expect(res.status).toBe(404);
  });

  test("books a reservation publicly and can view/cancel it via the manage token", async () => {
    const env = testEnv();
    const { tenantSlug, outletId } = await setupWithFloorAndService(env);
    const client = new TestClient(env);

    const date = nextFridayISO();
    const avail = await client.get(`/api/public/${tenantSlug}/outlets/${outletId}/availability?date=${date}&partySize=2`);
    expect(avail.status).toBe(200);
    const slots = ((await avail.json()) as any).data;
    expect(slots.length).toBeGreaterThan(0);

    const book = await client.post(`/api/public/${tenantSlug}/outlets/${outletId}/reservations`, {
      guestName: "Public Guest",
      guestEmail: "guest@example.com",
      startsAt: slots[0].startsAt,
      partySize: 2,
    });
    expect(book.status).toBe(201);
    const { data } = (await book.json()) as any;
    expect(data.reservation.status).toBe("booked");
    expect(data.manageToken).toBeTruthy();

    const view = await client.get(`/api/public/${tenantSlug}/reservations/${data.reservation.id}?token=${data.manageToken}`);
    expect(view.status).toBe(200);

    const badToken = await client.get(`/api/public/${tenantSlug}/reservations/${data.reservation.id}?token=wrongtokenwrongtokenwrong`);
    expect(badToken.status).toBe(403);

    const cancel = await client.post(
      `/api/public/${tenantSlug}/reservations/${data.reservation.id}/manage?token=${data.manageToken}`,
      { action: "cancel" },
    );
    expect(cancel.status).toBe(200);
    expect(((await cancel.json()) as any).data.status).toBe("cancelled");
  });

  test("rejects booking when the party size exceeds total floor capacity", async () => {
    const env = testEnv();
    const { tenantSlug, outletId } = await setupWithFloorAndService(env);
    const client = new TestClient(env);

    const res = await client.post(`/api/public/${tenantSlug}/outlets/${outletId}/reservations`, {
      guestName: "Huge Party",
      startsAt: Date.now() + 3600_000,
      partySize: 50, // only one 4-seat table exists
    });
    expect(res.status).toBe(400);
  });

  test("an unknown tenant slug 404s instead of leaking existence", async () => {
    const client = new TestClient(testEnv());
    const res = await client.get(`/api/public/no-such-tenant/outlets`);
    expect(res.status).toBe(404);
  });
});
