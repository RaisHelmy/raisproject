import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { MembershipService } from "../src/services/membership-service";

async function workspace(): Promise<{ auth: AuthContext; email: string }> {
  const userId = newId();
  const orgId = newId();
  const email = `${userId}@example.com`;
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, email, "h", "Owner").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  await env.DB.prepare(`INSERT INTO organization_members (org_id,user_id,role) VALUES (?,?,'owner')`)
    .bind(orgId, userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id) VALUES (?)`).bind(orgId).run();
  return { auth: { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false }, email };
}

async function person(name = "Collaborator"): Promise<{ id: string; email: string }> {
  const id = newId();
  const email = `${id}@example.com`;
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`).bind(id, email, "h", name).run();
  return { id, email };
}

describe("workspace membership", () => {
  it("adds someone who already has an account", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    const service = new MembershipService(env);

    const member = await service.add(auth, invitee.email, "member");
    expect(member.role).toBe("member");
    expect((await service.list(auth)).map((m) => m.email)).toContain(invitee.email);
  });

  it("says what to do rather than confirming whether an email exists", async () => {
    const { auth } = await workspace();
    await expect(new MembershipService(env).add(auth, "stranger@example.com")).rejects.toMatchObject({
      code: "not_found",
      action: expect.stringContaining("sign up"),
    });
  });

  it("refuses to add the same person twice", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    const service = new MembershipService(env);
    await service.add(auth, invitee.email);
    await expect(service.add(auth, invitee.email)).rejects.toMatchObject({ code: "conflict" });
  });

  it("will not leave a workspace without an owner", async () => {
    const { auth } = await workspace();
    const service = new MembershipService(env);

    await expect(service.remove(auth, auth.userId)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(service.setRole(auth, auth.userId, "member")).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("hands the workspace over in one step", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    const service = new MembershipService(env);
    await service.add(auth, invitee.email, "admin");

    await service.transferOwnership(auth, invitee.id);

    expect(await service.roleOf(auth.orgId, invitee.id)).toBe("owner");
    // The previous owner stays, as an admin: handing over is not leaving.
    expect(await service.roleOf(auth.orgId, auth.userId)).toBe("admin");
    const org = await env.DB.prepare(`SELECT owner_user_id FROM organizations WHERE id = ?`).bind(auth.orgId).first<{ owner_user_id: string }>();
    expect(org?.owner_user_id).toBe(invitee.id);
  });

  it("keeps member management to owners and admins", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    const service = new MembershipService(env);
    await service.add(auth, invitee.email, "member");

    const asMember: AuthContext = { ...auth, userId: invitee.id };
    await expect(service.add(asMember, "someone@example.com")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("never lets a bearer key add someone to a shared balance", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    const viaKey: AuthContext = { ...auth, actorType: "api_key" };

    await expect(new MembershipService(env).add(viaKey, invitee.email)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("records who was added and who added them", async () => {
    const { auth } = await workspace();
    const invitee = await person();
    await new MembershipService(env).add(auth, invitee.email);

    const entry = await env.DB
      .prepare(`SELECT event, target_id, actor_user_id FROM audit_log WHERE org_id = ? AND event = 'member.added'`)
      .bind(auth.orgId)
      .first<{ event: string; target_id: string; actor_user_id: string }>();
    expect(entry).toMatchObject({ target_id: invitee.id, actor_user_id: auth.userId });
  });
});
