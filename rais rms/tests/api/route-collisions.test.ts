import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

/**
 * Regression guard: outlets, orders, feedback, inventory, and staff-shifts routers
 * are all mounted at the same "/outlets" prefix. A route defined as bare
 * "/:outletId" in any of them would shadow "GET /api/outlets/:outletId" (get
 * outlet details) since Hono matches whichever handler was registered for that
 * exact path+method. Each of those routers must nest under its own segment
 * (/orders, /feedback, /inventory, /shifts) instead.
 */
describe("route collisions across sibling routers mounted at /outlets", () => {
  test("GET /api/outlets/:outletId returns the outlet, not another router's list", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const res = await client.get(`/api/outlets/${outletId}`);
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(outletId);
    expect(body.data.name).toBeDefined();
    // If a sibling router's bare "/:outletId" handler won instead, this would be
    // an array (orders/feedback/inventory list) rather than a single outlet object.
    expect(Array.isArray(body.data)).toBe(false);
  });

  test("each sibling router answers under its own path segment", async () => {
    const client = new TestClient(testEnv());
    const { json } = await registerTenant(client);
    const outletId = json.data.outlet.id as string;

    const orders = await client.get(`/api/outlets/${outletId}/orders`);
    expect(orders.status).toBe(200);
    expect(Array.isArray((await orders.json() as any).data)).toBe(true);

    const feedback = await client.get(`/api/outlets/${outletId}/feedback`);
    expect(feedback.status).toBe(200);
    expect(Array.isArray((await feedback.json() as any).data)).toBe(true);

    const inventory = await client.get(`/api/outlets/${outletId}/inventory`);
    expect(inventory.status).toBe(200);
    expect(Array.isArray((await inventory.json() as any).data)).toBe(true);

    const shifts = await client.get(`/api/outlets/${outletId}/shifts`);
    expect(shifts.status).toBe(200);
    expect(Array.isArray((await shifts.json() as any).data)).toBe(true);
  });
});
