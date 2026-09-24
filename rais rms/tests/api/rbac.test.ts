import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("RBAC", () => {
  test("owner can invite staff and assign a role", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const res = await client.post("/api/users/invite", {
      name: "Server Sam",
      email: "sam@example.com",
      outletId,
      role: "server",
    });
    const body = (await res.json()) as any;

    expect(res.status).toBe(201);
    expect(body.data.tempPassword).toBeTruthy();
    expect(body.data.role).toBe("server");
  });

  test("a server role cannot create outlets or manage floor plan, but can take reservations", async () => {
    const env = testEnv();
    const owner = new TestClient(env);
    const { json, body } = await registerTenant(owner);
    const outletId = json.data.outlet.id as string;

    const invite = await owner.post("/api/users/invite", {
      name: "Server Sam",
      email: "sam@example.com",
      outletId,
      role: "server",
    });
    const { data: inviteData } = (await invite.json()) as any;

    const server = new TestClient(env);
    await server.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: "sam@example.com",
      password: inviteData.tempPassword,
    });

    const createOutlet = await server.post("/api/outlets", {
      name: "Second Outlet",
      timezone: "UTC",
      currency: "USD",
    });
    expect(createOutlet.status).toBe(403);

    const createArea = await server.post(`/api/outlets/${outletId}/areas`, { name: "Patio" });
    expect(createArea.status).toBe(403);

    const createReservation = await server.post(`/api/reservations/${outletId}`, {
      guestName: "Server-booked guest",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "phone",
    });
    expect(createReservation.status).toBe(201);
  });

  test("a read_only role cannot write anything but can read", async () => {
    const env = testEnv();
    const owner = new TestClient(env);
    const { json, body } = await registerTenant(owner);
    const outletId = json.data.outlet.id as string;

    const invite = await owner.post("/api/users/invite", {
      name: "Read Only Rhea",
      email: "rhea@example.com",
      outletId,
      role: "read_only",
    });
    const { data: inviteData } = (await invite.json()) as any;

    const viewer = new TestClient(env);
    await viewer.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: "rhea@example.com",
      password: inviteData.tempPassword,
    });

    const list = await viewer.get(`/api/reservations/${outletId}`);
    expect(list.status).toBe(200);

    const create = await viewer.post(`/api/reservations/${outletId}`, {
      guestName: "Should be blocked",
      startsAt: Date.now() + 3600_000,
      partySize: 2,
      source: "phone",
    });
    expect(create.status).toBe(403);
  });

  test("only owner/group_admin can list and invite staff — a server gets 403", async () => {
    const env = testEnv();
    const owner = new TestClient(env);
    const { json, body } = await registerTenant(owner);
    const outletId = json.data.outlet.id as string;

    const invite = await owner.post("/api/users/invite", {
      name: "Server Sam",
      email: "sam2@example.com",
      outletId,
      role: "server",
    });
    const { data: inviteData } = (await invite.json()) as any;

    const server = new TestClient(env);
    await server.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: "sam2@example.com",
      password: inviteData.tempPassword,
    });

    const list = await server.get("/api/users");
    expect(list.status).toBe(403);
  });

  test("a user cannot revoke or disable their own access", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;
    const ownerId = json.data.user.id as string;

    const revoke = await client.request("DELETE", `/api/users/${ownerId}/roles/${outletId}`);
    expect(revoke.status).toBe(403);

    const disable = await client.patch(`/api/users/${ownerId}/status`, { status: "disabled" });
    expect(disable.status).toBe(400);
  });
});
