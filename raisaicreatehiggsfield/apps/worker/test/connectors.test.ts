import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { ConnectorService, connectorDTO } from "../src/services/connector-service";
import { open, seal } from "../src/lib/secret-box";

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Dev").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Studio", userId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("connectors", () => {
  it("never stores a token in the clear", async () => {
    const auth = await context();
    const created = await new ConnectorService(env).create(auth, {
      type: "mcp_server", name: "My tools", url: "https://mcp.example.com/rpc", token: "sk-super-secret",
    });

    const row = await env.DB.prepare(`SELECT config_json FROM connectors WHERE id = ?`)
      .bind(created.id).first<{ config_json: string }>();
    expect(row!.config_json).not.toContain("sk-super-secret");

    // But the server can still replay it, which is the whole point.
    const resolved = await new ConnectorService(env).resolve(auth, created.id);
    expect(resolved?.token).toBe("sk-super-secret");
  });

  it("never hands the token back to a client", async () => {
    const auth = await context();
    const created = await new ConnectorService(env).create(auth, {
      type: "mcp_server", name: "My tools", url: "https://mcp.example.com/rpc", token: "sk-super-secret",
    });

    const dto = connectorDTO(created);
    expect(JSON.stringify(dto)).not.toContain("sk-super-secret");
    // The client is told a token exists, so the form can say so without it.
    expect(dto.hasToken).toBe(true);
  });

  it("keeps the saved token when only the name changes", async () => {
    const auth = await context();
    const service = new ConnectorService(env);
    const created = await service.create(auth, {
      type: "mcp_server", name: "Old name", url: "https://mcp.example.com/rpc", token: "sk-keep-me",
    });

    await service.update(auth, created.id, { name: "New name" });

    const resolved = await service.resolve(auth, created.id);
    expect(resolved?.token).toBe("sk-keep-me");
  });

  it("clears the token when one is explicitly emptied", async () => {
    const auth = await context();
    const service = new ConnectorService(env);
    const created = await service.create(auth, {
      type: "mcp_server", name: "Open server", url: "https://mcp.example.com/rpc", token: "sk-remove-me",
    });

    await service.update(auth, created.id, { token: "" });

    const resolved = await service.resolve(auth, created.id);
    expect(resolved?.token).toBeUndefined();
  });

  it("refuses an address that points at internal infrastructure", async () => {
    const auth = await context();
    await expect(
      new ConnectorService(env).create(auth, { type: "mcp_server", name: "Bad", url: "http://127.0.0.1:8080/rpc" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("does not resolve a connection belonging to another workspace", async () => {
    const mine = await context();
    const theirs = await context();
    const created = await new ConnectorService(env).create(theirs, {
      type: "mcp_server", name: "Theirs", url: "https://mcp.example.com/rpc", token: "sk-not-yours",
    });

    expect(await new ConnectorService(env).resolve(mine, created.id)).toBeNull();
    await expect(new ConnectorService(env).require(mine, created.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("returns nothing rather than throwing when a sealed value cannot be opened", async () => {
    // What a rotated key looks like: one connection stops working, the page
    // that lists connections still renders.
    const sealed = await seal(env, "token");
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    expect(await open(env, tampered)).toBeNull();
    expect(await open(env, "not-a-sealed-value")).toBeNull();
  });
});
