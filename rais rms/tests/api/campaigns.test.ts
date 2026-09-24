import { describe, expect, test } from "bun:test";
import { TestClient, registerTenant, testEnv } from "../helpers/client";

describe("marketing campaigns", () => {
  test("creates a campaign, activates it, and manually sends to consenting guests", async () => {
    const client = new TestClient(testEnv());
    await registerTenant(client);

    const create = await client.post("/api/campaigns", {
      channel: "email",
      trigger: "manual",
      subject: "10% off tonight",
      body: "<p>Come on down!</p>",
    });
    expect(create.status).toBe(201);
    const campaignId = ((await create.json()) as any).data.id;

    const activate = await client.patch(`/api/campaigns/${campaignId}/status`, { status: "active" });
    expect(activate.status).toBe(200);

    const guest1 = await client.post("/api/guests", { name: "Consenting Guest", email: "yes@example.com", marketingConsent: true });
    const guest2 = await client.post("/api/guests", { name: "Non-consenting Guest", email: "no@example.com", marketingConsent: false });
    const guest1Id = ((await guest1.json()) as any).data.id;
    const guest2Id = ((await guest2.json()) as any).data.id;

    const send = await client.post(`/api/campaigns/${campaignId}/send`, { guestIds: [guest1Id, guest2Id] });
    const sendBody = (await send.json()) as any;
    expect(send.status).toBe(200);
    expect(sendBody.data.sent).toBe(1); // only the consenting guest

    const detail = await client.get(`/api/campaigns/${campaignId}`);
    const detailBody = (await detail.json()) as any;
    expect(detailBody.data.stats.sends).toBe(1);
  });

  test("only marketing-capable roles can manage campaigns", async () => {
    const env = testEnv();
    const owner = new TestClient(env);
    const { json, body } = await registerTenant(owner);
    const outletId = json.data.outlet.id as string;

    const invite = await owner.post("/api/users/invite", {
      name: "Host Hannah",
      email: "hannah@example.com",
      outletId,
      role: "host",
    });
    const { data: inviteData } = (await invite.json()) as any;

    const host = new TestClient(env);
    await host.post("/api/auth/login", {
      tenantSlug: body.tenantSlug,
      email: "hannah@example.com",
      password: inviteData.tempPassword,
    });

    const blocked = await host.get("/api/campaigns");
    expect(blocked.status).toBe(403);
  });
});
