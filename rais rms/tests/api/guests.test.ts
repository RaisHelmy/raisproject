import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("guests", () => {
  test("creates a guest with tags and retrieves it with tags included", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);

    const created = await client.post("/api/guests", {
      name: "VIP Guest",
      email: "vip@example.com",
      tags: ["VIP", "regular"],
    });
    const { data: guest } = (await created.json()) as any;
    expect(created.status).toBe(201);

    const fetched = await client.get(`/api/guests/${guest.id}`);
    const { data } = (await fetched.json()) as any;
    expect(data.tags.sort()).toEqual(["VIP", "regular"].sort());
  });

  test("search filters by name/email/phone", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);
    await client.post("/api/guests", { name: "Findable Person", phone: "5559990000" });
    await client.post("/api/guests", { name: "Someone Else" });

    const res = await client.get("/api/guests?search=Findable");
    const { data } = (await res.json()) as any;
    expect(data.length).toBe(1);
    expect(data[0].name).toBe("Findable Person");
  });

  test("patch updates guest fields", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);
    const created = await client.post("/api/guests", { name: "Original Name" });
    const { data: guest } = (await created.json()) as any;

    const updated = await client.patch(`/api/guests/${guest.id}`, { name: "Updated Name" });
    const { data } = (await updated.json()) as any;
    expect(data.name).toBe("Updated Name");
  });

  test("rejects invalid input with 400 VALIDATION", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);
    const res = await client.post("/api/guests", { name: "" });
    const json = (await res.json()) as any;
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION");
  });
});
