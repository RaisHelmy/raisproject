import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";
import { createManageToken } from "../../api/lib/manageToken";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

async function completedReservation(env: ReturnType<typeof testEnv>) {
  const owner = new TestClient(env);
  const { json, body } = await registerTenant(owner);
  const outletId = json.data.outlet.id as string;
  const tenantId = json.data.tenant.id as string;

  const created = await owner.post(`/api/reservations/${outletId}`, {
    guestName: "Feedback Guest",
    guestEmail: "feedback@example.com",
    startsAt: Date.now() - 3600_000,
    partySize: 2,
    source: "walkin",
  });
  const reservationId = ((await created.json()) as any).data.id;
  await owner.patch(`/api/reservations/${outletId}/${reservationId}`, { status: "seated" });
  await owner.patch(`/api/reservations/${outletId}/${reservationId}`, { status: "completed" });

  const token = await createManageToken(TEST_SECRET, tenantId, reservationId);
  return { owner, tenantSlug: body.tenantSlug, outletId, reservationId, token };
}

describe("feedback", () => {
  test("a high-scoring survey routes to public and appears in the staff list", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId, reservationId, token } = await completedReservation(env);

    const client = new TestClient(env);
    const submit = await client.post(
      `/api/public/${tenantSlug}/reservations/${reservationId}/feedback?token=${token}`,
      { scores: { ambiance: 5, service: 5, food: 5, value: 5 }, comment: "Amazing!" },
    );
    expect(submit.status).toBe(201);
    expect(((await submit.json()) as any).data.routedToPublic).toBe(true);

    const list = await owner.get(`/api/outlets/${outletId}/feedback`);
    const listBody = (await list.json()) as any;
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].is_private).toBe(false);
  });

  test("a low-scoring survey stays private", async () => {
    const env = testEnv();
    const { tenantSlug, reservationId, token } = await completedReservation(env);

    const client = new TestClient(env);
    const submit = await client.post(`/api/public/${tenantSlug}/reservations/${reservationId}/feedback?token=${token}`, {
      scores: { ambiance: 2, service: 1, food: 2, value: 2 },
      comment: "Not great",
    });
    expect(((await submit.json()) as any).data.routedToPublic).toBe(false);
  });

  test("submitting feedback twice for the same reservation is rejected", async () => {
    const env = testEnv();
    const { tenantSlug, reservationId, token } = await completedReservation(env);

    const client = new TestClient(env);
    const path = `/api/public/${tenantSlug}/reservations/${reservationId}/feedback?token=${token}`;
    const first = await client.post(path, { scores: { food: 5 } });
    expect(first.status).toBe(201);

    const second = await client.post(path, { scores: { food: 5 } });
    expect(second.status).toBe(400);
  });

  test("an invalid or forged token is rejected", async () => {
    const env = testEnv();
    const { tenantSlug, reservationId } = await completedReservation(env);
    const client = new TestClient(env);
    const res = await client.post(
      `/api/public/${tenantSlug}/reservations/${reservationId}/feedback?token=0000000000000000000000000000000000`,
      { scores: { food: 5 } },
    );
    expect(res.status).toBe(403);
  });

  test("only MANAGE_OUTLET roles can view the feedback list", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId } = await completedReservation(env);

    const invite = await owner.post("/api/users/invite", {
      name: "Server Sam",
      email: "sam@example.com",
      outletId,
      role: "server",
    });
    const { data: inviteData } = (await invite.json()) as any;

    const server = new TestClient(env);
    await server.post("/api/auth/login", {
      tenantSlug,
      email: "sam@example.com",
      password: inviteData.tempPassword,
    });

    const list = await server.get(`/api/outlets/${outletId}/feedback`);
    expect(list.status).toBe(403);
  });
});
