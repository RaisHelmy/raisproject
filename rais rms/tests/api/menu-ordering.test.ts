import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

async function setupMenu(env: ReturnType<typeof testEnv>) {
  const owner = new TestClient(env);
  const { json, body } = await registerTenant(owner);
  const outletId = json.data.outlet.id as string;

  const menu = await owner.post(`/api/outlets/${outletId}/menus`, { name: "Dinner Menu" });
  const menuId = ((await menu.json()) as any).data.id;

  const section = await owner.post(`/api/outlets/${outletId}/menus/${menuId}/sections`, {
    name: "Mains",
    sortOrder: 0,
  });
  const sectionId = ((await section.json()) as any).data.id;

  const item = await owner.post(`/api/outlets/${outletId}/sections/${sectionId}/items`, {
    name: "Burger",
    priceMinor: 1500,
    currency: "USD",
    available: true,
  });
  const itemId = ((await item.json()) as any).data.id;

  return { owner, tenantSlug: body.tenantSlug, outletId, menuId, sectionId, itemId };
}

describe("menu management", () => {
  test("builds a menu with sections and items, readable via the full-menu endpoint", async () => {
    const env = testEnv();
    const { owner, outletId, menuId, itemId } = await setupMenu(env);

    const full = await owner.get(`/api/outlets/${outletId}/menus/${menuId}/full`);
    const body = (await full.json()) as any;
    expect(full.status).toBe(200);
    expect(body.data.sections[0].items[0].id).toBe(itemId);
  });

  test("a server role cannot create menus, but a manager can", async () => {
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

    const blocked = await server.post(`/api/outlets/${outletId}/menus`, { name: "Nope" });
    expect(blocked.status).toBe(403);

    const allowed = await owner.post(`/api/outlets/${outletId}/menus`, { name: "Owner Menu" });
    expect(allowed.status).toBe(201);
  });

  test("uploads an item image to R2 and serves it back through the public image endpoint", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId, itemId } = await setupMenu(env);

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const upload = await owner.putBinary(`/api/outlets/${outletId}/items/${itemId}/image`, pngBytes, "image/png");
    expect(upload.status).toBe(200);
    const { data } = (await upload.json()) as any;
    expect(data.image_r2_key).toMatch(new RegExp(`^tenants/.+/${outletId}/menu/.+\\.png$`));

    const client = new TestClient(env);
    const served = await client.get(`/api/public/${tenantSlug}/images/${data.image_r2_key}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    const bytesBack = new Uint8Array(await served.arrayBuffer());
    expect(Array.from(bytesBack)).toEqual(Array.from(pngBytes));
  });

  test("unavailable items are excluded from the public menu", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId, menuId, sectionId } = await setupMenu(env);

    const hidden = await owner.post(`/api/outlets/${outletId}/sections/${sectionId}/items`, {
      name: "86'd Item",
      priceMinor: 999,
      currency: "USD",
      available: false,
    });
    expect(hidden.status).toBe(201);

    const client = new TestClient(env);
    const publicMenu = await client.get(`/api/public/${tenantSlug}/outlets/${outletId}/menus/${menuId}`);
    const body = (await publicMenu.json()) as any;
    const names = body.data.sections.flatMap((s: any) => s.items.map((i: any) => i.name));
    expect(names).toContain("Burger");
    expect(names).not.toContain("86'd Item");
  });
});

describe("QR ordering / POS-lite", () => {
  test("a guest can place a public QR order that computes the correct total", async () => {
    const env = testEnv();
    const { tenantSlug, outletId, itemId } = await setupMenu(env);

    const client = new TestClient(env);
    const order = await client.post(`/api/public/${tenantSlug}/outlets/${outletId}/orders`, {
      type: "qr",
      items: [{ menuItemId: itemId, qty: 2 }],
    });
    expect(order.status).toBe(201);
    const { data } = (await order.json()) as any;
    expect(data.total_minor).toBe(3000);
    expect(data.status).toBe("placed");
  });

  test("staff can see the order and move it through the kitchen lifecycle", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId, itemId } = await setupMenu(env);

    const client = new TestClient(env);
    const order = await client.post(`/api/public/${tenantSlug}/outlets/${outletId}/orders`, {
      type: "qr",
      items: [{ menuItemId: itemId, qty: 1 }],
    });
    const orderId = ((await order.json()) as any).data.id;

    const list = await owner.get(`/api/outlets/${outletId}/orders`);
    const listBody = (await list.json()) as any;
    expect(listBody.data.some((o: any) => o.id === orderId)).toBe(true);

    const preparing = await owner.patch(`/api/outlets/${outletId}/orders/${orderId}/status`, { status: "preparing" });
    expect(preparing.status).toBe(200);

    const detail = await owner.get(`/api/outlets/${outletId}/orders/${orderId}`);
    const detailBody = (await detail.json()) as any;
    expect(detailBody.data.items.length).toBe(1);
  });

  test("ordering an unavailable item is rejected", async () => {
    const env = testEnv();
    const { owner, tenantSlug, outletId, sectionId } = await setupMenu(env);
    const hidden = await owner.post(`/api/outlets/${outletId}/sections/${sectionId}/items`, {
      name: "86'd",
      priceMinor: 500,
      currency: "USD",
      available: false,
    });
    const hiddenId = ((await hidden.json()) as any).data.id;

    const client = new TestClient(env);
    const order = await client.post(`/api/public/${tenantSlug}/outlets/${outletId}/orders`, {
      type: "qr",
      items: [{ menuItemId: hiddenId, qty: 1 }],
    });
    expect(order.status).toBe(400);
  });
});
